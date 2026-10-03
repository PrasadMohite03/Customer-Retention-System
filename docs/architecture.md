# Technical Architecture

> **Status:** Draft — MVP Phase  
> **Last Updated:** 2026-10-02 (Loyalty Program module complete: branch-scoped programs, ACTIVE/INACTIVE lifecycle, programId-based status endpoint, owner management list)  
> **Audience:** Developers and AI coding agents implementing this product.  
> **Source of truth for product requirements:** [`docs/product.md`](./product.md)

---

## 1. Architecture Overview

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| Backend | Node.js, Express.js, TypeScript |
| API Style | REST |
| ORM | Prisma |
| Database | PostgreSQL |
| Validation | Zod (backend and frontend) |
| Server State (FE) | TanStack Query (React Query) |
| Auth | JWT (access token) + HTTP-only refresh token cookie |
| OTP Delivery | Third-party SMS provider (e.g., Twilio, MSG91) |

### High-Level Data Flow

```
Customer / Owner / Staff (Browser)
        │
        │  HTTPS
        ▼
  React + Vite SPA
        │
        │  REST API calls (JSON)
        ▼
  Express.js API Server (Node.js + TypeScript)
        │
        ├── Auth middleware (JWT validation)
        ├── Authorization guards (role + businessId)
        ├── Route handlers
        ├── Service layer (business logic)
        │
        │  Prisma Client
        ▼
  PostgreSQL Database
```

### Deployment Approach (MVP)

- **Frontend:** Static build deployed to a CDN or static hosting (e.g., Vercel, Netlify, or an S3-backed CloudFront distribution).
- **Backend:** Single Node.js process deployed on a managed platform (e.g., Railway, Render, Fly.io, or a small VPS). No microservices.
- **Database:** Managed PostgreSQL instance (e.g., Railway Postgres, Supabase, Neon, or AWS RDS).
- **Environment secrets:** Managed via platform environment variable injection. Never committed to source control.

The MVP runs as a monolithic backend. Do not split into microservices until a demonstrated need exists.

---

## 2. Project Structure

```
customer-retention-project/
├── docs/
│   ├── product.md          # Product requirements (source of truth)
│   └── architecture.md     # This document
│
├── frontend/               # React + Vite SPA
│   ├── public/
│   ├── src/
│   │   ├── api/            # API client functions (typed fetch wrappers)
│   │   ├── components/     # Reusable UI components
│   │   │   ├── ui/         # Generic primitives (Button, Input, Card, etc.)
│   │   │   └── loyalty/    # Domain-specific components
│   │   ├── hooks/          # Custom React hooks (including TanStack Query hooks)
│   │   ├── pages/          # Page-level route components
│   │   │   ├── owner/      # Business owner pages
│   │   │   ├── staff/      # Staff dashboard pages
│   │   │   └── customer/   # Customer-facing pages (QR landing, loyalty view)
│   │   ├── store/          # Local UI state (React context or Zustand if needed)
│   │   ├── types/          # Frontend TypeScript types (may mirror shared/)
│   │   ├── lib/            # Utilities (formatters, validators, etc.)
│   │   ├── routes/         # Router configuration
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── backend/                # Node.js + Express API
│   ├── src/
│   │   ├── routes/         # Express route definitions (thin — delegate to services)
│   │   ├── controllers/    # Request/response handlers
│   │   ├── services/       # Business logic (loyalty engine, OTP, QR, etc.)
│   │   ├── middleware/      # Auth, authorization, error handling, rate limiting
│   │   ├── validators/     # Zod schemas for request bodies/params/query
│   │   ├── lib/            # Shared utilities (prisma client, token helpers, etc.)
│   │   ├── types/          # Backend-specific TypeScript types
│   │   └── app.ts          # Express app setup
│   ├── prisma/
│   │   ├── schema.prisma   # Prisma data model
│   │   └── migrations/     # Database migration history
│   ├── server.ts           # Entry point
│   └── tsconfig.json
│
└── shared/                 # (Optional) Types shared between frontend and backend
    └── types/
        └── index.ts        # Shared request/response DTOs, enums, etc.
```

### Key structural rules

- Frontend and backend are separate packages (separate `package.json`, separate `tsconfig.json`).
- Frontend never imports from backend directly; communication is exclusively via REST API.
- Business logic belongs in `backend/src/services/`, not in controllers or routes.
- Controllers are thin: validate input, call a service, return a response.
- All database access goes through Prisma — no raw SQL unless there is a documented performance reason.

---

## 3. User Roles & Authorization

### Roles

| Role | Description |
|---|---|
| `OWNER` | Business owner who manages the loyalty program, branches, staff, and analytics. |
| `STAFF` | Employee who operates the loyalty program at a branch (approves/rejects visit requests). |
| `CUSTOMER` | End customer who participates in loyalty programs via QR scan and phone verification. |

### Authentication vs. Authorization

- **Authentication** establishes *who* the user is (via JWT or OTP).
- **Authorization** enforces *what* they are allowed to do (checked server-side on every request).

Authentication alone is never sufficient. Every protected route must also verify the authenticated user's role and their relationship to the resource being accessed.

### Identity Models

Owners/Staff and Customers are **separate identity models** with different authentication mechanisms and different JWT payloads.

| Identity | Authentication | JWT Payload |
|---|---|---|
| `OWNER` | Email + Password | `{ userId, role: "OWNER", businessId }` |
| `STAFF` | Email + Password | `{ userId, role: "STAFF", businessId }` |
| `CUSTOMER` | Phone + OTP | `{ customerId, role: "CUSTOMER" }` |

Customers are **not** stored in the `User` model. They are stored in the `Customer` model and authenticate exclusively via phone + OTP. There is no email/password for customers.

### Token Strategy

- On login (OWNER/STAFF) or OTP verification (CUSTOMER), the backend issues a short-lived **JWT access token** (e.g., 15 minutes) and a long-lived **HTTP-only refresh token cookie** (e.g., 7 days).
- The frontend sends the access token as a `Authorization: Bearer <token>` header.
- The frontend never has access to the refresh token cookie — it is HTTP-only.
- The customer JWT payload identifies the customer via `customerId`. There is no `userId` or `businessId` in a customer token.
- The owner/staff JWT payload includes `userId`, `role`, and `businessId`.

### Authorization Enforcement

Authorization is always enforced on the **backend**. The frontend may conditionally render UI for UX purposes, but backend routes must independently verify permissions.

| Check | Where Enforced |
|---|---|
| Is the user authenticated? | `authenticate` middleware on every protected route |
| Does the user have the required role? | `requireRole(OWNER)` / `requireRole(STAFF)` / `requireRole(CUSTOMER)` middleware |
| Does the owner/staff belong to the business they are accessing? | `businessId` from JWT compared to resource's `businessId` in controller or service |
| Does the staff member belong to the correct branch? | Service-layer check against `staff.branchId` |
| Is the customer accessing their own data? | `customerId` resolved from customer JWT payload, never from client request body |

### Permission Matrix

| Action | OWNER | STAFF | CUSTOMER |
|---|---|---|---|
| Manage business profile | ✅ | ❌ | ❌ |
| Manage branches | ✅ | ❌ | ❌ |
| Create/edit loyalty programs | ✅ | ❌ | ❌ |
| Manage milestones | ✅ | ❌ | ❌ |
| Generate QR codes | ✅ | ❌ | ❌ |
| Create/manage staff | ✅ | ❌ | ❌ |
| View owner dashboard | ✅ | ❌ | ❌ |
| Approve/reject visit requests | ✅ | ✅ | ❌ |
| View pending requests | ✅ | ✅ | ❌ |
| Request a visit (stamp) | ❌ | ❌ | ✅ |
| View own loyalty progress | ❌ | ❌ | ✅ |
| Redeem a reward | ✅ (marks it) | ✅ (marks it) | ❌ |

---

## 4. Multi-Tenant Architecture

### Isolation Model

The platform serves many businesses on a single database. Each business is a tenant. All data belonging to a business must be strictly isolated.

**The `businessId` column is the primary isolation mechanism.** Every business-owned entity in the database includes a `businessId` foreign key.

### Ownership Chain

```
Business
  └── Branch            (businessId)
  └── LoyaltyProgram    (businessId)
        └── Milestone   (programId → businessId)
  └── Staff             (businessId)
  └── CustomerProfile   (businessId — per-business relationship)
        └── LoyaltyCycle       (customerProfileId)
              └── Visit
              └── MilestoneReward
```

### Enforcement Rules

1. **Never trust `businessId` from the client.** The `businessId` must always be resolved from the authenticated user's token or from the resource being accessed, not from the request body or query string.

2. **All database queries for business resources must include a `WHERE businessId = <authenticated business>`** filter. A missing `businessId` scope is a security bug.

3. **Ownership must be verified before any mutation.** When a staff member approves a visit, verify that the visit request's branch belongs to the staff member's business. When an owner modifies a program, verify the program belongs to their business.

4. **Customers are platform-level, not business-level entities.** A customer's core account (phone number, name) exists once on the platform. Their loyalty relationship with each business is stored in a per-business `CustomerProfile` record.

### Customer Multi-Business Model

```
Customer (global — identified by phone number)
    │
    ├── CustomerProfile (Business A) → LoyaltyCycle → Visits, Rewards
    ├── CustomerProfile (Business B) → LoyaltyCycle → Visits, Rewards
    └── CustomerProfile (Business C) → LoyaltyCycle → Visits, Rewards
```

Business A can only query its own `CustomerProfile` records. It cannot see the customer's activity at Business B or C.

---

## 5. Core Domain Model

### Entity Relationships

```
Business
  ├── has many Branch
  ├── has many Staff
  ├── has many LoyaltyProgram
  └── has many CustomerProfile (per-business customer relationship)

Branch
  ├── belongs to Business
  ├── has one QrCode
  └── has many VisitRequest

Staff
  ├── belongs to Business
  ├── belongs to Branch
  └── has one User (auth account — email + password identity)

LoyaltyProgram
  ├── belongs to Business
  ├── belongs to Branch (branchId — required, non-nullable)
  ├── has a cycleLength (Int) — the visit count at which the cycle completes
  ├── has a isActive (Boolean) — ACTIVE or INACTIVE. At most one isActive=true per branch at any time.
  ├── has many Milestone (reward checkpoints within the cycle, ordered by visitNumber)
  └── has many LoyaltyCycle

Milestone
  ├── belongs to LoyaltyProgram
  ├── has a visitNumber (position within the cycle)
  ├── has a rewardType (NONE | PERCENT_DISCOUNT | FIXED_DISCOUNT | FREE_ITEM)
  └── is enabled/disabled independently

Customer
  ├── is a platform-level entity (phone number is unique globally)
  ├── authenticates via phone + OTP only (no email or password)
  └── has many CustomerProfile (one per business they have visited)

CustomerProfile
  ├── belongs to Customer (global)
  ├── belongs to Business
  └── has many LoyaltyCycle

LoyaltyCycle
  ├── belongs to CustomerProfile
  ├── belongs to LoyaltyProgram
  ├── has a cycleNumber (1, 2, 3, …)
  ├── has a status (ACTIVE | COMPLETED)
  └── has many Visit
  └── has many MilestoneReward

Visit
  ├── belongs to LoyaltyCycle
  ├── belongs to Branch
  ├── created from an approved VisitRequest
  └── records the visit number within this cycle (1, 2, 3, …)

VisitRequest
  ├── belongs to CustomerProfile
  ├── belongs to Branch (and therefore Business)
  ├── has a status (PENDING | APPROVED | REJECTED)
  └── approved by a Staff member

MilestoneReward
  ├── belongs to LoyaltyCycle
  ├── references the Milestone that triggered it
  ├── has a status (UNLOCKED | REDEEMED)
  └── redeemed by a Staff member
```

### Key Distinctions

- **`LoyaltyProgram`** defines the rules, including `cycleLength`. It is owned by the business and **scoped to a specific branch** (`branchId` is required and non-nullable).
- A program is either **ACTIVE** (`isActive = true`) or **INACTIVE** (`isActive = false`). Each branch may have at most **one ACTIVE program** at any time.
- Programs can be deactivated and later **reactivated**. Reactivation preserves the same program ID, all existing milestones, and all historical `LoyaltyCycle` relationships — no new record is created.
- **`LoyaltyCycle`** is the customer's active run through a program. When `visitCount === program.cycleLength`, the cycle is marked `COMPLETED` and a new one begins.
- **`Milestone`** is a reward checkpoint within the cycle. Milestones with `rewardType: NONE` are tracked for progress but do **not** create a `MilestoneReward` record.
- **`Visit`** is a confirmed, approved interaction. A `VisitRequest` is the pending state before staff approval.
- **`MilestoneReward`** is the per-customer, per-cycle record of a reward unlock. Only created for milestones with a non-`NONE` reward type.

---

## 6. Loyalty Architecture

### Model Summary

The loyalty system is **cycle-based**. A business defines a `LoyaltyProgram` with an explicit `cycleLength` and a set of `Milestone` records. Visit progress accumulates within a `LoyaltyCycle`. The cycle ends when `visitCount === program.cycleLength`. Milestones are reward checkpoints within the cycle — they do not determine cycle length. A new cycle begins after each completion.

### Cycle Rules (authoritative)

1. Each approved visit increments the current cycle's `visitCount` by 1.
2. After every visit, the backend evaluates all enabled milestones for the program.
3. If the new `visitCount` matches a milestone's `visitNumber`:
   - If `rewardType` is `NONE`: the milestone is noted for progress tracking. **No `MilestoneReward` record is created.**
   - If `rewardType` is anything other than `NONE`: a `MilestoneReward` record is created with status `UNLOCKED`.
4. Unlocking or redeeming an intermediate milestone reward does **not** reset or end the cycle.
5. Disabling a milestone or changing its reward type does **not** change `cycleLength`.
6. The cycle is **complete** when `visitCount === loyaltyProgram.cycleLength`. Cycle completion is determined by `cycleLength`, **not** by the highest enabled milestone's `visitNumber`.
7. On cycle completion, the current `LoyaltyCycle` is marked `COMPLETED` and a new `LoyaltyCycle` is created (same `customerProfileId` + `programId`, `cycleNumber` incremented, `visitCount` reset to 0).
8. Milestones with non-`NONE` rewards become available again in each new cycle.
9. History of past cycles, visits, and milestone rewards is preserved and never deleted.

### Example

```
Program: "Café Rewards"
cycleLength: 7

Milestones (enabled):
  visitNumber: 1 → rewardType: NONE
  visitNumber: 5 → rewardType: PERCENT_DISCOUNT (25%)   ← intermediate reward
  visitNumber: 7 → rewardType: PERCENT_DISCOUNT (50%)   ← reward at cycle end

Cycle 1 progression:
  Visit 1 → visitCount = 1
           milestone at visitNumber 1 matched → rewardType: NONE
           → no MilestoneReward created
           visitCount (1) ≠ cycleLength (7) → cycle continues

  Visit 2 → visitCount = 2 → no milestone match → cycle continues
  Visit 3 → visitCount = 3 → no milestone match → cycle continues
  Visit 4 → visitCount = 4 → no milestone match → cycle continues

  Visit 5 → visitCount = 5
           milestone at visitNumber 5 matched → rewardType: PERCENT_DISCOUNT
           → MilestoneReward created (25% OFF, status: UNLOCKED)
           visitCount (5) ≠ cycleLength (7) → cycle continues

  Visit 6 → visitCount = 6 → no milestone match → cycle continues

  Visit 7 → visitCount = 7
           milestone at visitNumber 7 matched → rewardType: PERCENT_DISCOUNT
           → MilestoneReward created (50% OFF, status: UNLOCKED)
           visitCount (7) === cycleLength (7) → Cycle 1 COMPLETED
           New Cycle 2 created (cycleNumber: 2, visitCount: 0)
```

### Backend Milestone Evaluation Logic

After a visit is approved and the `Visit` record is created:

```
1. Get the current LoyaltyCycle for this customer + program.
   Also fetch the LoyaltyProgram to read cycleLength.
2. Increment LoyaltyCycle.visitCount by 1.
3. Fetch all enabled Milestones for this program.
4. Find any Milestone where visitNumber === currentVisitCount.
5. If a matching milestone is found:
     a. If milestone.rewardType === NONE:
          → Do NOT create a MilestoneReward record.
     b. If milestone.rewardType !== NONE:
          → Create MilestoneReward (status: UNLOCKED, milestoneId, loyaltyCycleId, unlockedAt: now).
6. Check cycle completion:
     If currentVisitCount === loyaltyProgram.cycleLength:
          → Mark LoyaltyCycle.status = COMPLETED, completedAt = now
          → Create a new LoyaltyCycle (same customerProfileId + programId,
            cycleNumber + 1, visitCount = 0, status = ACTIVE)
```

All of steps 1–6 execute within a single database transaction immediately after the visit is recorded. The client never triggers milestone evaluation directly.

### Reward Types

| Enum Value | Creates MilestoneReward? | Description | Example |
|---|---|---|---|
| `NONE` | ❌ No | Visit is tracked for progress. No reward record is created. | Visit 1 |
| `PERCENT_DISCOUNT` | ✅ Yes | A percentage off the bill. | 25% OFF |
| `FIXED_DISCOUNT` | ✅ Yes | A fixed currency amount off. | ₹50 OFF |
| `FREE_ITEM` | ✅ Yes | A free item or custom reward (text description). | Free Coffee |

---

## 7. QR & Visit Flow

### QR Code Generation

**MVP:** A QR code is generated **per Branch**. When scanned, it resolves the branch, and the backend then identifies the branch's single active `LoyaltyProgram`. There are no program-specific QR codes in the MVP.

The QR→program resolution flow is:

```
QR code scanned
  ↓
Branch (resolved by qrToken)
  ↓
Active LoyaltyProgram for that branch
  ↓
Customer's LoyaltyCycle for that program
```

- The QR code encodes a URL to the customer-facing loyalty page using an opaque token:  
  `https://<domain>/loyalty/<qrToken>`
- The `qrToken` maps to a `Branch` on the backend. It must not expose internal IDs directly.
- The backend resolves the active program from the branch server-side. The client does not supply a `programId`.
- QR codes can be regenerated. The old token is invalidated on regeneration.

**Future (not MVP):** Program-specific QR codes (for branches with multiple programs) are a future enhancement.

### Customer Visit Flow (Step by Step)

```
1. SCAN
   Customer scans QR code → browser opens /loyalty/<qrToken>
   Frontend calls public endpoint GET /api/public/qr/:qrToken.
   Backend resolves: Branch → active LoyaltyProgram.
   Frontend receives public metadata (business name, branch name, address, program name, cycle length, milestones).
   No internal database UUIDs (businessId, branchId, programId) are exposed.

2. PHONE ENTRY & OTP
   Customer enters their phone number.
   Frontend POSTs to /api/auth/customer/otp/send with { phone }.
   Customer enters OTP.
   Frontend POSTs to /api/auth/customer/otp/verify with { phone, otp }.
   Backend verifies OTP → resolves/creates Customer → issues customer JWT { customerId, role: "CUSTOMER" }.

3. READ-ONLY LOYALTY STATUS
   Authenticated customer fetches GET /api/customer/loyalty/:qrToken.
   Backend idempotently ensures CustomerProfile exists for (customerId, businessId).
   Strictly read-only: does NOT create an empty LoyaltyCycle or VisitRequest.
   If no cycle has started, returns hasStarted: false and visitCount: 0.

4. VISIT REQUEST
   Customer taps "Request Stamp".
   Frontend POSTs to /api/customer/visit-requests with { qrToken }.
   Backend enforces: at most one PENDING request per (customerProfileId, branchId).
   (Subsequent pending request to same branch returns 409 Conflict).
   Backend creates VisitRequest record (status: PENDING).

5. STAFF OPERATIONAL QUEUE & ATOMIC RESOLUTION
   Staff member sees pending requests on GET /api/staff/visit-requests (scoped to staff's assigned branchId).
   Customer phone is masked (+91 ••••• ••421) for privacy.
   Staff clicks Approve:
     POST /api/staff/visit-requests/:id/approve executes an atomic PostgreSQL transaction:
     - Atomically claims the request (WHERE id = :id AND status = 'PENDING').
       Concurrent approval attempts result in exactly one 200 OK and one 409 Conflict.
     - Lazily creates LoyaltyCycle 1 on first approved visit (visitCount = 1).
     - Creates Visit record.
     - Evaluates milestone: if rewardType != NONE, creates MilestoneReward (status: UNLOCKED) with snapshot fields.
     - Cycle completion: if newVisitCount === cycleLength, marks cycle COMPLETED with completedAt.
       Does NOT immediately create an empty Cycle N+1 (lazy rollover on next approved visit).
   Staff clicks Reject:
     POST /api/staff/visit-requests/:id/reject atomically updates status to REJECTED.
     Customer is unblocked to submit a new request.


8. CLIENT UPDATE
   Frontend invalidates the loyalty-status cache (TanStack Query).
   Customer sees updated visitCount and any newly unlocked MilestoneRewards.
```

### Security Constraints

- The client cannot create a `Visit` record directly. Visits are only created as a result of staff approval.
- The client cannot set `VisitRequest.status` to `APPROVED`. Only authenticated staff can do this.
- The client cannot trigger milestone evaluation or cycle completion. Both run server-side within the approval transaction.
- `customerId` is always resolved from the customer JWT payload. `businessId` is always resolved from the owner/staff JWT payload or from the resource being accessed. Neither is accepted from the request body.
- The `programId` used for loyalty evaluation is always resolved server-side from the QR token / branch context. The client never supplies a `programId` for loyalty operations.

---

## 8. Reward Lifecycle

### States

```
LOCKED → UNLOCKED → REDEEMED
```

| State | Meaning |
|---|---|
| `LOCKED` | The milestone has not yet been reached in the current cycle. No `MilestoneReward` record exists. |
| `UNLOCKED` | The customer's visit count reached the milestone's `visitNumber` and the milestone has a non-`NONE` reward type. A `MilestoneReward` record exists with status `UNLOCKED`. |
| `REDEEMED` | A staff member has marked the reward as redeemed. `MilestoneReward.status = REDEEMED`, `redeemedAt` and `redeemedByStaffId` are recorded. |

Note: milestones with `rewardType: NONE` have no reward state. They are not represented by a `MilestoneReward` record and do not appear in the `LOCKED → UNLOCKED → REDEEMED` lifecycle.

### Rules

- **Unlocking** is automatic and triggered exclusively by the backend milestone evaluation step immediately following visit approval. Only milestones with a non-`NONE` reward type create a `MilestoneReward` record.
- **Redemption Token Security:**
  - High-entropy 96-bit cryptographic token generated per unlocked reward (`RP-XXXX-XXXX-XXXX`).
  - Raw token is **never** stored in the database.
  - Only a deterministic SHA-256 hash is persisted in `redemptionTokenHash` (with unique index for $O(1)$ lookup).
  - The raw token is returned to the authenticated customer on demand only while `status === 'UNLOCKED'`.
  - For `REDEEMED` rewards, the raw token is completely omitted from responses.
- **Presentation & Scanning:**
  - Customer presents the opaque reward QR code or code on their mobile pass (`[ Show Reward ]`).
  - QR payload contains exclusively the opaque token `RP-XXXX-XXXX-XXXX` (no URLs, internal DB IDs, customer/branch/business IDs).
  - Staff or Owner taps **[ Scan Reward ]** on their dashboard, scanning via camera or typing the code manually.
- **Validation & Redemption:**
  - Read-only validation (`POST /api/staff/rewards/validate`) verifies token hash, branch scope, active status, and returns masked customer and snapshot reward info without mutating state.
  - Redemption (`POST /api/staff/rewards/redeem-by-token`) atomically executes conditional update `status: UNLOCKED -> REDEEMED`.
  - Concurrent attempts fail with `409 Conflict`.
- **Operational Actor Recording:**
  - Staff redemptions record the authenticated staff member's `Staff.id` in `redeemedByStaffId`.
  - Owner redemptions resolve/ensure an operational `Staff` record linked to the Owner User via `resolveStaffRecord()`, preserving foreign key integrity without altering schema constraints.
- **Cycle association:** Every `MilestoneReward` is tied to the `LoyaltyCycle` in which it was earned. If a customer is in Cycle 2 and previously had a reward in Cycle 1, those are separate `MilestoneReward` records. History is never overwritten.

### Redemption Fields on `MilestoneReward`

| Field | Description |
|---|---|
| `status` | `UNLOCKED` or `REDEEMED` |
| `unlockedAt` | Timestamp when the milestone was reached |
| `redeemedAt` | Timestamp when staff marked it redeemed (null if not yet redeemed) |
| `redeemedByStaffId` | The `Staff.id` who performed redemption |
| `redemptionTokenHash` | Deterministic SHA-256 hash of the reward redemption token (`@unique`) |
| `redemptionTokenCreatedAt` | Timestamp when redemption token was generated |

---

## 9. Database Architecture

This section describes the intended database model. The formal Prisma schema will be defined separately.

### Models and Key Fields

---

#### `Business`
Primary tenant entity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | Business display name |
| `type` | String | e.g., café, salon |
| `ownerId` | UUID FK → `User.id` | The owner's user account |
| `createdAt` | DateTime | Audit |
| `updatedAt` | DateTime | Audit |

---

#### `Branch`
A physical location of a business.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `businessId` | UUID FK → `Business.id` | Tenant scope |
| `name` | String | e.g., "Main Branch" |
| `address` | String | Optional |
| `qrToken` | String | Unique, URL-safe opaque token for QR code URL |
| `isActive` | Boolean | Defaults to true |
| `createdAt` | DateTime | Audit |

**Unique constraint:** `qrToken` (globally unique).  
**Index:** `businessId`.

---

#### `User`
Represents an authenticatable account for business owners and staff. Customers are **not** stored here — they use the `Customer` model.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | String | Unique |
| `passwordHash` | String | Bcrypt hash |
| `role` | Enum (`OWNER`, `STAFF`) | Customers are never assigned this role |
| `createdAt` | DateTime | Audit |

**Unique constraint:** `email`.

---

#### `Staff`
Links a `User` to a `Business` and `Branch`.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID FK → `User.id` | The staff's auth account |
| `businessId` | UUID FK → `Business.id` | Tenant scope |
| `branchId` | UUID FK → `Branch.id` | Operational scope |
| `isActive` | Boolean | Soft deactivation |
| `createdAt` | DateTime | Audit |

**Index:** `businessId`, `branchId`.

---

#### `Customer`
Platform-level customer identity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `phone` | String | Unique globally |
| `name` | String | Provided on first registration |
| `createdAt` | DateTime | Audit |

**Unique constraint:** `phone`.

---

#### `CustomerProfile`
Per-business relationship between a customer and a business.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `customerId` | UUID FK → `Customer.id` | Global customer |
| `businessId` | UUID FK → `Business.id` | Tenant scope |
| `createdAt` | DateTime | When customer first visited this business |

**Unique constraint:** `(customerId, businessId)` — one profile per customer per business.  
**Index:** `businessId`, `customerId`.

---

#### `LoyaltyProgram`
Defines the rules for a loyalty cycle, including the explicit cycle length. Each program is scoped to a specific branch.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `businessId` | UUID FK → `Business.id` | Tenant scope |
| `branchId` | UUID FK → `Branch.id` | **Required and non-nullable.** Each program belongs to exactly one branch. |
| `name` | String | e.g., "Café Rewards" |
| `description` | String | Optional |
| `cycleLength` | Integer | The visit count at which the loyalty cycle completes and resets (e.g., 7). Must be ≥ 1. |
| `isActive` | Boolean | `true` = ACTIVE. `false` = INACTIVE. At most one `isActive = true` per branch at any time. |
| `createdAt` | DateTime | Audit |
| `updatedAt` | DateTime | Audit |

**Index:** `businessId`, `branchId`.  
**Partial unique index:** `UNIQUE(branchId) WHERE isActive = true` — database-level enforcement that prevents two concurrent ACTIVE programs on the same branch.  
**ACTIVE/INACTIVE lifecycle:** Programs can be deactivated (`isActive = false`) and later reactivated (`isActive = true`). Reactivation restores the same program ID, milestones, and historical cycles — no new program record is created. Activating a program while another is already ACTIVE on the same branch returns `409 Conflict`.  
**Owner management:** `GET /api/branches/:id/loyalty-programs` returns all programs (ACTIVE + INACTIVE) for the owner dashboard. `GET /api/branches/:id/loyalty-program` returns only the single active program and is intended for the future QR/customer flow.

> **Important:** `cycleLength` is the single source of truth for when the cycle ends. Milestone `visitNumber` values must be ≤ `cycleLength`, but milestones do not control cycle completion.

---

#### `Milestone`
A configurable visit milestone within a loyalty program.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `programId` | UUID FK → `LoyaltyProgram.id` | |
| `visitNumber` | Integer | Visit count within the cycle at which this triggers |
| `rewardType` | Enum (`NONE`, `PERCENT_DISCOUNT`, `FIXED_DISCOUNT`, `FREE_ITEM`) | |
| `rewardName` | String | Short label (e.g., "25% OFF", "Free Coffee"). Null if rewardType is NONE. |
| `rewardDescription` | String | Optional longer description |
| `rewardValue` | Decimal | For PERCENT_DISCOUNT and FIXED_DISCOUNT. Null for NONE and FREE_ITEM. |
| `isEnabled` | Boolean | Disabled milestones are ignored by the loyalty engine |
| `createdAt` | DateTime | Audit |

**Unique constraint:** `(programId, visitNumber)` — only one milestone per visit number per program.  
**Index:** `programId`.

> **Important:** Milestones are reward checkpoints, not cycle-length controllers. The cycle ends when `LoyaltyCycle.visitCount === LoyaltyProgram.cycleLength`, regardless of whether a milestone exists at that visit number. Disabling or removing a milestone does **not** change the cycle length.

---

#### `LoyaltyCycle`
One run of a customer through a loyalty program.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `customerProfileId` | UUID FK → `CustomerProfile.id` | |
| `programId` | UUID FK → `LoyaltyProgram.id` | |
| `cycleNumber` | Integer | 1 = first cycle, 2 = second, etc. |
| `visitCount` | Integer | Current visit count within this cycle. Starts at 0. |
| `status` | Enum (`ACTIVE`, `COMPLETED`) | Only one ACTIVE cycle per customer+program at a time |
| `startedAt` | DateTime | When this cycle began |
| `completedAt` | DateTime | Null until cycle completes |

**Unique constraint:** `(customerProfileId, programId, cycleNumber)`.  
**Index:** `customerProfileId`, `programId`, `status`.

Only one `ACTIVE` cycle should exist per `(customerProfileId, programId)` at any time. Enforced at the service level.

---

#### `Visit`
A confirmed, approved customer visit.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `loyaltyCycleId` | UUID FK → `LoyaltyCycle.id` | |
| `visitRequestId` | UUID FK → `VisitRequest.id` | The source request |
| `branchId` | UUID FK → `Branch.id` | |
| `visitNumberInCycle` | Integer | The visit number within the cycle (mirrors `LoyaltyCycle.visitCount` at time of creation) |
| `approvedByStaffId` | UUID FK → `Staff.id` | |
| `createdAt` | DateTime | Time of visit approval |

**Index:** `loyaltyCycleId`, `branchId`.

---

#### `VisitRequest`
A customer's pending request for a visit stamp.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `customerProfileId` | UUID FK → `CustomerProfile.id` | |
| `branchId` | UUID FK → `Branch.id` | |
| `status` | Enum (`PENDING`, `APPROVED`, `REJECTED`) | |
| `requestedAt` | DateTime | Time of request |
| `resolvedAt` | DateTime | Time of approval or rejection. Null while PENDING. |
| `resolvedByStaffId` | UUID FK → `Staff.id` | Null while PENDING |

**Index:** `branchId`, `status`, `customerProfileId`.

---

#### `MilestoneReward`
The per-customer, per-cycle record of a reward unlock.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `loyaltyCycleId` | UUID FK → `LoyaltyCycle.id` | The cycle in which this was earned |
| `milestoneId` | UUID FK → `Milestone.id` | The milestone that triggered this |
| `status` | Enum (`UNLOCKED`, `REDEEMED`) | |
| `unlockedAt` | DateTime | When the milestone was reached |
| `redeemedAt` | DateTime | Null until redeemed |
| `redeemedByStaffId` | UUID FK → `Staff.id` | Null until redeemed |
| `redemptionTokenHash` | String | Unique SHA-256 hash of raw token (`RP-XXXX-XXXX-XXXX`) |
| `redemptionTokenCreatedAt` | DateTime | When redemption token was created |

**Unique constraint:** `(loyaltyCycleId, milestoneId)` — a milestone can only be unlocked once per cycle.  
**Unique constraint:** `redemptionTokenHash` — fast deterministic lookup of reward token.  
**Index:** `loyaltyCycleId`, `status`.

---

### General Database Rules

- All primary keys are UUIDs.
- Every table includes `createdAt`. Mutable tables also include `updatedAt`.
- Status fields use string enums (enforced by Prisma).
- Soft deletes are used where history must be preserved (e.g., `isActive = false` on Staff).
- Hard deletes are generally avoided for loyalty-related data.
- All database schema changes are made through Prisma migrations — never by direct SQL on the production database.

---

## 10. API Architecture

The API follows REST conventions. All endpoints return JSON. All request bodies are `application/json`.

Authentication is via `Authorization: Bearer <token>` header for protected routes.

---

### Auth (`/api/auth`)

| Responsibility | Auth Required |
|---|---|
| Business owner registration (email + password) | No |
| Business owner login | No |
| Token refresh | No (uses HTTP-only cookie) |
| Logout | Yes (invalidates refresh token) |
| Send OTP to customer phone number | No |
| Verify customer OTP → issue customer JWT | No |
| Customer profile creation (if first visit) | Yes (customer JWT) |

---

### Business (`/api/business`)

| Responsibility | Auth Required | Role |
|---|---|---|
| Create business (on owner registration) | Yes | OWNER |
| Get own business profile | Yes | OWNER |
| Update business profile | Yes | OWNER |

All operations are scoped to the `businessId` derived from the owner's JWT. The owner cannot access or modify another business.

---

### Branch (`/api/branches`)

| Responsibility | Auth Required | Role |
|---|---|---|
| Create a branch | Yes | OWNER |
| List branches for own business | Yes | OWNER |
| Get a branch | Yes | OWNER |
| Update a branch | Yes | OWNER |
| Get branch info + active program by QR token (public) | No | — |

The public QR endpoint resolves the `qrToken` → `Branch` → active `LoyaltyProgram` entirely server-side and returns enough information to render the loyalty page (business name, program name, `cycleLength`, milestones). The client never supplies a `programId`.

---

### Staff (`/api/staff`)

| Responsibility | Auth Required | Role |
|---|---|---|
| Create a staff account | Yes | OWNER |
| List staff for own business | Yes | OWNER |
| Update staff details | Yes | OWNER |
| Deactivate a staff account | Yes | OWNER |
| Staff login | No | — |

---

### Loyalty Programs & Milestones

Loyalty programs are branch-scoped. All management endpoints require OWNER authentication.

#### Branch-nested loyalty program routes (`/api/branches/:id/...`)

| Method | Path | Responsibility |
|---|---|---|
| `POST` | `/api/branches/:id/loyalty-program` | Create a new loyalty program for a branch (program is ACTIVE on creation; 409 if branch already has an ACTIVE program) |
| `GET` | `/api/branches/:id/loyalty-program` | Get the single **ACTIVE** program for a branch (404 if none active — intended for future QR/customer flow) |
| `GET` | `/api/branches/:id/loyalty-programs` | List **all** programs for a branch (ACTIVE + INACTIVE) — owner management view |
| `PATCH` | `/api/branches/:id/loyalty-program` | Update the active program's name, description, or cycleLength |

#### Program-level routes (`/api/loyalty-programs/:programId/...`)

| Method | Path | Responsibility |
|---|---|---|
| `PATCH` | `/api/loyalty-programs/:programId/status` | Activate or deactivate a program by ID. 409 if activating while another program on the same branch is already ACTIVE. |
| `POST` | `/api/loyalty-programs/:programId/milestones` | Add a milestone to a program |

#### Milestone routes (`/api/milestones/:milestoneId`)

| Method | Path | Responsibility |
|---|---|---|
| `PATCH` | `/api/milestones/:milestoneId` | Update a milestone's visitNumber, rewardType, or reward details |
| `PATCH` | `/api/milestones/:milestoneId/status` | Enable or disable a milestone |
| `DELETE` | `/api/milestones/:milestoneId` | Delete a milestone (hard delete — allowed since milestones have no independent history) |

For all program and milestone operations, the backend verifies that the resource belongs to `req.user.businessId` before proceeding. `businessId` is never accepted from the client.

---

### Customers (`/api/customers`)

| Responsibility | Auth Required | Role |
|---|---|---|
| List customers for own business | Yes | OWNER |
| Get a specific customer profile (business-scoped) | Yes | OWNER |
| Get own loyalty status at a business | Yes | CUSTOMER |

Customers can only access their own data. Owners can only access their business's customers.

---

### Visit Requests (`/api/visit-requests`)

| Responsibility | Auth Required | Role |
|---|---|---|
| Create a visit request | Yes | CUSTOMER |
| List pending requests for a branch | Yes | OWNER, STAFF |
| Approve a visit request | Yes | OWNER, STAFF |
| Reject a visit request | Yes | OWNER, STAFF |

On creation, `customerId` is resolved from the JWT. `branchId` is resolved from the QR token context, never from the request body.

On approval, the backend runs the full visit creation and milestone evaluation pipeline within a single transaction.

---

### Visits (`/api/visits`)

| Responsibility | Auth Required | Role |
|---|---|---|
| List visits for a business (with filters) | Yes | OWNER |
| List visits for a specific customer profile | Yes | OWNER |
| Get own visit history at a business | Yes | CUSTOMER |

Visits are created only by the system as a result of visit request approval — never directly by a client.

---

### Rewards (`/api/rewards`)

| Responsibility | Auth Required | Role |
|---|---|---|
| List unlocked rewards for a customer profile | Yes | OWNER, STAFF, CUSTOMER (own only) |
| Mark a reward as redeemed | Yes | OWNER, STAFF |
| Get reward redemption history | Yes | OWNER |

---

### Analytics (`/api/analytics`)

| Responsibility | Auth Required | Role |
|---|---|---|
| Get business-level dashboard metrics | Yes | OWNER |
| Get customer list with basic stats | Yes | OWNER |
| Get recent activity feed | Yes | OWNER |

Analytics endpoints aggregate data server-side and return pre-computed summaries. No raw database access is exposed to the client.

---

## 11. Security

### Password Security

- Passwords are hashed with **bcrypt** (minimum work factor: 12).
- Passwords are never stored in plaintext or logged.
- Password reset flow requires a time-limited token sent to the registered email.

### Session / Token Security

- Access tokens are short-lived JWTs (15 minutes).
- Refresh tokens are long-lived (7 days), stored as HTTP-only, Secure, SameSite=Strict cookies.
- Owner/Staff JWTs contain: `{ userId, role, businessId }`. Customer JWTs contain: `{ customerId, role: "CUSTOMER" }`. These are the only claims in each token type.
- JWT secret is an environment variable — never hardcoded.
- On logout, the refresh token is invalidated server-side (stored as a revocation list or deleted from the database).

### OTP Security

- OTP is 6 digits, generated using a cryptographically secure random number generator.
- OTP is stored server-side as a bcrypt hash, never in plaintext.
- OTP expires after 5 minutes.
- OTP is invalidated after first successful use.
- A maximum of N OTP attempts is allowed before a cooldown is enforced (rate limiting).
- OTP delivery failures (SMS errors) are logged but do not expose provider details to the client.

### Input Validation

- All API request bodies, query parameters, and route parameters are validated using **Zod** schemas on the backend before reaching any business logic.
- Validation errors return HTTP `400` with structured error details.
- Frontend also uses Zod for form validation, but this is never a substitute for server-side validation.

### Authorization

- Every protected route has explicit middleware asserting the required role.
- Every business-resource operation explicitly verifies `businessId` ownership before proceeding.
- No route relies solely on "the user is authenticated" — the role and ownership must also be verified.

### Multi-Tenant Isolation

- `businessId` is never accepted from the client for ownership assertions. It is always read from the authenticated user's JWT or derived from the resource being accessed.
- Service functions that access business data always require `businessId` as an explicit parameter, never relying on implicit context.
- Database queries for business resources always include `WHERE businessId = ?`.

### Rate Limiting

- OTP send endpoint: strict rate limiting per phone number (e.g., 3 requests per 10 minutes).
- Login endpoint: rate limiting per IP and per email.
- General API rate limiting per IP to prevent abuse.
- Implemented via middleware (e.g., `express-rate-limit`).

### Sensitive Data Protection

- Phone numbers are stored but not logged in plain form.
- API responses never include password hashes, OTP values, or internal secrets.
- Customer phone numbers returned in staff-facing responses are masked (e.g., `+91 ******* 890`).
- All communication is over HTTPS. HTTP is redirected to HTTPS.

### Environment Variables and Secrets

- All secrets (JWT secret, database URL, SMS provider API key) are stored as environment variables.
- Environment variable management per environment (development, production) uses `.env` files locally and platform-level secret injection in production.
- The `.env` file is never committed to version control.
- Frontend environment variables are prefixed (e.g., `VITE_API_URL`) and must never contain server secrets.

### Audit Logging

- Visit approvals and rejections are logged with staff ID and timestamp.
- Reward redemptions are recorded with staff ID and timestamp on the `MilestoneReward` record.
- Future: structured server-side audit log for sensitive owner actions (staff creation, program deletion).

---

## 12. Error Handling

### Backend Error Response Format

All error responses follow a consistent JSON shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [ ... ]  // Optional — field-level errors for validation failures
  }
}
```

### Error Types and HTTP Status Codes

| Scenario | HTTP Status | Error Code |
|---|---|---|
| Request body/param fails Zod validation | `400 Bad Request` | `VALIDATION_ERROR` |
| Missing or invalid authentication token | `401 Unauthorized` | `UNAUTHORIZED` |
| Valid token but insufficient permissions | `403 Forbidden` | `FORBIDDEN` |
| Resource not found (or not visible to this tenant) | `404 Not Found` | `NOT_FOUND` |
| Duplicate creation (unique constraint violation) | `409 Conflict` | `CONFLICT` |
| Business rule violation (e.g., redeeming already-redeemed reward) | `422 Unprocessable Entity` | `BUSINESS_RULE_VIOLATION` |
| Unexpected server error | `500 Internal Server Error` | `INTERNAL_ERROR` |

### Error Handling Implementation

- A centralized Express error-handling middleware catches all errors and formats them consistently.
- Application-level errors are thrown as typed error classes (e.g., `NotFoundError`, `ForbiddenError`, `BusinessRuleError`).
- Prisma-specific errors (e.g., unique constraint violations, record not found) are caught and translated to appropriate application errors before reaching the error middleware.
- Internal errors are logged server-side with full stack traces. The client receives only a generic `INTERNAL_ERROR` message with no stack trace or internal details.
- Never return Prisma error messages, stack traces, or internal field names to the client.

---

## 13. State & Data Fetching

### Server State — TanStack Query

All server-fetched data on the frontend is managed by **TanStack Query** (React Query). This provides:

- Automatic caching and background refetching
- Loading, error, and empty states
- Cache invalidation after mutations

**Key conventions:**

- Each API resource has a dedicated query key (e.g., `['visits', businessId]`, `['loyalty-status', programId]`).
- After a mutation (e.g., approving a visit, redeeming a reward), the relevant query cache is explicitly invalidated so the UI reflects the latest state.
- Optimistic updates may be used for latency-sensitive interactions (e.g., pending request list), but must not be used for loyalty state calculations — those must come from the server.

### Local UI State — React

Local component state (`useState`, `useReducer`) is used for:

- Form input state
- Modal open/close state
- UI toggle states (tabs, accordions)
- Loading indicators for non-async local interactions

Local state should never hold authoritative data about loyalty progress, visit counts, or rewards. Those come exclusively from TanStack Query.

### API Client Layer

A typed API client layer lives in `frontend/src/api/`. Each file corresponds to a resource group (e.g., `visitRequests.ts`, `loyalty.ts`). Functions in this layer:

- Construct the correct request URL and headers
- Send the request using `fetch` (or a lightweight wrapper)
- Parse and type the response
- Throw consistent errors for non-2xx responses

TanStack Query hooks call these API client functions, not `fetch` directly.

### Loading / Error / Empty States

Every data-fetching view must handle three states:

| State | Behavior |
|---|---|
| Loading | Show a skeleton or spinner appropriate for the content |
| Error | Show a user-friendly error message with a retry option where possible |
| Empty | Show a contextual empty state (e.g., "No pending requests") |

---

## 14. Environment & Deployment

### Backend Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | Access token TTL (e.g., `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token TTL (e.g., `7d`) |
| `OTP_PROVIDER_API_KEY` | API key for SMS/OTP provider |
| `OTP_PROVIDER_SENDER_ID` | Sender ID for OTP SMS |
| `OTP_EXPIRY_SECONDS` | OTP validity window (e.g., `300`) |
| `OTP_MAX_ATTEMPTS` | Max verification attempts before lockout |
| `PORT` | HTTP port for the server |
| `NODE_ENV` | `development` or `production` |
| `ALLOWED_ORIGINS` | CORS whitelist (comma-separated) |

### Frontend Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_BASE_URL` | Base URL of the backend API |

**Rule:** Frontend environment variables must contain no secrets. The `VITE_` prefix makes them visible in the compiled bundle.

### Database

- Managed PostgreSQL instance with automated daily backups.
- Connection pooling via `pg-pool` or Prisma's built-in connection pool.
- Schema changes are applied via `prisma migrate deploy` in CI/CD pipelines — never by direct DDL on production.

### OTP Provider

- MVP uses a third-party SMS provider (e.g., Twilio, MSG91).
- The OTP provider is abstracted behind a service interface (`OtpService`) so the provider can be swapped without changes to business logic.

### CORS

- The backend explicitly allows only the frontend's origin(s) via `ALLOWED_ORIGINS`.
- All other origins are rejected.

### Future Integrations

- WhatsApp campaigns: plugged into the `NotificationService` abstraction (not built in MVP).
- Email: same notification abstraction.
- Payment/subscriptions: separate service module (Phase 5).

---

## 15. Architectural Principles

These rules apply to all code in this project.

1. **TypeScript everywhere.** No JavaScript files. `strict` mode enabled in all `tsconfig.json` files.

2. **Prisma for all database access.** No raw SQL unless there is a documented, performance-critical reason. Raw queries must be reviewed and typed.

3. **Zod for all API input validation.** Validate on the backend at the boundary (routes/controllers) before business logic runs. Never trust client input.

4. **Business logic belongs on the backend.** The frontend renders and collects input. It does not compute loyalty state, check milestone conditions, or determine reward eligibility.

5. **No direct database access from the frontend.** The frontend communicates only via the REST API. There is no client-side database connection.

6. **Never trust client-supplied authorization context.** `businessId`, `customerId`, `staffId`, and other ownership identifiers used in authorization checks must always be resolved from the server's context (JWT payload, database lookup), not from the request body or query string.

7. **No cross-business data access.** A query for business-owned resources must always be filtered by the authenticated user's `businessId`. A missing filter is a security defect.

8. **Database changes through migrations.** All schema changes are made via Prisma migration files and applied through the migration pipeline. No direct DDL on the production database.

9. **Keep the MVP architecture simple and modular.** Prefer a clean monolith over premature abstraction. Modular code structure (services, controllers, validators) enables future extraction if needed, without requiring microservices upfront.

10. **Do not introduce microservices unless there is a demonstrated need.** The MVP runs as a single backend process. Splitting into services introduces deployment complexity, distributed transactions, and latency that is unjustified at this scale.

11. **Avoid unnecessary dependencies.** Before adding a library, consider whether the need can be met by language built-ins or an already-present dependency. Every dependency is a maintenance obligation.

12. **Loyalty state is always derived from the database.** The backend never caches loyalty progress in a way that could diverge from the database. Visit counts, milestone states, and cycle status are read from the database on each request.

13. **Preserve history.** Completed `LoyaltyCycle` records, `Visit` records, and `MilestoneReward` records are never deleted. Soft deletes (`isActive`, `status`) are used for deactivation.

---

## 16. Future Scalability

The MVP architecture is intentionally simple. The following describes how the architecture can grow without requiring a rewrite.

### Multiple Branches

Already modeled: `Branch` is a first-class entity. `LoyaltyProgram` is branch-scoped (`branchId` is required and non-nullable — not optional). Staff are assigned to a specific branch. The multi-branch management UI and expanded authorization checks require additional work, but the data model already supports it.

### WhatsApp / SMS / Email Campaigns

A `NotificationService` interface should be stubbed during MVP development (even if not used). Campaign functionality (Phase 3) plugs into this service. A campaign job scheduler (e.g., Bull queue, or a simple cron) reads customer segments and dispatches messages through the notification service.

### CRM and Customer Segmentation

Customer segmentation (Phase 2) is computed from existing `Visit`, `LoyaltyCycle`, and `MilestoneReward` data. New read-side queries and analytics endpoints can be added without changing the core write-side data model.

### Advanced Analytics (Phase 4)

For MVP, analytics are computed at query time from normalized tables. If performance becomes an issue at scale, a read replica or a simple materialized summary table can be introduced. A full analytics warehouse (e.g., BigQuery, Redshift) is a Phase 4+ concern.

### Subscriptions and Payments (Phase 5)

A `Subscription` and `Plan` model can be added to the existing schema. A billing service (Stripe integration) is added as a separate module. Plan limits (e.g., max customers, max campaigns) are enforced in the service layer by checking the business's active subscription.

### Additional Reward Types

The `rewardType` enum on `Milestone` is designed to be extended. Adding a new reward type (e.g., `POINTS`, `CASHBACK`) requires:
1. Adding the enum value to Prisma schema and migrating.
2. Adding handling in the `MilestoneReward` creation path.
3. Adding frontend rendering for the new type.

No structural changes to `LoyaltyCycle`, `Visit`, or the core loyalty engine are required.

### Horizontal Scaling

The backend is stateless (JWT-based auth, no in-process session state). When traffic requires it, multiple instances of the backend can run behind a load balancer. The database connection pool size should be tuned accordingly. Redis may be introduced for OTP storage and rate limiting state if multiple backend instances need to share that state.
