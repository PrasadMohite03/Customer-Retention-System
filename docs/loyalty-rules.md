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
