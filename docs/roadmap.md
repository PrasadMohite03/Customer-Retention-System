# RetainPulse Product Roadmap

> **Current Version:** Phase 1 (MVP) — Feature Complete  
> **Last Updated:** 2026-10-04  
> **Source of Truth Documents:** [`docs/product.md`](./product.md), [`docs/architecture.md`](./architecture.md), [`docs/loyalty-rules.md`](./loyalty-rules.md), [`docs/database.md`](./database.md), [`docs/api.md`](./api.md), [`docs/auth.md`](./auth.md)

---

## 1. Roadmap Overview & Status Matrix

| Phase | Milestone | Focus Areas | Status |
|---|---|---|---|
| **Phase 1** | **Core Loyalty MVP** | Auth, Businesses, Branches, Loyalty Engine, Visits, Reward QR, Explore | **Completed** |
| **Phase 2** | **Customer CRM** | Customer segmentation, visit frequency tracking, customer profiles | **Planned** |
| **Phase 3** | **Retention Automation** | WhatsApp / SMS win-back campaigns, automated reward reminders | **Planned** |
| **Phase 4** | **Analytics & BI** | Footfall analytics, cohort retention, redemption conversion, charts | **Planned** |
| **Phase 5** | **Advanced Fraud Prevention** | Geofencing, rotating dynamic QRs, scan velocity limits | **Planned** |
| **Phase 6** | **Monetization & Scale** | Merchant billing, subscription tiers, POS connectors, white-labeling | **Planned** |

---

## 2. Phase 1: Core Loyalty MVP (Completed)

All core components of the loyalty loop, multi-tenancy, authentication, customer explore, and staff operations are implemented, tested, and active in the codebase:

### Authentication & Tenant Isolation
- [x] **Owner & Staff Email/Password Authentication:** Secure registration, Bcrypt hashing, short-lived JWTs (`OWNER`, `STAFF`).
- [x] **Stateful Session Refresh:** Cryptographic opaque refresh tokens, HTTP-only secure cookies, token rotation, and reuse detection.
- [x] **Customer Phone + OTP Authentication:** Passwordless phone authentication, 6-digit OTP generation, hashed storage, TTL expiration.
- [x] **Strict Multi-Tenant Isolation:** Guaranteed tenant boundary enforcement via JWT-derived `businessId` and branch operational scoping.

### Business & Branch Management
- [x] **Business Profile Management:** Creation, updates, category/type assignment.
- [x] **Multi-Branch Operations:** Branch creation, address configuration, unique branch-scoped public QR tokens (`qrToken`).
- [x] **Staff Management:** Creation of staff accounts, branch assignment, activation/deactivation guards.

### Loyalty Engine & Programs
- [x] **Branch-Scoped Loyalty Programs:** Program configuration with explicit `cycleLength` rule.
- [x] **Active Program Guard:** Strict single-active-program-per-branch invariant enforced by application logic and PostgreSQL partial unique indexes.
- [x] **Milestone Checkpoints:** Flexible milestone configuration across all four reward types:
  - `NONE` (progress checkpoint without reward)
  - `PERCENT_DISCOUNT` (percentage discount)
  - `FIXED_DISCOUNT` (monetary discount)
  - `FREE_ITEM` (complimentary product/service)
- [x] **Milestone Snapshotting:** Unlocked rewards capture snapshot of reward type, value, and description at unlock time, isolating customer rewards from future program edits.
- [x] **Lazy LoyaltyCycle Lifecycle:** Cycles are created lazily upon approved qualifying visits; cycle rollover occurs on subsequent qualifying visits without empty cycle bloat.

### Customer QR & Visit Flow
- [x] **Public Branch QR Resolution:** Zero internal ID leakage; returns sanitized branch and active program metadata.
- [x] **Customer Loyalty Pass:** Mobile-first loyalty pass rendering real-time stamp progress.
- [x] **Exact-Slot Customer Punch Card UI:** Clean visual representation showing exactly `cycleLength` qualifying stamp slots (e.g., `4 of 4 visits`), attaching reward milestone indicators directly to their matching visit numbers without an artificial 5th slot.
- [x] **Visit Request Flow:** Customer stamp requests for normal visits with single-pending-request concurrency protection per branch.
- [x] **Unified Staff Dashboard:** Real-time queue for pending visit requests and unlocked customer rewards with search and filtering.
- [x] **Atomic Visit Approval & Claiming:** Thread-safe conditional approval transaction preventing duplicate stamps under concurrent staff actions.

### Claim Reward Visit Flow (Atomic Milestone Redemption)
- [x] **Short-Lived Claim Tokens:** 96-bit high-entropy token (`RC-XXXX-XXXX-XXXX`) with 15-minute TTL; raw token never stored in database; indexed SHA-256 hash lookup.
- [x] **Reward-Focused Pass CTA:** Dynamic CTA switching to "Claim Reward Visit →" when the customer's upcoming visit carries an attached reward milestone.
- [x] **Unified Staff Scanner Dispatcher:** Auto-dispatches based on token prefix (`RC-` for reward claims, `RP-` for unlocked rewards) supporting camera scanning and manual code entry.
- [x] **Single-Transaction Atomic Confirmation:** Consumes claim, records qualifying visit, increments cycle progress, unlocks and redeems milestone reward, and records footfall visit in one atomic database operation.

### Reward QR & Physical Redemption Architecture
- [x] **Cryptographic Redemption Tokens:** 96-bit high-entropy token (`RP-XXXX-XXXX-XXXX`); raw token never stored in database; indexed SHA-256 hash lookup.
- [x] **Dynamic Customer Reward QR:** Secure client-side SVG QR code presentation and uppercase alphanumeric code display.
- [x] **Staff QR Scanner & Validation:** In-browser camera scanning (`html5-qrcode`) and manual code lookup via read-only validation endpoint (`POST /api/staff/rewards/validate`).
- [x] **Atomic Reward Redemption:** Status transition `UNLOCKED → REDEEMED` with staff attribution (`POST /api/staff/rewards/redeem-by-token`).
- [x] **Physical Store Visit Tracking (`VisitType`):**
  - `VisitType.QUALIFYING`: Earns a stamp, requires visit request, increments `LoyaltyCycle.visitCount`.
  - `VisitType.REWARD_REDEMPTION`: Created atomically on reward redemption, records physical store footfall for analytics without distorting loyalty progress (`visitRequestId = null`, `visitNumberInCycle = null`).

### Customer Explore
- [x] **Real Database Discovery:** `GET /api/customer/explore` querying live businesses with active branches and active programs.
- [x] **Data Integrity Guarantee:** Zero fake distances, zero placeholder reviews, zero mock businesses.
- [x] **Search & Category Filters:** Case-insensitive search on business name, branch name, address, or program name; category filters (`ALL`, `CAFE`, `SALON`, `RESTAURANT`, `FITNESS`, `RETAIL`).
- [x] **State Enrichment:** Real-time enrollment indicator (`isEnrolled`) and current visit progress (`currentVisitCount`).
- [x] **Server-Side Pagination:** Standardized pagination controls (`page`, `limit`, `total`, `totalPages`, `hasNextPage`, `hasPreviousPage`).

---

## 3. Phase 2: Customer CRM & Relationship Intelligence (Planned)

The goal of Phase 2 is to help business owners understand who their customers are, track visit frequency, and recognize loyalty segments.

- [ ] **Customer Profile Intelligence:**
  - Aggregated visit frequency, favorite branch, first seen date, last visit date.
  - Total rewards unlocked vs. redeemed.
- [ ] **Automated Segmentation Engine:**
  - **New Customers:** 1 visit.
  - **Returning Customers:** 2 to 3 visits.
  - **Loyal Advocates:** Completed 1+ full loyalty cycles.
  - **At-Risk Customers:** No visit in 30 days.
  - **Inactive / Churned:** No visit in 60+ days.
- [ ] **Staff / Owner Customer Notes:**
  - Optional internal notes on customer preferences (e.g., "Allergic to nuts", "Prefers oat milk").
  - VIP customer badges for high-frequency visitors.

---

## 4. Phase 3: Retention & Campaign Automation (Planned)

Phase 3 focuses on proactive re-engagement to convert occasional customers into habitual regulars.

- [ ] **WhatsApp & SMS Integration:**
  - Automated message triggers for Indian and international retail markets.
  - Verification with business phone templates.
- [ ] **Event-Driven Automated Campaigns:**
  - **Reward Reminder:** "Your Free Coffee is ready to claim at Downtown Roastery!"
  - **Milestone Nudge:** "You are just 1 stamp away from 25% OFF!"
  - **Win-Back Flows:** "We miss you! Visit this week and get an extra perk."
- [ ] **Campaign Analytics:**
  - Delivery rates, click-through rates, and attributed in-store redemptions.

---

## 5. Phase 4: Merchant Analytics & Reporting Dashboard (Planned)

Phase 4 surfaces rich operational and financial insights leveraging the unified `Visit` and `MilestoneReward` tables.

- [ ] **Footfall & Store Visit Trends:**
  - Total physical footfall vs. qualifying visits vs. reward redemption visits over time.
  - Daily, weekly, and monthly footfall heatmaps by branch.
- [ ] **Retention Cohorts:**
  - 30-day, 60-day, and 90-day repeat customer retention rate curves.
  - Average time between visits (visit frequency velocity).
- [ ] **Reward ROI & Conversion:**
  - Reward unlock rate vs. actual redemption rate.
  - Revenue uplift estimation from redeemed rewards.
- [ ] **Export & Reporting:**
  - CSV / PDF export for merchant accounting and branch manager reviews.

---

## 6. Phase 5: Advanced Fraud Prevention & Security (Planned)

Phase 5 introduces location and scan verification layers for higher-ticket merchants.

- [ ] **Geofencing & Proximity Checks:**
  - Optional GPS boundary validation during stamp requests to ensure physical customer presence.
- [ ] **Dynamic Rotating Counter QRs:**
  - Time-limited rotating QR codes displayed on merchant tablets/screens (rotating every 30 seconds) to prevent photograph sharing.
- [ ] **Velocity & Anomaly Detection:**
  - Alert flags when a customer requests stamps across distant branches within minutes or exceeds daily visit limits.

---

## 7. Phase 6: Monetization & Enterprise Scale (Planned)

Phase 6 enables commercial SaaS scaling across multi-location chains and enterprise franchises.

- [ ] **Subscription & Billing Engine:**
  - Self-service merchant subscriptions (Free Starter, Growth, Multi-Branch Pro) powered by Stripe / Razorpay.
  - Automated tier enforcement (limit on active branches, staff seats, monthly visits).
- [ ] **Enterprise Multi-Location Hierarchy:**
  - Regional manager roles, centralized brand analytics, cross-branch loyalty consolidation.
- [ ] **Third-Party POS Integrations:**
  - Webhooks and REST integrations with local POS systems (Petpooja, Toast, Square, Shopify POS).
- [ ] **Custom Merchant Branding:**
  - Custom brand colors, merchant logo upload, and vanity subdomain/white-label loyalty passes.
