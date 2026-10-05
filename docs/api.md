# Loyalty API Reference

> **Status:** MVP Phase
> **Last Updated:** 2026-10-02

This document details the API endpoints for managing Loyalty Programs and Milestones. All endpoints require `OWNER` authentication unless otherwise specified, and strictly enforce tenant isolation (`businessId` is derived from the authenticated user).

## Branch-Scoped Loyalty Programs

Programs are strictly scoped to a specific branch.

### Create Loyalty Program
`POST /api/branches/:branchId/loyalty-program`
Creates a new loyalty program for the branch. The program is `ACTIVE` upon creation.

**Request Body:**
```json
{
  "name": "Cafe Rewards",
  "description": "Earn free coffee",
  "cycleLength": 10
}
```
**Responses:**
- `201 Created`: Returns the created program.
- `400 Bad Request`: Validation failure (e.g., cycleLength < 1).
- `409 Conflict`: The branch already has an `ACTIVE` loyalty program.

### Get Active Loyalty Program
`GET /api/branches/:branchId/loyalty-program`
Fetches the single `ACTIVE` loyalty program for a branch. Intended for future QR/customer flows.

**Responses:**
- `200 OK`: Returns the active program and its milestones.
- `404 Not Found`: No active program exists for this branch.

### List All Loyalty Programs
`GET /api/branches/:branchId/loyalty-programs`
Lists all programs (both `ACTIVE` and `INACTIVE`) for a branch. Intended for owner management.

**Responses:**
- `200 OK`: Returns an array of programs.

### Update Active Loyalty Program
`PATCH /api/branches/:branchId/loyalty-program`
Updates the currently active program's details.

**Request Body:** (All fields optional)
```json
{
  "name": "Updated Rewards",
  "description": "New description",
  "cycleLength": 12
}
```
**Responses:**
- `200 OK`
- `404 Not Found`: No active program exists to update.
- `409 Conflict`: If reducing `cycleLength` below an existing milestone's `visitNumber`.

---

## Program Lifecycle & Milestones

### Set Program Status
`PATCH /api/loyalty-programs/:programId/status`
Activates or deactivates a specific program.

**Request Body:**
```json
{
  "isActive": true
}
```
**Responses:**
- `200 OK`: Status updated successfully.
- `409 Conflict`: Attempted to set `isActive: true` when another program on the same branch is already `ACTIVE`.

### Create Milestone
`POST /api/loyalty-programs/:programId/milestones`
Adds a new milestone to a program.

**Request Body:**
```json
{
  "visitNumber": 5,
  "rewardType": "PERCENT_DISCOUNT",
  "rewardValue": 10
}
```
**Responses:**
- `201 Created`
- `400 Bad Request`: Validation failure (e.g., invalid reward configuration).
- `409 Conflict`: A milestone already exists at this `visitNumber`.
- `422 Unprocessable Entity`: `visitNumber` exceeds program's `cycleLength`.

### Update Milestone
`PATCH /api/milestones/:milestoneId`
Updates milestone details.

**Request Body:**
```json
{
  "visitNumber": 6,
  "rewardType": "FIXED_DISCOUNT",
  "rewardValue": 50
}
```
**Responses:**
- `200 OK`
- `400 Bad Request`: Validation failure.
- `409 Conflict`: Moving to a `visitNumber` that is already taken.
- `422 Unprocessable Entity`: `visitNumber` exceeds program's `cycleLength`.

### Set Milestone Status
`PATCH /api/milestones/:milestoneId/status`
Enables or disables a milestone.

**Request Body:**
```json
{
  "isEnabled": false
}
```
**Responses:**
- `200 OK`

### Delete Milestone
`DELETE /api/milestones/:milestoneId`
Permanently deletes a milestone.

**Responses:**
- `204 No Content`

---

## Public QR Resolution

### Resolve Branch & Active Program by QR Token
`GET /api/public/qr/:qrToken`

Resolves public branch and active loyalty program information. No authentication required. Does NOT expose internal database UUIDs (`businessId`, `branchId`, `programId`).

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "business": { "name": "Apex Coffee", "type": "Cafe" },
      "branch": { "name": "Downtown Branch", "address": "123 Main St" },
      "program": {
        "name": "Coffee Rewards",
        "description": "Collect stamps",
        "cycleLength": 8,
        "milestones": [ ... ]
      }
    }
  }
  ```
- `400 Bad Request`: If branch is inactive.
- `404 Not Found`: If `qrToken` is invalid or expired.
- `422 Unprocessable Entity`: If branch has no active loyalty program.

---

## Customer Loyalty APIs

Requires `authenticateCustomer` (Bearer JWT containing `{ customerId, role: "CUSTOMER" }`).

### Get Loyalty Pass Status
`GET /api/customer/loyalty/:qrToken`

Logically read-only with respect to loyalty state. Idempotently creates `CustomerProfile(customerId, businessId)` if it does not yet exist. Never creates an empty `LoyaltyCycle` or `VisitRequest`.

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "customer": { "id": "...", "name": "...", "phone": "..." },
      "business": { "name": "..." },
      "branch": { "name": "..." },
      "cycle": {
        "hasStarted": true,
        "cycleNumber": 2,
        "visitCount": 0,
        "cycleLength": 5,
        "status": "ACTIVE"
      },
      "milestones": [ ... ],
      "rewards": [
        {
          "id": "...",
          "rewardType": "FREE_ITEM",
          "rewardName": "Head Massage",
          "status": "UNLOCKED",
          "cycleNumber": 1,
          "unlockedAt": "...",
          "redemptionToken": "RP-A1B2-C3D4-E5F6"
        }
      ],
      "unlockedRewards": [ ... ],
      "redeemedRewards": [ ... ],
      "pendingRequest": null
    }
  }
  ```
  *Note:* `redemptionToken` is provided only for `status === 'UNLOCKED'` to render the dynamic customer reward QR/code. For `REDEEMED` rewards, `redemptionToken` is omitted. Raw database hashes are never exposed.

### Create Visit Request (Normal Stamp)
`POST /api/customer/visit-requests`

Submits a normal visit stamp request. Enforces at most one `PENDING` request per `(customerProfileId, branchId)`.
*Note:* Visit requests are exclusively for earning visits / stamps that do not have an attached reward milestone. For visits with rewards, use `POST /api/customer/reward-claims`.

**Request Body:**
```json
{
  "qrToken": "qr_br1_xyz"
}
```

**Responses:**
- `201 Created`: Returns `{ id, status: "PENDING", requestedAt }`.
- `400 Bad Request`: Branch is inactive.
- `404 Not Found`: Invalid QR token.
- `409 Conflict`: Customer already has a pending visit request for this branch.
- `422 Unprocessable Entity`: Branch has no active loyalty program.

### Create Reward Claim ("Claim Reward Visit")
`POST /api/customer/reward-claims`

Generates a short-lived claim token (`RC-XXXX-XXXX-XXXX`) for a qualifying visit that coincides with an attached reward milestone (e.g. Visit 4 of 4). Replaces the standard `VisitRequest` to enable single-scan visit recording and reward redemption.

- **TTL:** 15 minutes (`expiresAt = now + 15m`).
- **Idempotent Invalidation:** Automatically sets any previously `PENDING` claims for this customer and branch to `EXPIRED`.
- **Token Security:** Raw token is returned in the response for customer QR generation; only its deterministic SHA-256 hash is persisted in the database.

**Request Body:**
```json
{
  "qrToken": "qr_br1_xyz"
}
```

**Responses:**
- `201 Created`:
  ```json
  {
    "status": "success",
    "data": {
      "claimId": "claim-uuid",
      "claimToken": "RC-A1B2-C3D4-E5F6",
      "expiresAt": "2026-10-05T15:35:00.000Z",
      "expectedVisitNumber": 4,
      "cycleLength": 4,
      "reward": {
        "id": "milestone-uuid",
        "name": "Head Massage",
        "description": "Complimentary 30-min massage",
        "type": "FREE_ITEM",
        "value": null
      },
      "business": {
        "name": "Luxe Spa"
      },
      "branch": {
        "name": "Downtown Branch"
      }
    }
  }
  ```
- `400 Bad Request`: Missing `qrToken`, branch is inactive, or upcoming visit does not have an attached reward milestone.
- `404 Not Found`: Invalid or expired QR code.
- `409 Conflict`: Reward for this milestone has already been claimed in this cycle.
- `422 Unprocessable Entity`: Branch has no active loyalty program.

### Customer Loyalty History
`GET /api/customer/history`

Returns completed cycles, visit logs, and reward history across all businesses visited by the authenticated customer.

### Customer Explore Businesses & Programs
`GET /api/customer/explore`

Enables customers to discover participating businesses, browse active branch locations and loyalty programs, and view their current enrollment/progress across stores.

- **Data Integrity:** Queries real database businesses with active branches and active loyalty programs only. Contains no mock distances, fake ratings, or placeholder data.
- **Query Parameters:**
  - `page` (optional, integer, default: `1`, minimum: `1`): Current page number.
  - `limit` (optional, integer, default: `12`, minimum: `1`, maximum: `20`): Page size limit.
  - `category` (optional, string): Case-insensitive category filter (`ALL`, `CAFE`, `SALON`, `RESTAURANT`, `FITNESS`, `RETAIL`).
  - `search` (optional, string): Case-insensitive substring match against business name, branch name, address, or loyalty program name.
- **Responses:**
  - `200 OK`:
    ```json
    {
      "status": "success",
      "data": {
        "items": [
          {
            "id": "business-uuid",
            "name": "Apex Coffee Roasters",
            "type": "CAFE",
            "branch": {
              "id": "branch-uuid",
              "name": "Downtown Roastery",
              "address": "123 Main St",
              "qrToken": "qr_br1_xyz"
            },
            "program": {
              "id": "program-uuid",
              "name": "Coffee Lovers Club",
              "description": "Collect stamps for free brew",
              "cycleLength": 4,
              "milestones": [
                {
                  "id": "milestone-uuid",
                  "visitNumber": 4,
                  "rewardType": "FREE_ITEM",
                  "rewardName": "Free Pour-Over Coffee",
                  "rewardDescription": "Any single-origin pour-over",
                  "rewardValue": null
                }
              ]
            },
            "isEnrolled": true,
            "currentVisitCount": 2
          }
        ],
        "pagination": {
          "page": 1,
          "limit": 12,
          "total": 1,
          "totalPages": 1,
          "hasNextPage": false,
          "hasPreviousPage": false
        }
      }
    }
    ```
  - `401 Unauthorized`: Missing or invalid customer JWT.

---

## Staff Operational APIs

Requires `authenticateUser` with role `STAFF` or `OWNER`.

### Unified Staff / Owner Dashboard
`GET /api/staff/dashboard`

Unified operational dashboard endpoint that consolidates pending visit requests, available unlocked customer rewards, and summary queue counts in a single payload. Replaces separate polling loops with one optimized request.

- For `STAFF`: Scoped strictly to the staff member's assigned `branchId`. Rejects any mismatched `?branchId=` with `403 Forbidden`. Inactive staff are rejected (`403 Forbidden`).
- For `OWNER`: Scoped to entire business, with optional `?branchId=` query parameter.
- Supports optional `?search=` filter (customer name or phone digits for rewards).
- Customer phones are masked (`+91 ••••• ••421`) for privacy.

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "pendingRequests": [
        {
          "id": "req-uuid",
          "status": "PENDING",
          "requestedAt": "2026-10-02T12:00:00.000Z",
          "branch": { "id": "branch-uuid", "name": "Downtown Branch" },
          "customer": { "id": "cust-uuid", "name": "John Doe", "maskedPhone": "+91 ••••• ••421" },
          "currentCycleVisitCount": 2
        }
      ],
      "availableRewards": [
        {
          "id": "reward-uuid",
          "rewardType": "FREE_ITEM",
          "rewardName": "Head Massage",
          "rewardDescription": "30-min scalp massage",
          "rewardValue": null,
          "cycleNumber": 1,
          "unlockedAt": "2026-10-02T12:05:00.000Z",
          "branch": { "id": "branch-uuid", "name": "Downtown Branch" },
          "customer": { "id": "cust-uuid", "name": "John Doe", "maskedPhone": "+91 ••••• ••421" }
        }
      ],
      "stats": {
        "pendingRequests": 1,
        "activeRewards": 1
      }
    }
  }
  ```

### View Pending Visit Requests
`GET /api/staff/visit-requests`

- For `STAFF`: Scoped strictly to the staff member's assigned `branchId` (from the `Staff` record). Inactive staff are rejected (`403 Forbidden`).
- For `OWNER`: Scoped to owner's business, with optional `?branchId=` query parameter.
- Customer phones are masked (`+91 ••••• ••421`) for privacy.

**Responses:**
- `200 OK`: Returns an array of pending requests.

### View Unlocked Customer Rewards
`GET /api/staff/rewards/unlocked`

Fetches active `UNLOCKED` customer rewards waiting for redemption at checkout. Eliminates raw UUID input requirements in the UI.

- For `STAFF`: Scoped strictly to the staff member's assigned `branchId`.
- For `OWNER`: Scoped to owner's business, with optional `?branchId=` filter.
- Supports optional `?search=` filter (customer name or phone digits).
- Customer phones are masked for privacy.

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": [
      {
        "id": "reward-uuid",
        "rewardType": "FREE_ITEM",
        "rewardName": "Head Massage",
        "rewardDescription": "30-min scalp massage",
        "cycleNumber": 1,
        "unlockedAt": "...",
        "branch": { "id": "...", "name": "Downtown Branch" },
        "customer": { "id": "...", "name": "John Doe", "maskedPhone": "+91 ••••• ••421" }
      }
    ]
  }
  ```

### Approve Visit Request
`POST /api/staff/visit-requests/:id/approve`

Executes the atomic approval transaction:
1. Atomically claims the `PENDING` request (concurrent duplicate approvals fail with `409 Conflict`).
2. Verifies staff active status and branch assignment.
3. Lazily creates `LoyaltyCycle` 1 on first approved visit (gracefully handling concurrent creation race).
4. Creates `Visit` record with `visitType = QUALIFYING`, `visitRequestId = request.id`, and `visitNumberInCycle = newVisitCount`.
5. Evaluates milestones and snapshots reward data if rewardType != `NONE`. If a milestone is reached, `MilestoneReward` is created immediately with `status = UNLOCKED` and a cryptographic redemption token is generated.
6. Completes cycle if `visitCount === cycleLength` (does NOT immediately create empty next cycle).
*Rule:* Milestone rewards are unlocked immediately when the approved qualifying visit reaches the milestone. Reward redemption is a separate transaction that does not require a VisitRequest and does not increment loyalty cycle count, but atomically creates a Visit with `visitType = REWARD_REDEMPTION` for footfall analytics.

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "message": "Visit approved successfully",
    "data": {
      "visitId": "...",
      "visitNumberInCycle": 1,
      "cycleNumber": 1,
      "cycleCompleted": false,
      "newRewardUnlocked": null
    }
  }
  ```
- `403 Forbidden`: Cross-branch approval by staff or inactive staff.
- `404 Not Found`: Request not found.
- `409 Conflict`: Request already approved or rejected.

### Reject Visit Request
`POST /api/staff/visit-requests/:id/reject`

Atomically marks request as `REJECTED`. No `Visit` or `LoyaltyCycle` modifications occur. Customer is unblocked to request again.

**Responses:**
- `200 OK`: `{ "status": "success", "message": "Visit request rejected" }`
- `409 Conflict`: Request already resolved.

### Validate Reward Token (Read-Only)
`POST /api/staff/rewards/validate`

Validates a customer-presented reward QR or redemption code without redeeming it. Returns customer details (masked phone), branch details, and snapshotted reward information.

- Scoped to `STAFF` (assigned branch only) and `OWNER` (business-wide).
- Strictly read-only: does not modify reward status or timestamps.

**Request Body:**
```json
{
  "rewardToken": "RP-A1B2-C3D4-E5F6"
}
```

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "id": "reward-uuid",
      "status": "UNLOCKED",
      "rewardType": "FREE_ITEM",
      "rewardName": "Head Massage",
      "rewardDescription": "30-min scalp massage",
      "rewardValue": null,
      "unlockedAt": "2026-10-03T10:00:00.000Z",
      "cycleNumber": 1,
      "branch": {
        "id": "branch-uuid",
        "name": "Downtown Branch"
      },
      "customer": {
        "id": "customer-uuid",
        "name": "Alice Wonderland",
        "maskedPhone": "+91 ••••• ••421"
      }
    }
  }
  ```
- `400 Bad Request`: Missing or invalid `rewardToken` format.
- `403 Forbidden`: Token belongs to another business or another branch (for staff).
- `404 Not Found`: Reward token not found.
- `409 Conflict`: Reward has already been redeemed.

### Redeem Reward by Token (Atomic Mutation)
`POST /api/staff/rewards/redeem-by-token`

Atomically transitions the reward identified by `rewardToken` from `UNLOCKED` to `REDEEMED` and creates a physical store `Visit` record.
- For `STAFF`: Uses authenticated staff record as `redeemedByStaffId` and `approvedByStaffId`.
- For `OWNER`: Resolves/creates an operational `Staff` record linked to the Owner `User` via `resolveStaffRecord()`.
- **Atomic Visit Creation:** Creates a `Visit` with `visitType = REWARD_REDEMPTION`, `visitRequestId = null`, `visitNumberInCycle = null`, `branchId = branch.id`, and `loyaltyCycleId = reward.loyaltyCycleId`.
- *Rule:* Does NOT increment `LoyaltyCycle.visitCount` and does NOT start the next cycle. Next cycle starts on next qualifying visit.
- Thread-safe conditional update: concurrent duplicate calls return `409 Conflict` (no duplicate Visit created).

**Request Body:**
```json
{
  "rewardToken": "RP-A1B2-C3D4-E5F6"
}
```

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "message": "Reward successfully redeemed",
    "data": {
      "id": "reward-uuid",
      "status": "REDEEMED",
      "redeemedAt": "2026-10-03T10:05:00.000Z",
      "rewardName": "Head Massage",
      "visitId": "visit-uuid"
    }
  }
  ```
- `400 Bad Request`: Missing or invalid `rewardToken`.
- `403 Forbidden`: Cross-business or cross-branch attempt.
- `404 Not Found`: Reward token not found.
- `409 Conflict`: Reward has already been redeemed.

### Redeem Milestone Reward (Direct by ID)
`POST /api/staff/rewards/:rewardId/redeem`

Atomically marks an `UNLOCKED` reward as `REDEEMED` by ID. Reward snapshot fields remain completely immutable.

**Responses:**
- `200 OK`: `{ "status": "success", "message": "Reward marked as redeemed" }`
- `409 Conflict`: Reward already redeemed.

---

## Staff Reward Claim APIs ("Claim Reward Visit")

Requires authentication with role `STAFF` or `OWNER`. Handles scanning, validation, and single-step confirmation for reward-qualifying visits (`RC-XXXX-XXXX-XXXX`).

### Validate Reward Claim Token (Read-Only)
`POST /api/staff/reward-claims/validate`

Performs non-mutating validation of an `RC-` claim token. Verifies business tenant boundaries, staff branch scoping, token TTL, customer visit progress, and duplicate reward guards.

**Request Body:**
```json
{
  "claimToken": "RC-A1B2-C3D4-E5F6"
}
```

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "data": {
      "claimId": "claim-uuid",
      "customerName": "John Doe",
      "customerPhone": "******1234",
      "expectedVisitNumber": 4,
      "cycleLength": 4,
      "rewardName": "Head Massage",
      "rewardDescription": "Complimentary 30-min massage",
      "rewardType": "FREE_ITEM",
      "rewardValue": null,
      "branchName": "Downtown Branch",
      "businessName": "Luxe Spa",
      "expiresAt": "2026-10-05T15:35:00.000Z"
    }
  }
  ```
- `400 Bad Request`: Missing token, invalid format (must start with `RC-`), or milestone has no reward.
- `403 Forbidden`: Claim belongs to another business or staff member is assigned to a different branch.
- `404 Not Found`: Reward claim not found or invalid token.
- `409 Conflict`: Claim has already been redeemed or customer visit count has changed.
- `410 Gone`: Claim token has expired (15-minute TTL exceeded).

### Confirm Reward Claim Visit (Atomic Mutation)
`POST /api/staff/reward-claims/confirm`

Atomically processes the entire reward-qualifying visit in a single database transaction:
1. Marks `RewardClaim.status = 'CONSUMED'`, `consumedAt = now()`, `consumedByStaffId`.
2. Creates `Visit` (`visitType = QUALIFYING`, `visitNumberInCycle = expectedVisitNumber`).
3. Increments `LoyaltyCycle.visitCount` (marks `COMPLETED` if terminal visit).
4. Creates snapshotted `MilestoneReward` and immediately sets `status = REDEEMED`.
5. Creates analytics `Visit` (`visitType = REWARD_REDEMPTION`, `visitNumberInCycle = null`).

**Request Body:**
```json
{
  "claimToken": "RC-A1B2-C3D4-E5F6"
}
```

**Responses:**
- `200 OK`:
  ```json
  {
    "status": "success",
    "message": "Reward visit confirmed and reward redeemed successfully",
    "data": {
      "qualifyingVisitId": "visit-uuid-1",
      "redemptionVisitId": "visit-uuid-2",
      "visitNumberInCycle": 4,
      "cycleNumber": 1,
      "cycleCompleted": true,
      "reward": {
        "id": "milestone-reward-uuid",
        "rewardName": "Head Massage",
        "rewardType": "FREE_ITEM",
        "rewardValue": null,
        "status": "REDEEMED",
        "redeemedAt": "2026-10-05T15:21:00.000Z"
      },
      "customer": {
        "id": "customer-uuid",
        "name": "John Doe"
      }
    }
  }
  ```
- `400 Bad Request`: Missing or invalid token format.
- `403 Forbidden`: Cross-business or cross-branch attempt.
- `404 Not Found`: Reward claim not found.
- `409 Conflict`: Claim already redeemed, token expired, or customer visit progress shifted.
- `410 Gone`: Token expired.
- `422 Unprocessable Entity`: No active loyalty program found for branch.

---

## Owner Staff Management APIs

Requires `authenticateUser` with role `OWNER`. All actions strictly verify and enforce tenant boundary via JWT `businessId`. Does not accept `businessId` from client.

### Create Staff Member
`POST /api/staff`

Creates a `User` record with role `STAFF` and an associated `Staff` record linked to the owner's `businessId` and a branch belonging to that business.

**Request Body:**
```json
{
  "email": "staff@example.com",
  "password": "Password123!",
  "branchId": "uuid-of-branch"
}
```

**Responses:**
- `201 Created`: Returns `{ id, userId, email, branchId, branchName, isActive, createdAt }`.
- `400 Bad Request`: Validation failure (invalid email, password < 8 characters).
- `404 Not Found`: Branch not found or does not belong to owner's business.
- `409 Conflict`: Email is already registered.

### List Staff Members
`GET /api/staff`

Lists all staff accounts belonging to the owner's business (`user.role = STAFF`).

**Responses:**
- `200 OK`: Returns an array of staff member objects.

### Get Staff Member
`GET /api/staff/:id`

Retrieves a single staff member by ID within owner's business.

**Responses:**
- `200 OK`: Returns staff member object.
- `404 Not Found`: Staff member not found or belongs to another business.

### Update Staff Member
`PATCH /api/staff/:id`

Updates staff email, password, and/or branch assignment.

**Request Body:** (At least one field required)
```json
{
  "email": "newstaff@example.com",
  "password": "NewPassword123!",
  "branchId": "uuid-of-new-branch"
}
```

**Responses:**
- `200 OK`: Returns updated staff member object.
- `404 Not Found`: Staff member or branch not found.
- `409 Conflict`: Email is already registered by another user.

### Update Staff Status (Deactivate / Reactivate)
`PATCH /api/staff/:id/status`

Toggles staff member `isActive` status. Inactive staff are rejected on login and operational verification.

**Request Body:**
```json
{
  "isActive": false
}
```

**Responses:**
- `200 OK`: Returns updated staff member with new `isActive` flag.
- `404 Not Found`: Staff member not found or belongs to another business.


