# Loyalty Engine Business Rules

> **Status:** MVP Phase
> **Last Updated:** 2026-10-02

This document centralizes the business logic, constraints, and lifecycle rules governing the Loyalty Engine.

## 1. Multi-Tenant Isolation
- **Strict Tenant Boundary:** All loyalty operations strictly scope to the authenticated user's `businessId`.
- **Derived Trust:** The `businessId` is always derived from the authenticated JWT. The client cannot supply a `businessId` in requests.
- **Cross-Tenant Access:** Any attempt to access a program, branch, or milestone belonging to another business will result in a `404 Not Found` (to avoid leaking existence) or `403 Forbidden`.

## 2. Program Lifecycle & Status
- **Branch Scoping:** A `LoyaltyProgram` belongs to exactly one `Branch`.
- **One Active Program:** A branch can have **at most one** `ACTIVE` (`isActive = true`) program at any given time.
- **Status Endpoint:** Program status is managed via `PATCH /api/loyalty-programs/:programId/status`.
- **Reactivation:** A deactivated program (`isActive = false`) can be reactivated later. Reactivation restores the same program ID, its milestones, and all historical customer cycles.
- **Activation Conflict:** If a branch already has an active program, attempting to activate a different program on that branch will be rejected with a `409 Conflict`.
- **Persistence Guarantee:** The single-active-program rule is enforced in application logic and backed by a PostgreSQL partial unique index (`UNIQUE(branchId) WHERE isActive = true`).

## 3. Cycle Length Constraints
- **Single Source of Truth:** `LoyaltyProgram.cycleLength` strictly defines when a loyalty cycle completes. It is not derived from the highest milestone.
- **Minimum Value:** `cycleLength` must be ≥ 1.
- **Milestone Bounds:** A milestone's `visitNumber` must be between `1` and `cycleLength` (inclusive).
- **Safe Reduction:** `cycleLength` cannot be updated to a value lower than the highest existing milestone's `visitNumber`. Attempting to do so returns a `409 Conflict`. The owner must first delete or update the conflicting milestones.

## 4. Reward Configuration Rules
When creating or updating a `Milestone`, the payload must adhere strictly to the rules of the selected `rewardType`. The application enforces this using Zod schemas.

| `rewardType` | Validation Rules |
|---|---|
| `NONE` | `rewardValue` must be null. `rewardName` must be null/empty. This acts as a progress checkpoint without unlocking a reward. |
| `PERCENT_DISCOUNT` | `rewardValue` is required, must be > 0 and ≤ 100. |
| `FIXED_DISCOUNT` | `rewardValue` is required, must be > 0. |
| `FREE_ITEM` | `rewardName` is required and non-empty. `rewardValue` must be null. |

## 5. Milestone Uniqueness & Deletion
- **No Overlap:** Only one milestone can exist per `visitNumber` within a given program. Overlaps return `409 Conflict`.
- **Independent Lifecycle:** Milestones can be updated, disabled (`isEnabled = false`), or permanently deleted without affecting the program's overall `cycleLength` or existing `MilestoneReward` records that have already been unlocked by customers (since those are snapshotted at unlock time).

## 6. QR & Public Resolution Rules
- **Opaque Branch Identifier:** The branch `qrToken` is the sole public identifier supplied by the customer. The customer never supplies `businessId`, `branchId`, or `programId`.
- **Zero Internal ID Leakage:** Public QR responses return business name, branch name, address, program name, cycle length, and milestones. Internal database UUIDs are never exposed.
- **Validity Invariants:** Inactive branches return 400 Bad Request; invalid tokens return 404 Not Found; branches without an active program return 422 Unprocessable Entity.

## 7. Customer Profile & Read-Only Status
- **CustomerProfile Junction:** Represents `(Customer, Business)` unique relationship. Shared across all branches of that business.
- **Idempotent Linking:** An authenticated customer accessing any branch idempotently ensures their `CustomerProfile` exists for that business.
- **Strict Read-Only Loyalty Status:** Viewing `GET /api/customer/loyalty/:qrToken` never mutates loyalty state. It never creates an empty `LoyaltyCycle` or `VisitRequest`. If a customer has not yet had a visit approved, status returns `hasStarted: false` and `visitCount: 0`.

## 8. Visit Request Rules
- **Single Pending Request:** A customer may have at most ONE `PENDING` `VisitRequest` per branch. Attempting to create a second pending request for the same branch returns `409 Conflict`.
- **Branch Scope:** No cross-branch pending restrictions are enforced. A pending request at Branch A does not restrict requests at Branch B.
- **Re-Request After Rejection:** `REJECTED` is terminal. A customer whose request was rejected can create a new request for that branch immediately.

## 9. Atomic Staff Approval & Concurrency Protection
- **Atomic Conditional Claim:** Approval relies on a conditional update `WHERE id = :id AND status = 'PENDING'` inside a PostgreSQL transaction.
- **Deterministic Concurrency:** If two staff members simultaneously approve the same request, exactly one succeeds and the other receives `409 Conflict`.
- **Branch Operational Scope:** Staff can only view, approve, or reject requests for their assigned `branchId`. Cross-branch attempts return `403 Forbidden`. Inactive staff are rejected (`403 Forbidden`).

## 10. Lazy LoyaltyCycle Lifecycle
- **First Visit Lazy Creation:** Cycle 1 is NOT created on QR scan, login, or dashboard load. It is created lazily when the customer's first visit is approved (`visitCount = 1`).
- **Concurrent Creation Race:** Handled gracefully. If a race condition encounters a unique active-cycle constraint violation, the active cycle is re-read and used without error.
- **Lazy Next Cycle Rollover:** When `visitCount === cycleLength`, the current cycle is marked `COMPLETED` with `completedAt`. An empty Cycle N+1 is NOT created immediately. The next cycle is created lazily on the customer's next approved visit with `cycleNumber = N + 1` and `visitCount = 1`.

## 11. Milestone Snapshots & Reward Redemption
- **Snapshot Immutability:** When an approved visit reaches a reward milestone (rewardType != `NONE`), a `MilestoneReward` record is created with status `UNLOCKED`. Reward type, value, name, and description are snapshotted. Subsequent edits to the program milestone do not modify unlocked rewards.
- **NONE Milestones:** Progress is tracked (`visitCount` increments), but no `MilestoneReward` record is created.
- **Independent Reward Lifecycle:** Rewards earned in previous or completed cycles remain permanently visible and UNLOCKED until redeemed. Cycle completion or beginning a new cycle (e.g. at 0/N stamps) never deletes, resets, or locks previously earned rewards.
- **Cryptographic Redemption Token:**
  - Every unlocked reward is provisioned with a high-entropy 96-bit raw token formatted as `RP-XXXX-XXXX-XXXX`.
  - Raw tokens are **never** stored in the database. Only a deterministic SHA-256 hash is persisted in `redemptionTokenHash` with a `@unique` index.
  - The raw token is returned only to authenticated customers while `status === 'UNLOCKED'`. When redeemed, it is omitted.
  - The QR payload contains only the opaque token `RP-XXXX-XXXX-XXXX`. No URLs or database identifiers are embedded.
- **Customer Presentation:**
  - Customers tap **[ Show Reward ]** on their mobile loyalty pass to present the dynamic QR code and uppercase redemption code to staff.
  - Customers have NO self-redemption button or endpoint.
- **Staff / Owner Scanning & Validation:**
  - Staff or Owners click **[ Scan Reward ]** on their dashboard.
  - Camera scanning (`html5-qrcode`) or manual code entry submits to `POST /api/staff/rewards/validate`.
  - Validation performs read-only checks: token hash lookup, branch assignment (for staff), business tenant scoping, and returns masked customer information and snapshotted reward details.
- **Atomic Single Redemption:**
  - Staff or Owner confirms redemption via `POST /api/staff/rewards/redeem-by-token`.
  - Atomically sets `status = REDEEMED`, `redeemedAt = now()`, and `redeemedByStaffId`.
  - For `OWNER`, an operational `Staff` record is resolved via `resolveStaffRecord()`.
  - Attempting to redeem an already `REDEEMED` reward returns `409 Conflict`.
- **Customer Realtime State:**
  - Redeemed rewards show as `REDEEMED` with redemption date (`Used on <date>`).
  - The redemption token and `[ Show Reward ]` modal are permanently deactivated for that reward instance.


