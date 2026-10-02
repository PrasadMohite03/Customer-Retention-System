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
