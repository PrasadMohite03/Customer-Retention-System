# Authentication & Authorization

> **Status:** Finalized for MVP
> **Purpose:** Defines the authentication mechanisms, security rules, and authorization boundaries for the Customer Retention SaaS.

## 1. Identity Models & Roles

The system uses two strictly separated identity models.

### A. Owner & Staff (Internal Users)
- **Model:** `User`
- **Authentication:** Email + Password
- **Roles:** `OWNER`, `STAFF`
- **Password Security:** Bcrypt hashing (never stored in plaintext).
- **JWT Payload:** `{ userId, role, businessId }`
- **Deactivation:** If a `Staff` record has `isActive = false`, they must be blocked from authenticating or accessing any protected APIs for that branch/business.
- **MVP Scope Constraint:** An `OWNER` has exactly one active `Business` context for authentication. A `STAFF` has exactly one active `Staff` assignment (and therefore one active business/branch context). The backend must **not** silently select the first record if multiple exist; if multiple active associations exist, login is rejected in the MVP.

### B. Customer (End Users)
- **Model:** `Customer`
- **Authentication:** Phone Number + OTP
- **Role:** `CUSTOMER`
- **Security:** Customers are **NOT** stored in the `User` table.
- **JWT Payload:** `{ customerId, role: "CUSTOMER" }`
- **Independence:** Customer access is entirely separate from Owner/Staff logic. Customers have no password and no email.

---

## 2. Token & Security Rules

- **Access Token:** Short-lived JWT (e.g., 15 minutes) signed with `JWT_SECRET` from environment variables.
- **Refresh Token (Stateful Opaque Token):** Long-lived (e.g., 7 days) stored in an HTTP-only, secure cookie. Never accessible to frontend JavaScript.
  - The token is a cryptographically secure random opaque string (not a JWT).
  - The cookie payload contains both the session ID and the opaque token (e.g., `<sessionId>:<opaqueToken>`).
  - **Database Storage:** The raw token is NEVER stored in the database. Only its cryptographic hash (e.g., SHA-256) is stored in the `RefreshSession` table.
  - **Rotation:** Refresh tokens are rotated on every successful refresh. The DB `tokenHash` is updated, and the client receives a new opaque token.
  - **Reuse Detection:** If a client presents a valid `sessionId` but an old/invalid token (hash mismatch), the system assumes a token theft/reuse attempt and immediately flags the session as `isRevoked = true`, denying access.
- **Logout Behavior:** Logout revokes the server-side `RefreshSession` (sets `isRevoked = true` or deletes the record) and clears the HTTP-only cookie.
- **OTP Generation:** Random 6-digit number.
- **OTP Expiration:** 5 minutes.
- **OTP Storage:** Hashed in a temporary store (e.g., Redis or database) linked to the phone number. Do NOT store OTPs in plaintext.
- **OTP Rate Limiting:** Maximum 3 failed verification attempts before invalidating the OTP. Rate limit sending to prevent SMS spam.
- **Auth Errors:** Return generic 401/403 errors (e.g., "Invalid credentials", "Unauthorized") rather than leaking if an email or phone number exists.

---

## 3. Authentication Flows

### Owner Login Flow
1. Client POSTs `{ email, password }`.
2. Backend queries `User` where email matches and role is `OWNER`.
3. Validates password via Bcrypt.
4. Generates access JWT containing `{ userId, role: "OWNER", businessId }`.
5. Creates a `RefreshSession` in the database, generates an opaque refresh token, stores its hash, and sets the HTTP-only refresh token cookie (`<sessionId>:<opaqueToken>`). Returns the access JWT in JSON response.

### Staff Login Flow
1. Client POSTs `{ email, password }`.
2. Backend queries `User` where email matches and role is `STAFF`.
3. Validates password via Bcrypt.
4. Backend verifies that the associated `Staff` record has `isActive = true`.
5. Generates access JWT containing `{ userId, role: "STAFF", businessId }`.
6. Creates a `RefreshSession` in the database, generates an opaque refresh token, stores its hash, and sets the HTTP-only refresh token cookie (`<sessionId>:<opaqueToken>`). Returns the access JWT in JSON response.

### Customer OTP Login Flow
1. **Send OTP:** Client POSTs `{ phone }`. Backend generates, hashes, and stores OTP (with 5-minute TTL), then sends SMS.
2. **Verify OTP:** Client POSTs `{ phone, otp }`. Backend validates OTP hash.
3. If valid, backend finds or creates `Customer` record.
4. Generates access JWT containing `{ customerId, role: "CUSTOMER" }`.
5. Creates a `RefreshSession` in the database, generates an opaque refresh token, stores its hash, and sets the HTTP-only refresh token cookie (`<sessionId>:<opaqueToken>`). Returns the access JWT in JSON response.

### Token Refresh Flow
1. Client POSTs `/auth/refresh` (or equivalent for customer). The browser automatically includes the HTTP-only cookie containing `<sessionId>:<opaqueToken>`.
2. Backend parses the cookie. If missing, returns 401.
3. Backend looks up `RefreshSession` by `sessionId`.
4. If session not found, expired, or `isRevoked = true` → Return 401.
5. Backend hashes the `opaqueToken` and compares it to `tokenHash` in the database.
6. **Reuse detection:** If the hash does *not* match, it means an old token was reused. Backend flags the session `isRevoked = true` and returns 401.
7. If the hash matches, the refresh is valid. Backend generates a new access JWT.
8. **Rotation:** Backend generates a NEW opaque refresh token, hashes it, and atomically updates `tokenHash` on the existing `RefreshSession` row. (e.g., `UPDATE ... WHERE id = sessionId AND tokenHash = oldHash`). This prevents concurrent requests from both succeeding using the same token.
9. Sets the new HTTP-only cookie (`<sessionId>:<newOpaqueToken>`) and returns the new access JWT in the JSON response.

### Logout Flow
1. Client POSTs `/auth/logout`.
2. Backend parses the HTTP-only cookie to extract the `sessionId`.
3. Backend marks the `RefreshSession` as `isRevoked = true` (or deletes it) in the database.
4. Backend clears the HTTP-only refresh token cookie from the client.

### Protected API Request Flow
1. Client sends request with `Authorization: Bearer <JWT>`.
2. Backend `authenticate` middleware verifies JWT signature and expiration.
3. Middleware extracts payload and attaches `req.user` or `req.customer`.
4. Role/authorization guards run before controller logic.

---

## 4. Authorization & Tenant Isolation

Authorization is strictly enforced on the **backend**. The client cannot bypass tenant isolation.

### Principles
- **Never trust client `businessId` or `branchId`**: If an endpoint creates or modifies a resource for a business, the `businessId` MUST be derived from the authenticated owner/staff JWT, not the request body.
- **Tenant Isolation**: All database queries for `OWNER` or `STAFF` must include `WHERE businessId = req.user.businessId`.
- **Customer Data Access**: Queries for a customer's loyalty profile must use `customerId = req.customer.customerId` from the JWT.

### Permissions
- **`OWNER`**: Can read/write all resources belonging to their `businessId` (branches, staff, loyalty programs).
- **`STAFF`**: Can only approve/reject `VisitRequest` and redeem `MilestoneReward` for their assigned `branchId`. Cannot edit loyalty programs or branches.
- **`CUSTOMER`**: Can only request visits and view their own loyalty cycles for businesses they have visited.

---

## 5. Middleware Architecture

To enforce the above rules, the backend will implement the following middleware:

1. **`authenticateUser`**: Validates JWT. Ensures payload has `userId` and `role` (`OWNER` or `STAFF`). Attaches `req.user`.
2. **`authenticateCustomer`**: Validates JWT. Ensures payload has `customerId` and role `CUSTOMER`. Attaches `req.customer`.
3. **`requireRole(roles: string[])`**: Checks if `req.user.role` or `req.customer.role` is in the allowed list.
4. **Business/Branch Isolation Check (Service Level or Middleware)**: Ensures that any requested resource ID (e.g., `req.params.branchId`) actually belongs to `req.user.businessId`.

---

## 6. Expected API Endpoints (To Be Implemented)

### User Auth (Owner/Staff)
- `POST /api/auth/login` - Authenticate via email/password
- `POST /api/auth/register` - Register a new owner (and create `Business`)
- `POST /api/auth/refresh` - Refresh access token via cookie
- `POST /api/auth/logout` - Clear refresh cookie

### Customer Auth
- `POST /api/auth/customer/otp/send` - Generate and send OTP to phone
- `POST /api/auth/customer/otp/verify` - Verify OTP and return customer JWT
- `POST /api/auth/customer/refresh` - Refresh customer token
- `POST /api/auth/customer/logout` - Clear refresh cookie

---

## 7. Open Decisions / NEEDS DECISION

*All authentication decisions for the MVP have been resolved.*
