# Database Design

> **Status:** Draft — MVP Phase  
> **Last Updated:** 2026-10-02 (Loyalty Program module complete; reward-type validation constraints documented)  
> **Audience:** Developers and AI coding agents implementing the data layer.  
> **Source of truth for product requirements:** [`docs/product.md`](./product.md)  
> **Source of truth for application architecture:** [`docs/architecture.md`](./architecture.md)

---

## 1. Document Purpose

This document defines how the product's data is persisted. Specifically it covers:

- PostgreSQL database architecture
- Prisma model design and field specifications
- Entity relationships and foreign keys
- Enumerations and their values
- Unique constraints and partial indexes
- Indexing strategy for common query patterns
- Multi-tenant isolation at the data layer
- Deletion and archival behavior
- Loyalty lifecycle rules at the database level
- Transaction and concurrency requirements
- Data integrity invariants
- Prisma-specific design conventions
- Open decisions that must be resolved before `schema.prisma` is written

**Relationship to other documents:**

| Document | Defines |
|---|---|
| `product.md` | WHAT the product does — features, user journeys, product rules |
| `architecture.md` | HOW the application is structured — stack, layers, API, security |
| `database.md` (this file) | HOW the data is persisted — models, fields, constraints, lifecycle |

When there is ambiguity, `product.md` is the product source of truth and `architecture.md` is the application source of truth. This document must be consistent with both.

---

## 2. Database Technology

```
Database:  PostgreSQL
ORM:       Prisma
```

### Why PostgreSQL

PostgreSQL is appropriate for the MVP for the following reasons:

- **Relational structure.** The product's data — businesses, branches, programs, milestones, customers, cycles, visits, rewards — is inherently relational with well-defined foreign key relationships.
- **Strong constraints.** Unique constraints, foreign keys, and check constraints can enforce critical invariants at the database level, not just in application code.
- **Transactions.** The loyalty visit approval flow requires atomicity across multiple writes (VisitRequest, Visit, LoyaltyCycle update, MilestoneReward, new cycle creation). PostgreSQL ACID transactions are essential.
- **Proven reliability.** PostgreSQL is a mature, well-understood database appropriate for a multi-tenant SaaS product at this scale.
- **Future scalability.** Row-level security, read replicas, and extensions (e.g., `pg_trgm` for search) are available when needed.

### Why Prisma

- Type-safe database client generated from the schema.
- Migration management through `prisma migrate`.
- Prevents raw SQL mistakes for common operations.
- Works well with the TypeScript stack defined in `architecture.md`.

---

## 3. Entity Relationship Overview

```
User ──────────────────────────────────────────────────────────┐
 ├── owns → Business                                            │
 └── is referenced by → Staff                                  │
                                                               │
Business (primary tenant boundary)                             │
 ├── has many → Branch                                         │
 │    └── has one active → LoyaltyProgram                     │
 │         └── has many → Milestone                           │
 │                                                             │
 └── has many → CustomerProfile                                │
                                                               │
Customer (platform-level identity)                             │
 └── has many → CustomerProfile (one per business)            │
       └── has many → LoyaltyCycle (one active per program)   │
             ├── has many → Visit                              │
             └── has many → MilestoneReward                   │
                                                               │
VisitRequest                                                   │
 ├── belongs to → CustomerProfile                              │
 ├── belongs to → Branch                                       │
 └── on approval → produces one → Visit                        │
                                                               │
RewardClaim                                                    │
 ├── belongs to → CustomerProfile                              │
 ├── belongs to → Branch                                       │
 ├── belongs to → LoyaltyProgram                               │
 ├── references → Milestone                                    │
 ├── optionally references → LoyaltyCycle                      │
 ├── on confirmation → consumed by → Staff                     │
 └── on confirmation → produces → Visit(QUALIFYING) + MilestoneReward(REDEEMED) + Visit(REWARD_REDEMPTION)
                                                               │
MilestoneReward                                                │
 ├── belongs to → LoyaltyCycle (the cycle it was earned in)   │
 └── references → Milestone (the checkpoint that triggered it) │
                                                               │
Staff                                                          │
 ├── references → User (email+password identity)              ─┘
 ├── belongs to → Business
 └── belongs to → Branch
```

### Ownership Boundaries

- `Business` is the **primary tenant**. All business-owned data is reachable via `businessId`.
- `Customer` is a **platform-level** entity. A customer is not owned by any single business.
- `CustomerProfile` is the **junction** between a `Customer` and a `Business`. One customer can have many profiles (one per business).
- `LoyaltyCycle` belongs to a `CustomerProfile` and a `LoyaltyProgram`. It is the unit of loyalty progress.

---

## 4. Core Models

---

### `User`

**Purpose:** Authentication identity for business owners and staff members. Customers are **not** stored here.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `email` | String | No | Unique globally |
| `passwordHash` | String | No | Bcrypt hash — never plaintext |
| `role` | `UserRole` enum | No | `OWNER` or `STAFF` only |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- `email` must be unique across all users.
- `role` is limited to `OWNER` or `STAFF`. The `CUSTOMER` role is never stored here.
- `passwordHash` must be a bcrypt hash. Plaintext passwords must never be persisted.
- A `User` with `role = OWNER` is linked to a `Business` via `Business.ownerId`.
- A `User` with `role = STAFF` is linked to a `Business` and `Branch` via the `Staff` model.
- Customers authenticate via phone + OTP and are stored in the `Customer` model.

---

### `Business`

**Purpose:** The primary tenant entity. Every piece of business-owned data links back to a `Business`.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `name` | String | No | Business display name |
| `type` | String | Yes | e.g., "café", "salon", "gym" |
| `ownerId` | UUID FK → `User.id` | No | The owner's User account |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- Each `Business` belongs to exactly one owner (`User` with `role = OWNER`).
- `ownerId` references the `User` table, not the `Customer` table.
- `Business` is the primary isolation boundary in the multi-tenant model. All staff, branches, programs, and customer relationships are scoped to a `Business`.

---

### `Branch`

**Purpose:** A physical location of a business. Each branch has its own QR code and its own active loyalty program.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `businessId` | UUID FK → `Business.id` | No | Tenant scope |
| `name` | String | No | e.g., "Pune Main Branch" |
| `address` | String | Yes | Physical address |
| `qrToken` | String | No | Unique, opaque, URL-safe token |
| `isActive` | Boolean | No | Default: `true` |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- Every `Branch` belongs to exactly one `Business`.
- `qrToken` must be unique across all branches globally. It must be an opaque, randomly generated string — not a sequential ID or internal UUID. It is embedded in the public QR code URL.
- An inactive branch (`isActive = false`) cannot accept new `VisitRequest` records.
- In the MVP, one QR code per branch resolves to that branch's single active `LoyaltyProgram`. Program-specific QR codes are not part of the MVP.

**Cascade:** If a `Business` is deleted, its `Branch` records would cascade. However, deletion of businesses is not an MVP operation — prefer deactivation (`isActive = false`). See §13.

---

### `Staff`

**Purpose:** Links a `User` (email+password identity) to a specific `Business` and `Branch`. Represents a staff member who can operate the loyalty program.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `userId` | UUID FK → `User.id` | No | Auth identity (email + password) |
| `businessId` | UUID FK → `Business.id` | No | Tenant scope |
| `branchId` | UUID FK → `Branch.id` | No | Operational branch |
| `isActive` | Boolean | No | Default: `true`. Soft deactivation. |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- A `Staff` record links a `User` to a specific `Business` and `Branch`. The `User` identity (email/password) is separate from the operational assignment.
- `Staff.businessId` must match `Branch.businessId` for the staff member's assigned branch. This must be validated by the application layer (PostgreSQL cannot enforce a cross-table check constraint between `Staff.businessId` and the `Branch.businessId` referenced by `Staff.branchId` without triggers or application-level enforcement).
- Deactivating a staff member sets `isActive = false`. This does not delete historical visit approvals made by that staff member.
- A `User` can have at most one active `Staff` assignment per business (enforced at the application level).

---

### `Customer`

**Purpose:** Platform-level customer identity. A customer is not owned by any single business. They are identified by their phone number and authenticate via OTP.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `phone` | String | No | Unique globally. E.164 format recommended. |
| `name` | String | No | Provided on first registration |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- `phone` is the primary natural identifier and must be unique globally.
- `Customer` records are never stored in the `User` table. The authentication mechanism (OTP) and the identity model are completely separate.
- A single `Customer` can participate in loyalty programs at many businesses. Each business relationship is represented by a `CustomerProfile`.
- There is no `businessId` on the `Customer` table. `Customer` is platform-level.

---

### `CustomerProfile`

**Purpose:** Represents a customer's relationship with a specific business. Created automatically the first time a customer interacts with a business. Contains the join between platform-level `Customer` and tenant `Business`.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `customerId` | UUID FK → `Customer.id` | No | Platform-level customer |
| `businessId` | UUID FK → `Business.id` | No | The specific business |
| `createdAt` | DateTime | No | When the customer first engaged with this business |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- The combination `(customerId, businessId)` must be unique — one profile per customer per business.
- `CustomerProfile` is the correct entity to use for business-scoped customer queries. A business can only see `CustomerProfile` records where `businessId` matches their own.
- `CustomerProfile` does not duplicate the customer's phone number or name. Those remain on `Customer`.
- `CustomerProfile` is the parent of all loyalty activity (`LoyaltyCycle`, `Visit`, `VisitRequest`, `MilestoneReward`) within a business context.

---

### `RefreshSession`

**Purpose:** Tracks active refresh token sessions for both internal users (Owner/Staff) and customers. Used for stateful refresh token management, rotation, and revocation.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key. Used as the session identifier. |
| `userId` | UUID FK → `User.id` | Yes | Populated if session belongs to an Owner or Staff |
| `customerId` | UUID FK → `Customer.id` | Yes | Populated if session belongs to a Customer |
| `tokenHash` | String | No | Hash (e.g., SHA-256) of the current opaque token |
| `expiresAt` | DateTime | No | When this session expires |
| `isRevoked` | Boolean | No | Default: `false`. True if session is revoked due to logout or suspicious reuse. |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every rotation/write |

**Rules:**

- Exactly one of `userId` or `customerId` must be non-null. This must be enforced by a PostgreSQL `CHECK` constraint (e.g., `CHECK (("userId" IS NOT NULL AND "customerId" IS NULL) OR ("userId" IS NULL AND "customerId" IS NOT NULL))`) in a raw migration.
- The raw refresh token is NEVER stored in the database. Only its hash is stored in `tokenHash`.
- The cookie sent to the client should contain both the session `id` and the raw opaque token (e.g., `<sessionId>:<opaqueToken>`).
- On successful refresh, the `tokenHash` is updated in place atomically, effectively rotating the token and invalidating the previous one. This atomic update prevents concurrent requests from reusing the same token.
- If a client presents a valid `sessionId` but an invalid/old token (hash mismatch), the session must be flagged `isRevoked = true` (reuse detection).

### Indexes Required
- `userId`: Index for lookup during Owner/Staff cascading lookups or logout-all flows.
- `customerId`: Index for lookup during Customer cascading lookups or logout-all flows.

---

### `CustomerOtp`

**Purpose:** Persistence model for temporary Customer OTP verification.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `phone` | String | No | Target phone number (normalized) |
| `otpHash` | String | No | Hash (e.g., SHA-256) of the 6-digit OTP |
| `expiresAt` | DateTime | No | OTP expiration timestamp (5 minutes after creation) |
| `failedAttempts` | Integer | No | Default: 0. Incremented on wrong OTP attempt. Invalidated after 3. |
| `usedAt` | DateTime | Yes | Null until successfully verified. Prevents reuse. |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on verification / failed attempts |

**Rules:**
- Plaintext OTP is NEVER stored in the database.
- Maximum 3 failed verification attempts before invalidation.
- Successful verification sets `usedAt`.
- Generating a new OTP invalidates previous active OTPs for the same phone.

### Indexes Required
- `phone`: Index for lookup during OTP verification.
- `(phone, usedAt, expiresAt)`: Composite index for active OTP query performance.

---

## 5. Loyalty Models

---

### `LoyaltyProgram`

**Purpose:** Defines the loyalty rules for a branch, including the milestone configuration and the cycle length.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `businessId` | UUID FK → `Business.id` | No | Tenant scope |
| `branchId` | UUID FK → `Branch.id` | No | Required. Must match `businessId`. |
| `name` | String | No | e.g., "Café Rewards" |
| `description` | String | Yes | Optional program description |
| `cycleLength` | Integer | No | Visit count required to complete one loyalty cycle. Must be ≥ 1. |
| `isActive` | Boolean | No | Default: `true`. One active program per branch at a time. |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- `branchId` is **required and non-nullable**. Every loyalty program belongs to exactly one branch.
- `businessId` on `LoyaltyProgram` must match `businessId` on the referenced `Branch`. Enforced by application.
- `cycleLength` is the **single source of truth for when a loyalty cycle ends**. A cycle completes when `LoyaltyCycle.visitCount === LoyaltyProgram.cycleLength`. This is not derived from milestones.
- `cycleLength` must be a positive integer (≥ 1). A value of 0 or negative is invalid.
- Disabling or removing a `Milestone` does **not** change `cycleLength`.
- Reducing `cycleLength` to a value below any existing milestone's `visitNumber` is **rejected (409 Conflict)** by the application before writing to the database. The owner must remove or update conflicting milestones first.
- In the MVP, each branch has **at most one `isActive = true` loyalty program** at any time. This constraint is enforced at both the application/service layer and at the database level via the partial unique index (see §10).
- A program can be **deactivated** (`isActive = false`) without deleting it. Deactivation does not create a new program and does not delete historical `LoyaltyCycle`, `Visit`, or `MilestoneReward` records.
- A deactivated program can be **reactivated** (`isActive = true`). Reactivation restores the same program ID, all existing milestones, and all historical loyalty cycles. No new program record is created. Attempting to activate a program while another program on the same branch is already active returns `409 Conflict`.
- Program-specific QR codes are not part of the MVP. The branch QR resolves to the branch's active program.

> **Important:** `cycleLength` must not be null. Making it optional or defaulting it to something arbitrary would break the loyalty engine. It must be explicitly provided when creating a program.

---

### `Milestone`

**Purpose:** A reward checkpoint within a loyalty program. When a customer's `visitCount` within a cycle reaches a milestone's `visitNumber`, the specified reward is unlocked (if it has a reward). Milestones do not control cycle length.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `programId` | UUID FK → `LoyaltyProgram.id` | No | Owning program |
| `visitNumber` | Integer | No | The visit count at which this milestone triggers. Must be ≥ 1 and ≤ program's `cycleLength`. |
| `rewardType` | `RewardType` enum | No | `NONE`, `PERCENT_DISCOUNT`, `FIXED_DISCOUNT`, or `FREE_ITEM` |
| `rewardName` | String | Yes | Short reward label. Null when `rewardType = NONE`. |
| `rewardDescription` | String | Yes | Optional longer description or redemption instructions |
| `rewardValue` | Decimal | Yes | Numeric reward value. See meaning per reward type below. |
| `isEnabled` | Boolean | No | Default: `true`. Disabled milestones are skipped by the loyalty engine. |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**`rewardValue` meaning by reward type:**

| `rewardType` | `rewardValue` meaning | Example |
|---|---|---|
| `NONE` | Must be null. No reward. | — |
| `PERCENT_DISCOUNT` | Percentage value (e.g., `25.00` = 25% off) | `25.00` |
| `FIXED_DISCOUNT` | Monetary amount in local currency (e.g., `50.00` = ₹50 off) | `50.00` |
| `FREE_ITEM` | Typically null. Reward description is in `rewardName`/`rewardDescription`. | `null` |

**Rules:**

- `(programId, visitNumber)` must be unique — only one milestone per visit number per program.
- `visitNumber` must be ≥ 1 and ≤ the program's `cycleLength`. This is enforced by the application on creation and update. Reducing `cycleLength` below an existing `visitNumber` is also blocked by the application.
- Milestones with `rewardType = NONE` are valid and may be used to track visit checkpoints without granting a reward.
- When `rewardType = NONE`, **no `MilestoneReward` record is created** when the visit count reaches that `visitNumber`. The visit itself is still recorded normally.
- Disabling a milestone (`isEnabled = false`) means the loyalty engine skips it. Disabling does not affect `cycleLength`.

**Reward type validation constraints (enforced by application before writing):**

| `rewardType` | `rewardValue` | `rewardName` |
|---|---|---|
| `NONE` | Must be null | Must be null |
| `PERCENT_DISCOUNT` | Required, `> 0` and `≤ 100` | Optional |
| `FIXED_DISCOUNT` | Required, `> 0` | Optional |
| `FREE_ITEM` | Must be null | **Required and non-empty** |

---

### `LoyaltyCycle`

**Purpose:** Represents one complete run of a customer through a loyalty program. A cycle starts at `visitCount = 0` and completes when `visitCount === program.cycleLength`. Historical cycles are preserved permanently.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `customerProfileId` | UUID FK → `CustomerProfile.id` | No | The customer (within their business relationship) |
| `programId` | UUID FK → `LoyaltyProgram.id` | No | The program this cycle belongs to |
| `cycleNumber` | Integer | No | Sequential per `(customerProfileId, programId)`. Starts at 1. |
| `visitCount` | Integer | No | Current visit count within this cycle. Starts at 0. Must be ≥ 0. |
| `status` | `LoyaltyCycleStatus` enum | No | `ACTIVE` or `COMPLETED` |
| `startedAt` | DateTime | No | When this cycle began |
| `completedAt` | DateTime | Yes | Null until the cycle completes |
| `createdAt` | DateTime | No | Set on insert |
| `updatedAt` | DateTime | No | Updated on every write |

**Rules:**

- `(customerProfileId, programId, cycleNumber)` must be unique. This ensures sequential, non-duplicate cycle numbering per customer per program.
- `visitCount` must be ≥ 0 at all times. It is incremented by 1 on each approved **QUALIFYING** visit. `REWARD_REDEMPTION` visits do not increment `visitCount`.
- There must be **at most one `ACTIVE` cycle** per `(customerProfileId, programId)` at any time. A new `ACTIVE` cycle is only created after the previous cycle reaches `COMPLETED`. This is enforced by a PostgreSQL partial unique index (see §10) and application logic.
- A cycle is `COMPLETED` when `visitCount === loyaltyProgram.cycleLength`. This check is performed by the application inside the visit approval transaction.
- **Lazy Cycle Rollover:** When a cycle completes: `status` becomes `COMPLETED`, `completedAt` is set, and the terminal milestone reward is unlocked. A new `LoyaltyCycle` (Cycle N+1) is **NOT** created immediately. It is created lazily on the customer's next approved qualifying visit with `cycleNumber = N + 1` and `visitCount = 1`.
- Completed cycles are **never deleted**. All historical cycle data is preserved.
- `customerProfileId` must belong to the same business as the `LoyaltyProgram`. Enforced by application logic.
- **Frontend Presentation vs. Backend Counting:**
  For a 4-visit program (`cycleLength = 4`), the customer UI renders 5 visual slots (`cycleLength + 1`): 4 qualifying stamp slots plus 1 reward redemption slot. The visual 5th slot represents reward redemption state (`4 of 5` before redemption, `5 of 5` after redemption) and must **NEVER** increment `LoyaltyCycle.visitCount`. Backend counting remains strictly bound to `cycleLength`.

---

## 6. Visit and Visit Request Models

---

### `VisitRequest`

**Purpose:** A customer's pending request for a visit stamp. The intermediate state before staff approval. The customer cannot directly create a `Visit` — they create a `VisitRequest`, which staff then approve or reject.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `customerProfileId` | UUID FK → `CustomerProfile.id` | No | Requesting customer (business-scoped) |
| `branchId` | UUID FK → `Branch.id` | No | Branch where the request was made |
| `status` | `VisitRequestStatus` enum | No | `PENDING`, `APPROVED`, or `REJECTED` |
| `requestedAt` | DateTime | No | Timestamp of request creation |
| `resolvedAt` | DateTime | Yes | Timestamp of approval or rejection. Null while PENDING. |
| `resolvedByStaffId` | UUID FK → `Staff.id` | Yes | Staff who resolved. Null while PENDING. |

**Rules:**

- A `VisitRequest` is created by the customer. Its initial `status` is always `PENDING`.
- Only valid state transitions are allowed: `PENDING → APPROVED` or `PENDING → REJECTED`. An already-resolved request cannot be re-resolved.
- `resolvedByStaffId` must belong to the same business as the `Branch` referenced by `branchId`. Enforced by application.
- An `APPROVED` VisitRequest results in exactly one `Visit` record being created in the same database transaction.
- A `REJECTED` VisitRequest results in no `Visit` being created.
- The `customerProfileId`'s `businessId` must match the `Branch.businessId`. Enforced by application.
- `VisitRequest` records are not deleted after resolution. They are kept for audit purposes.
- There is no `createdAt` field separate from `requestedAt` — `requestedAt` serves as the creation timestamp.

---

### `Visit`

**Purpose:** A confirmed customer store visit. Every physical customer store visit is represented by a `Visit` record. `VisitType` distinguishes loyalty-qualifying visits from reward-redemption visits. Only `QUALIFYING` visits increment `LoyaltyCycle.visitCount`. `REWARD_REDEMPTION` visits are recorded for analytics but do not affect loyalty progress.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `loyaltyCycleId` | UUID FK → `LoyaltyCycle.id` | No | The cycle this visit belongs to (active cycle for QUALIFYING, relevant/originating cycle for REWARD_REDEMPTION) |
| `visitRequestId` | UUID FK → `VisitRequest.id` | Yes | Source request for `QUALIFYING` visits; `null` for `REWARD_REDEMPTION`. Unique constraint allows multiple nulls in PostgreSQL. |
| `branchId` | UUID FK → `Branch.id` | No | The branch where the physical store visit occurred |
| `visitType` | `VisitType` enum | No | `QUALIFYING` or `REWARD_REDEMPTION`. Default: `QUALIFYING`. |
| `visitNumberInCycle` | Integer | Yes | The sequential stamp number (`visitCount`) within the cycle for `QUALIFYING` visits; `null` for `REWARD_REDEMPTION`. |
| `approvedByStaffId` | UUID FK → `Staff.id` | No | Staff member who approved the visit request or processed the reward redemption |
| `createdAt` | DateTime | No | Timestamp of visit creation |

**Rules:**

- **Every real physical store visit = `Visit` record.**
  - **`QUALIFYING` Visit:** A normal customer visit that earns a loyalty stamp. Requires customer `VisitRequest` → staff approval flow. Increments `LoyaltyCycle.visitCount`. Sets `visitNumberInCycle = newVisitCount`.
  - **`REWARD_REDEMPTION` Visit:** A real physical store visit where the customer redeems an already-unlocked reward. Does NOT create a `VisitRequest`. Does NOT increment `LoyaltyCycle.visitCount`. Does NOT create a loyalty stamp (`visitNumberInCycle = null`, `visitRequestId = null`). Created atomically during staff/owner reward redemption confirmation.
- `visitRequestId` is unique when non-null. In PostgreSQL, standard unique constraints treat `NULL` as distinct, allowing multiple redemption visits with `visitRequestId = null` without conflict while strictly guaranteeing one `Visit` per `VisitRequest`.
- `visitNumberInCycle` is set only for `QUALIFYING` visits (equal to the cycle's `visitCount` after incrementing). For `REWARD_REDEMPTION` visits, it is `null` because redemptions do not represent a loyalty stamp number.
- `loyaltyCycleId` remains associated with the cycle from which the reward originated for `REWARD_REDEMPTION`, providing an unambiguous chain of custody to the customer profile without redundant fields.
- `branchId` must match the branch where the interaction occurred.
- `approvedByStaffId` records the staff member (or operational staff record linked to an owner) who authorized the visit or redemption.
- `Visit` records are **never deleted**. They are the permanent record of a customer's physical store visits.
- **Next Cycle:** Next loyalty cycle starts on the customer's next *qualifying* visit, not during reward redemption.
- **Indexes:**
  - `@@index([branchId, visitType])`
  - `@@index([createdAt])`
  - `@@index([branchId, createdAt])`
  - `@@index([loyaltyCycleId, visitType])`

#### Analytics Querying Distinctions
Because every physical interaction creates a `Visit`, future analytics and reporting can query the table without schema migrations:

1. **Total Physical Visits:**
   ```sql
   SELECT COUNT(*) FROM "Visit" WHERE "branchId" = :branchId;
   ```
2. **Qualifying Visits (Stamps Earned):**
   ```sql
   SELECT COUNT(*) FROM "Visit" WHERE "branchId" = :branchId AND "visitType" = 'QUALIFYING';
   ```
3. **Reward Redemption Visits:**
   ```sql
   SELECT COUNT(*) FROM "Visit" WHERE "branchId" = :branchId AND "visitType" = 'REWARD_REDEMPTION';
   ```
4. **Unique Visiting Customers:**
   ```sql
   SELECT COUNT(DISTINCT cp."customerId")
   FROM "Visit" v
   JOIN "LoyaltyCycle" lc ON v."loyaltyCycleId" = lc.id
   JOIN "CustomerProfile" cp ON lc."customerProfileId" = cp.id
   WHERE v."branchId" = :branchId;
   ```
5. **Visits Over Time & By Branch:**
   ```sql
   SELECT "branchId", DATE_TRUNC('day', "createdAt") AS day, "visitType", COUNT(*)
   FROM "Visit"
   GROUP BY "branchId", day, "visitType"
   ORDER BY day DESC;
   ```

---

## 7. MilestoneReward

**Purpose:** The per-customer, per-cycle record of a reward being unlocked. Only created when a milestone with a non-`NONE` reward type is reached. Represents a reward the customer has earned and can present to staff for redemption.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `loyaltyCycleId` | UUID FK → `LoyaltyCycle.id` | No | The cycle in which this reward was earned |
| `milestoneId` | UUID FK → `Milestone.id` | No | The milestone that triggered this reward |
| `snapshotRewardType` | `RewardType` enum | No | Snapshot of `Milestone.rewardType` at unlock time |
| `snapshotRewardValue` | Decimal | Yes | Snapshot of `Milestone.rewardValue` at unlock time |
| `snapshotRewardName` | String | Yes | Snapshot of `Milestone.rewardName` at unlock time |
| `snapshotRewardDescription` | String | Yes | Snapshot of `Milestone.rewardDescription` at unlock time |
| `status` | `MilestoneRewardStatus` enum | No | `UNLOCKED` or `REDEEMED` |
| `unlockedAt` | DateTime | No | When the milestone's visit number was reached |
| `redeemedAt` | DateTime | Yes | Null until redeemed |
| `redeemedByStaffId` | UUID FK → `Staff.id` | Yes | Staff who marked redemption. Null until redeemed. |
| `redemptionTokenHash` | String | Yes | Unique SHA-256 hash of raw token (`RP-XXXX-XXXX-XXXX`) |
| `redemptionTokenCreatedAt` | DateTime | Yes | Timestamp when redemption token was generated |

**Rules:**

- A `MilestoneReward` is **never created for a milestone with `rewardType = NONE`**. Only milestones with `PERCENT_DISCOUNT`, `FIXED_DISCOUNT`, or `FREE_ITEM` produce a `MilestoneReward`.
- `(loyaltyCycleId, milestoneId)` must be unique — a milestone can only be unlocked once per cycle.
- **Redemption Token Security:**
  - Raw token format: `RP-XXXX-XXXX-XXXX` (96-bit cryptographic entropy).
  - Raw token is **never** stored in PostgreSQL; only deterministic SHA-256 hash is stored in `redemptionTokenHash` with a `@unique` index for $O(1)$ lookup.
  - Raw token is returned only to authenticated customer for `UNLOCKED` rewards via `GET /api/customer/loyalty/:qrToken`. For `REDEEMED` rewards, the raw token is omitted.
  - Opaque token in QR payload — no URLs, database UUIDs, customer IDs, or branch IDs are embedded.
- **Snapshotting:** `snapshotRewardType`, `snapshotRewardValue`, `snapshotRewardName`, and `snapshotRewardDescription` are copied from the `Milestone` at the exact moment the reward is unlocked. After unlock, changes to the original `Milestone` do NOT modify the customer's existing reward. Redemption must use these snapshot values.
- `status` starts as `UNLOCKED`. The only valid transition is `UNLOCKED → REDEEMED`.
- A `REDEEMED` reward cannot be redeemed again. Duplicate redemption must be rejected (application returns `409 Conflict`).
- Redemption must be performed by an authenticated `OWNER` or `STAFF` member belonging to the same business. Customers cannot self-redeem.
- **Operational Actor Attribution:** When an `OWNER` performs redemption, the system automatically resolves or creates an operational `Staff` record linked to the owner's `User` via `resolveStaffRecord()`. This guarantees `redeemedByStaffId` foreign key integrity without relaxing database constraints.
- `redeemedByStaffId` must belong to the same business as the `LoyaltyCycle`'s program. Enforced by application.
- `MilestoneReward` records are **never deleted**. Historical reward records must remain preserved exactly as they were when earned.
- Redeeming an intermediate milestone reward does **not** complete the loyalty cycle. Cycle completion is determined solely by `visitCount === cycleLength`.
- **Decoupled Reward Lifecycle & Physical Store Visit:** Milestone rewards are unlocked immediately when the qualifying visit reaches the milestone. Reward redemption is a separate transaction: it does NOT require a `VisitRequest`, does NOT increment `LoyaltyCycle.visitCount`, and does NOT start a new cycle. However, because reward redemption represents a real physical customer store visit, it atomically creates a `Visit` record with `visitType = REWARD_REDEMPTION`, `visitRequestId = null`, and `visitNumberInCycle = null` for accurate business and customer analytics. A separate `RewardVisit` model is not used.

---

## 8. RewardClaim

**Purpose:** Short-lived, high-entropy claim entity used exclusively for the **Claim Reward Visit** flow. When a customer's upcoming qualifying visit coincides with a configured reward milestone, this model replaces the standard `VisitRequest` and enables single-scan atomic approval, visit recording, and reward redemption.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | No | Primary key |
| `customerProfileId` | UUID FK → `CustomerProfile.id` | No | The customer profile claiming the reward visit |
| `loyaltyCycleId` | UUID FK → `LoyaltyCycle.id` | Yes | Active cycle if customer has started, or null if Cycle 1 has not yet been initialized |
| `programId` | UUID FK → `LoyaltyProgram.id` | No | The active loyalty program |
| `branchId` | UUID FK → `Branch.id` | No | Branch where the claim was created |
| `milestoneId` | UUID FK → `Milestone.id` | No | Milestone attached to this qualifying visit |
| `expectedVisitNumber` | Integer | No | The exact visit number this claim will fulfill (`currentVisitCount + 1`) |
| `tokenHash` | String | No | Unique SHA-256 hash of raw token (`RC-XXXX-XXXX-XXXX`) |
| `status` | `RewardClaimStatus` enum | No | `PENDING`, `CONSUMED`, `EXPIRED`. Default: `PENDING` |
| `expiresAt` | DateTime | No | Expiration timestamp (15-minute TTL) |
| `consumedAt` | DateTime | Yes | Timestamp when staff confirmed the claim |
| `consumedByStaffId` | UUID FK → `Staff.id` | Yes | Staff member who confirmed the claim |
| `createdAt` | DateTime | No | Audit timestamp |
| `updatedAt` | DateTime | No | Audit timestamp |

**Rules:**
- **Short TTL:** Generated with a strict 15-minute expiration timestamp (`expiresAt = now + 15m`).
- **Single Pending Invariant:** Generating a new `RewardClaim` for a customer and branch immediately sets any existing `PENDING` claims for that customer and branch to `EXPIRED`.
- **Token Security:** Raw token `RC-XXXX-XXXX-XXXX` is never stored in the database. Only a deterministic SHA-256 hash is saved in `tokenHash` with `@unique` index.
- **Atomic Confirmation:** Confirming the claim atomically consumes the claim (`status = CONSUMED`), records a `QUALIFYING` visit (`visitNumberInCycle = expectedVisitNumber`), advances `LoyaltyCycle.visitCount`, unlocks and redeems the `MilestoneReward` (`status = REDEEMED`), and creates an analytics `REWARD_REDEMPTION` visit.
- **Visit State Guard:** Confirmation verifies that `activeCycle.visitCount + 1 === expectedVisitNumber`. If customer state changed between token generation and scan, the transaction safely rejects with `409 Conflict`.

---

## 9. Enums

All enums are defined at the Prisma/database level and enforced as PostgreSQL native enum types.

---

### `UserRole`

Used on: `User.role`

```
OWNER   — Business owner with full access to their business
STAFF   — Staff member with operational access to their assigned branch
```

Customers are **never** assigned a `UserRole`. They do not exist in the `User` table.

---

### `RewardType`

Used on: `Milestone.rewardType`

```
NONE              — No reward. Milestone is a visit checkpoint only.
PERCENT_DISCOUNT  — Percentage discount off a purchase.
FIXED_DISCOUNT    — Fixed monetary amount discount.
FREE_ITEM         — A free item or custom reward (described in rewardName/rewardDescription).
```

Only milestones with `PERCENT_DISCOUNT`, `FIXED_DISCOUNT`, or `FREE_ITEM` create a `MilestoneReward` record.

---

### `LoyaltyCycleStatus`

Used on: `LoyaltyCycle.status`

```
ACTIVE     — The customer is currently progressing through this cycle.
COMPLETED  — visitCount reached cycleLength. Cycle is closed. Historical record only.
```

---

### `VisitRequestStatus`

Used on: `VisitRequest.status`

```
PENDING   — Request created by customer. Awaiting staff action.
APPROVED  — Staff approved the request. A Visit record was created.
REJECTED  — Staff rejected the request. No Visit was created.
```

Only `PENDING → APPROVED` and `PENDING → REJECTED` transitions are valid. Resolved requests cannot be re-resolved.

---

### `VisitType`

Used on: `Visit.visitType`

```
QUALIFYING        — A customer visit that earns a loyalty stamp. Increments LoyaltyCycle.visitCount.
REWARD_REDEMPTION — A customer visit where an unlocked reward is redeemed. Recorded for analytics; does NOT increment visitCount.
```

---

### `MilestoneRewardStatus`

Used on: `MilestoneReward.status`

```
UNLOCKED  — Reward has been earned. Customer may present it for redemption.
REDEEMED  — Staff has confirmed redemption. Cannot be redeemed again.
```

---

### `RewardClaimStatus`

Used on: `RewardClaim.status`

```
PENDING   — Claim token generated by customer. Awaiting staff scan and confirmation.
CONSUMED  — Claim confirmed by staff. Qualifying visit and reward redemption atomically completed.
EXPIRED   — Token expired or superseded by a newer claim.
```

---

## 10. Relationships and Foreign Keys

| From | To | Relationship | Required | On Delete |
|---|---|---|---|---|
| `Business` | `User` (via `ownerId`) | Many-to-one | Required | Restrict — cannot delete a User who owns a Business |
| `Branch` | `Business` | Many-to-one | Required | Restrict — deactivate business instead of deleting |
| `Staff` | `User` | Many-to-one | Required | Restrict — deactivate staff instead of deleting User |
| `Staff` | `Business` | Many-to-one | Required | Restrict |
| `Staff` | `Branch` | Many-to-one | Required | Restrict |
| `Customer` | _(none — platform level)_ | — | — | — |
| `CustomerProfile` | `Customer` | Many-to-one | Required | Restrict — customers should not be deleted |
| `CustomerProfile` | `Business` | Many-to-one | Required | Restrict |
| `LoyaltyProgram` | `Business` | Many-to-one | Required | Restrict |
| `LoyaltyProgram` | `Branch` | Many-to-one | Required | Restrict |
| `Milestone` | `LoyaltyProgram` | Many-to-one | Required | Restrict — do not cascade-delete milestones without reviewing active cycles |
| `LoyaltyCycle` | `CustomerProfile` | Many-to-one | Required | Restrict — loyalty history must be preserved |
| `LoyaltyCycle` | `LoyaltyProgram` | Many-to-one | Required | Restrict — programs with active/historical cycles cannot be deleted |
| `Visit` | `LoyaltyCycle` | Many-to-one | Required | Restrict — visits are permanent records |
| `Visit` | `VisitRequest` (unique) | One-to-one | Optional | Restrict (null for reward redemptions & claim visits) |
| `Visit` | `Branch` | Many-to-one | Required | Restrict |
| `Visit` | `Staff` (via `approvedByStaffId`) | Many-to-one | Required | Restrict |
| `VisitRequest` | `CustomerProfile` | Many-to-one | Required | Restrict |
| `VisitRequest` | `Branch` | Many-to-one | Required | Restrict |
| `VisitRequest` | `Staff` (via `resolvedByStaffId`) | Many-to-one | Optional | Restrict — never hard-delete Staff |
| `MilestoneReward` | `LoyaltyCycle` | Many-to-one | Required | Restrict |
| `MilestoneReward` | `Milestone` | Many-to-one | Required | Restrict |
| `MilestoneReward` | `Staff` (via `redeemedByStaffId`) | Many-to-one | Optional | Restrict — never hard-delete Staff |
| `RewardClaim` | `CustomerProfile` | Many-to-one | Required | Restrict |
| `RewardClaim` | `LoyaltyCycle` | Many-to-one | Optional | Restrict (null if Cycle 1 uninitialized) |
| `RewardClaim` | `LoyaltyProgram` | Many-to-one | Required | Restrict |
| `RewardClaim` | `Branch` | Many-to-one | Required | Restrict |
| `RewardClaim` | `Milestone` | Many-to-one | Required | Restrict |
| `RewardClaim` | `Staff` (via `consumedByStaffId`) | Many-to-one | Optional | Restrict (null until confirmed) |

### Delete Behavior Principles

- **Restrict** is the default for all foreign keys where deletion would destroy historical data.
- **Cascade deletes** are not used on loyalty-related entities (`LoyaltyCycle`, `Visit`, `MilestoneReward`, `VisitRequest`). Destroying a parent must not silently erase a customer's history.
- **Soft deactivation** (`isActive = false`) is preferred over hard deletes for operational entities (Business, Branch, Staff, LoyaltyProgram).

---

## 11. Unique Constraints

| Constraint | Fields | Notes |
|---|---|---|
| User email uniqueness | `User.email` | One account per email |
| Customer phone uniqueness | `Customer.phone` | One customer record per phone number globally |
| Branch QR token uniqueness | `Branch.qrToken` | QR tokens must be globally unique |
| Customer-business relationship | `(CustomerProfile.customerId, CustomerProfile.businessId)` | One profile per customer per business |
| Milestone uniqueness per program | `(Milestone.programId, Milestone.visitNumber)` | One milestone per visit number per program |
| Loyalty cycle uniqueness | `(LoyaltyCycle.customerProfileId, LoyaltyCycle.programId, LoyaltyCycle.cycleNumber)` | One cycle record per number per customer+program |
| Milestone reward uniqueness per cycle | `(MilestoneReward.loyaltyCycleId, MilestoneReward.milestoneId)` | A milestone can only be unlocked once per cycle |
| One visit per visit request | `VisitRequest.id` on `Visit.visitRequestId` | Unique FK — one visit per approved request |
| Reward claim token hash uniqueness | `RewardClaim.tokenHash` | High-entropy SHA-256 hash for O(1) claim token lookup |

---

### One Active Program Per Branch

The MVP requires that each branch has at most one `isActive = true` loyalty program at any time.

**A standard composite unique constraint cannot enforce this** because a `UNIQUE(branchId, isActive)` constraint would prevent a branch from ever having more than one program regardless of `isActive` value — it would block having both an active and an inactive program for the same branch.

**The correct approach is a PostgreSQL partial unique index:**

```sql
CREATE UNIQUE INDEX unique_active_program_per_branch
ON "LoyaltyProgram" ("branchId")
WHERE "isActive" = true;
```

This allows multiple inactive programs per branch but enforces that **at most one active program per branch** exists at any time, even under concurrent request conditions. The application layer checks for an existing active program and returns `409 Conflict` before attempting to activate a second one. The partial index is the final safety net if the application check is bypassed by a race condition.

### One Active Cycle Per Customer Program

Similarly, the system must allow only one `ACTIVE` LoyaltyCycle for a given customer and program.

```sql
CREATE UNIQUE INDEX unique_active_cycle_per_customer_program
ON "LoyaltyCycle" ("customerProfileId", "programId")
WHERE "status" = 'ACTIVE';
```

While the application transaction handles cycle creation and completion safely, this database constraint provides a strict concurrency safety guarantee, ensuring two concurrent operations cannot accidentally create two ACTIVE cycles.

> **Note for Prisma schema:** Prisma does not natively support partial unique indexes via `@@unique`. These constraints must be added as a raw SQL migration (`prisma db execute` or a custom migration file) after the models are defined.

---

## 12. Indexing Strategy

Indexes are defined based on the most frequent query patterns. Every foreign key column should be indexed by default in Prisma (Prisma adds these automatically for relation fields). Additional indexes below are for query patterns beyond simple FK lookups.

| Index | Fields | Purpose |
|---|---|---|
| `Business.ownerId` | `ownerId` | Look up a business by its owner (login → business resolution) |
| `Branch.businessId` | `businessId` | List all branches for a business |
| `Staff.businessId` | `businessId` | List all staff for a business |
| `Staff.branchId` | `branchId` | List staff assigned to a branch |
| `CustomerProfile.customerId` | `customerId` | Find all business relationships for a customer |
| `CustomerProfile.businessId` | `businessId` | List all customers for a business (owner dashboard) |
| `LoyaltyProgram.businessId` | `businessId` | List programs for a business |
| `LoyaltyProgram.branchId` | `branchId` | Find the active program for a branch (QR resolution) |
| `Milestone.programId` | `programId` | Fetch all milestones for a program (loyalty evaluation) |
| `LoyaltyCycle.customerProfileId` | `customerProfileId` | Find a customer's cycles within a business |
| `LoyaltyCycle.programId` | `programId` | Find all cycles for a program |
| `LoyaltyCycle.(customerProfileId, programId, status)` | Composite | Find the ACTIVE cycle for a customer+program — this is the hottest query in the loyalty engine and runs on every visit approval |
| `VisitRequest.customerProfileId` | `customerProfileId` | Customer's request history |
| `VisitRequest.branchId` | `branchId` | Pending requests for a branch (staff dashboard) |
| `VisitRequest.(branchId, status)` | Composite | Filter pending requests for a branch — used constantly by the staff dashboard |
| `Visit.loyaltyCycleId` | `loyaltyCycleId` | Visit history within a cycle |
| `Visit.branchId` | `branchId` | Visit history for a branch |
| `Visit.(branchId, visitType)` | Composite | High-speed branch filtering by visit type (qualifying vs reward) |
| `MilestoneReward.loyaltyCycleId` | `loyaltyCycleId` | Rewards earned within a cycle |
| `MilestoneReward.(loyaltyCycleId, status)` | Composite | Filter unlocked/redeemed rewards within a cycle |
| `RewardClaim.customerProfileId` | `customerProfileId` | Look up active or historical claims by customer |
| `RewardClaim.branchId` | `branchId` | Filter claims scoped to a physical store branch |
| `RewardClaim.(branchId, status)` | Composite | Fast lookup of pending claims for a branch |
| `RewardClaim.tokenHash` | `tokenHash` | Unique index lookup during token validation and confirmation |
| `RewardClaim.expiresAt` | `expiresAt` | Fast TTL checks and background expiration sweeps |

**Guidance:**

- Do not add indexes speculatively. The above indexes are justified by known MVP query patterns.
- Composite indexes are listed where a combined filter is more efficient than individual column indexes.
- The `(customerProfileId, programId, status)` index on `LoyaltyCycle` is particularly important — it is used on every visit approval to find the current `ACTIVE` cycle.
- Prisma generates indexes for `@relation` fields automatically; these must be verified in the generated migration.

---

## 13. Tenant Isolation

**`Business` is the primary tenant.** Every record in the system is either:

1. Platform-level (`Customer`) — not owned by any single business.
2. Business-owned — reachable from `businessId` either directly or via a verified relationship chain.

### Ownership Chain for Business-Owned Data

```
Business
 └── Branch (direct businessId)
 └── LoyaltyProgram (direct businessId + branchId → businessId)
 └── Milestone (via LoyaltyProgram.businessId)
 └── Staff (direct businessId)
 └── CustomerProfile (direct businessId)
      └── LoyaltyCycle (via CustomerProfile.businessId)
           └── Visit (via LoyaltyCycle → CustomerProfile.businessId)
           └── MilestoneReward (via LoyaltyCycle → CustomerProfile.businessId)
           └── RewardClaim (via CustomerProfile.businessId + Branch.businessId)
 └── VisitRequest (via Branch.businessId)
```

### Cross-Business Isolation Examples

| Actor | Attempted action | Allowed? |
|---|---|---|
| Business A staff | Approve a VisitRequest from Business B's branch | ❌ No |
| Business A owner | View CustomerProfiles belonging to Business B | ❌ No |
| Business A owner | Modify Business B's loyalty program | ❌ No |
| Customer (global) | Scan Business A QR and participate | ✅ Yes (creates CustomerProfile for Business A) |
| Customer (global) | Have separate progress at Business A and Business B | ✅ Yes (separate CustomerProfile per business) |
| Business A | See customer's activity at Business B | ❌ No |

### Database vs. Application Enforcement

Database foreign keys and unique constraints enforce structural integrity (e.g., a `LoyaltyCycle` cannot reference a `CustomerProfile` that doesn't exist). However, **cross-business isolation is a business rule** — PostgreSQL cannot automatically prevent Business A from querying Business B's data.

Isolation is enforced by:

1. **Application-level `WHERE businessId = ?` filtering** on every business-scoped query.
2. **JWT payload checks** — `businessId` is resolved from the authenticated user's token, not from client input.
3. **Service-layer ownership verification** before any mutation.

The database schema supports isolation through the presence of `businessId` on every business-owned table. It is the application's responsibility to use it correctly on every query.

---

## 14. Delete / Archive Strategy

### General Principle

**Prefer soft deactivation over hard deletion** for all records that have operational significance or where deletion would break historical data.

Hard deletes are avoided for loyalty records because:

- A customer's visit history and earned rewards must remain visible to the business even after a program ends.
- Staff members who approved visits in the past must remain referenced by `Visit` and `MilestoneReward` records.
- Completed `LoyaltyCycle` records are permanent historical documents.

---

### Per-Entity Deletion Policy

| Entity | Strategy | Notes |
|---|---|---|
| `Business` | Soft — `isActive` (if added) or status field | Hard delete not supported in MVP. Deactivation prevents new operations. |
| `Branch` | Soft — `isActive = false` | Inactive branches cannot accept new `VisitRequest` records. |
| `User` (OWNER/STAFF) | Soft — deactivate `Staff.isActive` | The underlying `User` record must not be hard-deleted if referenced by historical `Visit` or `MilestoneReward` records. |
| `Staff` | Soft — `Staff.isActive = false` | Deactivated staff cannot log in or perform new staff operations, but their historical approvals remain intact. Foreign keys used for historical records remain valid. Hard deletion of Staff is not supported in MVP. |
| `Customer` | **No delete in MVP** | A Customer record must not be hard-deleted because it may have CustomerProfile records, LoyaltyCycle history, Visit history, and MilestoneReward history. Customer deletion/anonymization workflows are not supported in MVP. |
| `CustomerProfile` | **No delete in MVP** | Preserves customer history within a business. |
| `LoyaltyProgram` | Soft — `isActive = false` | Programs with historical cycles must not be hard-deleted. |
| `Milestone` | Restricted | Cannot be deleted if referenced by an existing `MilestoneReward`. Consider soft disable (`isEnabled = false`) instead. |
| `LoyaltyCycle` | **Never delete** | Permanent historical record. |
| `Visit` | **Never delete** | Permanent historical record. |
| `VisitRequest` | **Never delete** | Kept for audit purposes regardless of outcome. |
| `MilestoneReward` | **Never delete** | Permanent record of earned and redeemed rewards. |
| `RewardClaim` | **Never delete** | Kept for audit trail of claim creations, consumptions, and expirations. |

---

### Cascade Behavior

All foreign key relationships in the loyalty domain use **Restrict** as the on-delete behavior. This means:

- Attempting to delete a `LoyaltyProgram` that has `LoyaltyCycle` records will fail at the database level.
- Attempting to delete a `Customer` who has `CustomerProfile` records will fail at the database level.
- This is intentional — it prevents accidental destructive operations from the application layer.

Cascade deletes are **not used** on any loyalty-related table.

---

## 15. Loyalty Transaction and Concurrency Rules

The loyalty system implements two distinct write transactions to ensure thread-safe, atomic operations:
1. **Normal Visit Request Approval Transaction** (Customer requests stamp → Staff approves)
2. **Claim Reward Visit Confirmation Transaction** (Customer shows claim QR → Staff scans & confirms single atomic transaction)

---

### Transaction 1: Normal Visit Request Approval

Approving a visit request is atomic — all writes succeed together or none do.

```
BEGIN TRANSACTION

  1. Fetch and atomically claim VisitRequest by ID:
     Conditional update: WHERE id = :id AND status = 'PENDING' AND branchId = :staffBranchId
     If count === 0 → abort with 409 CONFLICT (already resolved or concurrent race).

  2. Verify staff is active and authorized for the branch's business.

  3. Resolve the active LoyaltyProgram for the branch.
     If no active program → abort with 422 UNPROCESSABLE_ENTITY.

  4. Find the customer's ACTIVE LoyaltyCycle for this program.
     If none exists → lazily create LoyaltyCycle (cycleNumber = nextCycleNumber, visitCount = 0, status = ACTIVE).
     Gracefully catch concurrent creation race (re-query active cycle if P2002 partial index collision occurs).

  5. Increment LoyaltyCycle.visitCount by 1:
     newVisitCount = visitCount + 1

  6. Create a Visit record:
       loyaltyCycleId = current cycle ID
       visitRequestId = VisitRequest.id  (unique — prevents duplicates)
       branchId = VisitRequest.branchId
       visitNumberInCycle = newVisitCount
       approvedByStaffId = authenticated staff ID
       createdAt = now

  7. Find any enabled Milestone where visitNumber = newVisitCount for this program.
     If found AND milestone.rewardType != NONE:
       Create MilestoneReward:
         loyaltyCycleId = current cycle ID
         milestoneId = matched milestone ID
         status = UNLOCKED
         snapshotRewardType = milestone.rewardType
         snapshotRewardValue = milestone.rewardValue
         snapshotRewardName = milestone.rewardName
         snapshotRewardDescription = milestone.rewardDescription
         unlockedAt = now

  8. Check cycle completion:
     If newVisitCount === loyaltyProgram.cycleLength:
       Update LoyaltyCycle: status = COMPLETED, completedAt = now, visitCount = newVisitCount
       (Lazy Rollover: DO NOT create empty Cycle N+1 yet. Cycle N+1 will be created when next visit is approved.)
     Else:
       Update LoyaltyCycle: visitCount = newVisitCount

COMMIT
```

---

### Transaction 2: Claim Reward Visit Confirmation

When a customer's upcoming visit is a reward milestone, the **Claim Reward Visit** transaction executes all writes atomically in a single PostgreSQL transaction:

```
BEGIN TRANSACTION

  1. Atomically consume RewardClaim by ID and condition:
     Conditional update: WHERE id = :claimId AND status = 'PENDING' AND expiresAt > now()
     data: status = 'CONSUMED', consumedAt = now(), consumedByStaffId = operationalStaff.id
     If count === 0:
       Query claim status to return precise error:
       - status == 'CONSUMED' → abort with 409 CONFLICT ("Already redeemed")
       - status == 'EXPIRED' or expired TTL → abort with 410 GONE ("Token expired")
       - other → abort with 409 CONFLICT

  2. Resolve active LoyaltyProgram for the branch (with enabled milestones).
     If no active program → abort with 422 UNPROCESSABLE_ENTITY.

  3. Find or lazily create active LoyaltyCycle for customer and program.
     Gracefully catch concurrent creation race (P2002 partial index collision).

  4. State verification:
     Verify expectedVisitNumber === activeCycle.visitCount + 1.
     If mismatch (e.g. customer visit state shifted) → abort with 409 CONFLICT.

  5. Verify milestone and duplicate reward prevention:
     Verify milestone exists, is enabled, and rewardType != NONE.
     Verify MilestoneReward does not already exist for (activeCycle.id, milestone.id).
     If duplicate reward exists → abort with 409 CONFLICT.

  6. Step 1: Create QUALIFYING Visit:
     data:
       loyaltyCycleId = activeCycle.id
       visitRequestId = null (no VisitRequest involved)
       branchId = claim.branchId
       visitType = QUALIFYING
       visitNumberInCycle = expectedVisitNumber
       approvedByStaffId = operationalStaff.id
       createdAt = now()

  7. Step 2 & 3: Advance cycle progress:
     newVisitCount = activeCycle.visitCount + 1
     isCycleCompleted = newVisitCount >= activeProgram.cycleLength
     Update LoyaltyCycle:
       visitCount = newVisitCount
       if isCycleCompleted: status = 'COMPLETED', completedAt = now()

  8. Step 4, 5, 6: Create snapshotted MilestoneReward and immediately REDEEM:
     data:
       loyaltyCycleId = activeCycle.id
       milestoneId = milestone.id
       snapshotRewardType = milestone.rewardType
       snapshotRewardValue = milestone.rewardValue
       snapshotRewardName = milestone.rewardName
       snapshotRewardDescription = milestone.rewardDescription
       status = 'REDEEMED'
       unlockedAt = now()
       redeemedAt = now()
       redeemedByStaffId = operationalStaff.id

  9. Step 7: Create REWARD_REDEMPTION Visit (footfall analytics only):
     data:
       loyaltyCycleId = activeCycle.id
       visitRequestId = null
       branchId = claim.branchId
       visitType = REWARD_REDEMPTION
       visitNumberInCycle = null (strictly isolated from cycle progress)
       approvedByStaffId = operationalStaff.id
       createdAt = now()

  10. If claim record had null loyaltyCycleId, link loyaltyCycleId = activeCycle.id.

COMMIT (Rollback all on any error)
```

### Concurrency Hazards & Defenses

1. **Double Approval / Double Consumption:**
   - Handled via atomic conditional updates (`WHERE id = :id AND status = 'PENDING'`). Only the first concurrent worker updates the row and proceeds; all others receive `count === 0` and cleanly abort with `409 Conflict`.
2. **Double Reward Redemption:**
   - Unlocked rewards redeemed via token check `status === 'UNLOCKED'` conditionally.
   - Reward claims check `status === 'PENDING'` conditionally.
   - Composite unique constraint `@@unique([loyaltyCycleId, milestoneId])` on `MilestoneReward` provides a hard database safety barrier against duplicate reward creation.

---

## 16. Data Integrity Rules

The following invariants must hold at all times. They are enforced through a combination of database constraints, foreign keys, unique constraints, and application-layer validation.

| Invariant | Enforcement |
|---|---|
| `LoyaltyProgram.businessId` must match `Branch.businessId` for the program's `branchId` | Application validation on program creation/update. PostgreSQL cannot enforce a cross-row constraint without a trigger. |
| `Staff.businessId` must match `Branch.businessId` for the staff's `branchId` | Application validation on staff creation. |
| `Milestone.visitNumber` must be ≤ `LoyaltyProgram.cycleLength` for the milestone's program | Application validation on milestone creation/update. |
| `LoyaltyCycle.customerProfileId` must belong to the same business as `LoyaltyCycle.programId`'s business | Application validation when creating a cycle. |
| `Visit.branchId` must match `LoyaltyProgram.branchId` for the cycle's program | Application validation inside the approval transaction. |
| `Visit.visitNumberInCycle` must equal `LoyaltyCycle.visitCount` after incrementing (before writing) | Enforced inside the approval transaction. |
| `MilestoneReward.milestoneId` must belong to the same `LoyaltyProgram` as the `LoyaltyCycle` | Application validation inside the milestone evaluation step. |
| There is at most one `ACTIVE` LoyaltyCycle per `(customerProfileId, programId)` | Partial unique index on `LoyaltyCycle` where `status = ACTIVE` and application-level check inside transaction. |
| `MilestoneReward` is only created for milestones with `rewardType != NONE` | Enforced in the milestone evaluation step of the approval transaction. Application-level rule. |
| A `MilestoneReward` cannot be redeemed twice (`status` transitions only `UNLOCKED → REDEEMED`) | Application-level check returning `409 Conflict` if already `REDEEMED`. Unique constraint on `(loyaltyCycleId, milestoneId)` prevents duplicate records. |
| `VisitRequest.status` can only transition `PENDING → APPROVED` or `PENDING → REJECTED` | Application-level state machine check before writing. |
| `RewardClaim.status` can only transition `PENDING → CONSUMED` or `PENDING → EXPIRED` | Application-level state machine check before writing. |
| One `Visit` per `VisitRequest` | `UNIQUE` constraint on `Visit.visitRequestId`. |
| One `RewardClaim` per unique `tokenHash` | `UNIQUE` constraint on `RewardClaim.tokenHash`. |

**PostgreSQL limitations on cross-table constraints:**

PostgreSQL `CHECK` constraints cannot reference other tables. Cross-table invariants (e.g., "branch business must match program business") cannot be enforced by a column constraint alone. They require either:

- Application-layer validation (preferred for MVP), or
- PostgreSQL triggers (added complexity, avoid in MVP unless necessary).

These invariants are listed above explicitly so they are not accidentally omitted during implementation.

---

## 17. Prisma Design Notes

This section describes how the above database design is expressed in Prisma's schema language.

### Naming Conventions

| Type | Convention | Examples |
|---|---|---|
| Model names | PascalCase singular | `User`, `LoyaltyProgram`, `MilestoneReward`, `RewardClaim` |
| Field names | camelCase | `businessId`, `visitCount`, `cycleLength`, `tokenHash` |
| Enum names | PascalCase | `UserRole`, `RewardType`, `LoyaltyCycleStatus`, `RewardClaimStatus` |
| Enum values | SCREAMING_SNAKE_CASE | `PERCENT_DISCOUNT`, `FREE_ITEM`, `ACTIVE`, `CONSUMED` |
| Relation names | camelCase, descriptive | `loyaltyCycles`, `milestoneRewards`, `approvedBy` |

### Primary Keys

All models use UUID primary keys:

```prisma
id  String  @id @default(uuid())
```

Do not use auto-incrementing integer IDs for any model. UUIDs prevent enumeration attacks and are appropriate for a multi-tenant SaaS.

### Timestamps

All models include `createdAt`. Mutable models include `updatedAt`:

```prisma
createdAt  DateTime  @default(now())
updatedAt  DateTime  @updatedAt
```

`VisitRequest` uses `requestedAt` and `resolvedAt` instead of standard timestamps (they carry semantic meaning).

### Unique Constraints

Single-field uniqueness:

```prisma
email  String  @unique
```

Composite uniqueness:

```prisma
@@unique([customerId, businessId])
@@unique([customerProfileId, programId, cycleNumber])
@@unique([loyaltyCycleId, milestoneId])
@@unique([visitRequestId])       // on Visit — one-to-one with VisitRequest
@@unique([tokenHash])            // on RewardClaim — unique indexed SHA-256 hash
@@unique([redemptionTokenHash])  // on MilestoneReward — unique indexed SHA-256 hash
```

### Partial Unique Index (One Active Program Per Branch)

Prisma does not support partial unique indexes natively. This must be added as a raw SQL statement in a custom migration:

```sql
CREATE UNIQUE INDEX unique_active_program_per_branch
ON "LoyaltyProgram" ("branchId")
WHERE "isActive" = true;
```

This is created after the base migration runs and must be documented in the migration file.

### Indexes

Indexes are defined using:

```prisma
@@index([businessId])
@@index([branchId, status])
@@index([customerProfileId, programId, status])
@@index([tokenHash])
```

The `(customerProfileId, programId, status)` index on `LoyaltyCycle` is the most important performance index in the schema.

### Nullable Fields

- Fields that are truly optional are marked `?` in Prisma (e.g., `address`, `description`, `resolvedAt`, `completedAt`, `redeemedAt`, `visitRequestId`, `loyaltyCycleId` on RewardClaim).
- Fields that are required have no `?`.
- `branchId` on `LoyaltyProgram` is **not nullable**. Do not add `?`.

### Decimal Fields

`rewardValue` on `Milestone` (and snapshot fields on `MilestoneReward` if adopted) should use Prisma's `Decimal` type, which maps to PostgreSQL `DECIMAL`/`NUMERIC`:

```prisma
rewardValue  Decimal?  @db.Decimal(10, 2)
```

Do not use `Float` for monetary or percentage values.

### Enums

Defined in the schema:

```prisma
enum UserRole {
  OWNER
  STAFF
}

enum RewardType {
  NONE
  PERCENT_DISCOUNT
  FIXED_DISCOUNT
  FREE_ITEM
}

enum LoyaltyCycleStatus {
  ACTIVE
  COMPLETED
}

enum VisitRequestStatus {
  PENDING
  APPROVED
  REJECTED
}

enum VisitType {
  QUALIFYING
  REWARD_REDEMPTION
}

enum MilestoneRewardStatus {
  UNLOCKED
  REDEEMED
}

enum RewardClaimStatus {
  PENDING
  CONSUMED
  EXPIRED
}
```

### Relations

Named relations are required when two models have more than one relation between them (e.g., `Staff` referenced as both `resolvedByStaffId` and `approvedByStaffId` in different models). Prisma requires disambiguation via `@relation(name: "...")` in these cases.

### Migration Strategy

- All schema changes are applied via `prisma migrate dev` (development) and `prisma migrate deploy` (production).
- Direct DDL on the production database is prohibited.
- The partial unique indexes (for one-active-program-per-branch and one-active-cycle-per-customer) are added in manually edited migration files.

---

## 18. Open Decisions

All database-level architectural decisions have been finalized and verified against automated concurrency and transaction tests.
