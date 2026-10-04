# Product Requirements

> **Status:** Draft — MVP Phase  
> **Last Updated:** 2026-09-22 (Loyalty model updated to cycle-based milestone system)  
> **Audience:** Developers, designers, and AI coding agents working on this product.

---

## 1. Product Overview

We are building a SaaS platform that helps local businesses increase customer retention through digital loyalty programs.

The initial product is a **digital loyalty platform** — similar in concept to QR-based loyalty platforms like Druto. Customers scan a QR code, verify their identity via phone number and OTP, and accumulate visits toward milestone-based rewards. Business staff verify each visit and approve stamps. No native app installation is required.

Businesses configure a set of **visit milestones** within a loyalty cycle, each optionally carrying a reward. Visit progress is cumulative within a cycle. Reaching an intermediate milestone unlocks its reward without resetting progress. The cycle completes only when the customer reaches the final configured milestone, after which a new cycle begins from Visit 1.

The platform is **multi-tenant from day one** — many businesses will use the same infrastructure, with strict data isolation between them.

---

## 2. Product Vision

> **"A customer retention platform for local businesses."**

The long-term vision goes beyond digital stamp cards. The platform should eventually help local businesses:

- Retain existing customers
- Understand who their customers are
- Increase repeat visit frequency
- Reward their most loyal customers
- Identify and re-engage inactive customers
- Run targeted retention campaigns
- Measure loyalty program performance

The first version focuses exclusively on validating the core loyalty workflow. Everything else follows once the core loop works reliably with real businesses.

---

## 3. Problem Statement

Local businesses — cafés, restaurants, salons, barbers, gyms, and similar — depend on repeat customers for sustainable revenue. Most of them:

- Have no systematic way to track who their returning customers are.
- Use physical stamp cards that are easy to lose, forge, or ignore.
- Have no way to re-engage a customer who hasn't returned in weeks.
- Cannot measure how loyal their customer base is.

**The core problem we are solving:**

> Local businesses lose customers they could have retained, because they have no affordable, simple tool to recognize, reward, and re-engage those customers.

---

## 4. Target Users

There are three primary user types in the system.

---

### 4.1 Business Owner

The business owner creates and manages the loyalty program for their business.

**Capabilities:**

- Register and log in to the platform
- Create and manage their business profile
- Create and manage branches
- Create and configure loyalty programs
- Define visit milestones for a program
- Configure reward type and reward details per milestone
- Enable or disable individual milestones
- Generate QR codes for branches and programs
- Download, print, or share QR codes
- View customer list and profiles
- View visit history and stamp activity
- View reward unlock and redemption history
- View basic loyalty statistics/dashboard
- Create and manage staff accounts
- Control staff permissions

---

### 4.2 Staff

Staff members operate the loyalty program at the physical business location. They act as the verification layer between a customer's stamp request and the actual stamp being issued.

**Capabilities:**

- Log into the staff dashboard (separate from owner dashboard)
- View pending customer visit/stamp requests
- View basic customer information relevant to the visit (name, current progress)
- Approve a visit request (issues a stamp)
- Reject a visit request
- See basic confirmation of stamp issuance

**Restrictions:**

- Staff cannot modify loyalty programs
- Staff cannot access business analytics
- Staff cannot manage other staff accounts
- Staff permissions are more limited than the owner by default

---

### 4.3 Customer

Customers interact with the platform entirely through their mobile browser. No native app download is required.

**Capabilities:**

- Scan a business QR code with their phone camera
- Open the loyalty web page (no app install required)
- Enter their phone number
- Verify their identity via OTP
- Create a customer profile (on first visit) or access their existing profile
- View the loyalty program for the business they are at
- Request a loyalty stamp/visit
- See their current stamp progress
- See unlocked rewards
- View basic loyalty history (past visits and rewards)

**Experience requirements:**

- The customer flow must be fast and low-friction.
- Customers should be able to go from QR scan to stamp request in under 60 seconds.
- The interface must be mobile-first and work on any modern smartphone browser.

---

## 5. Core Product Loop

The fundamental loop that drives the product:

```
SCAN → VERIFY → STAMP → PROGRESS → REWARD → RETURN
```

1. **SCAN** — Customer scans a business QR code.
2. **VERIFY** — Customer verifies identity using phone number + OTP.
3. **STAMP** — Customer requests a visit. Staff approves it. A visit is recorded.
4. **PROGRESS** — Customer sees their visit count within the current cycle and the next upcoming milestone.
5. **REWARD** — When the visit count matches a configured milestone, that reward is automatically unlocked. Intermediate rewards do not reset the cycle; only reaching the final milestone completes the cycle.
6. **RETURN** — Unlocked rewards motivate the customer to return. After the final milestone, a new cycle begins from Visit 1.

This loop is the core value of the MVP. Every MVP feature either directly enables this loop or directly supports a business in running it.

---

## 6. User Journeys

### 6.1 Core Customer Journey

1. Customer visits a participating business.
2. Customer sees the business loyalty QR code displayed at the location.
3. Customer scans the QR code using their phone camera.
4. QR code opens the business loyalty page in the phone browser.
5. Customer enters their phone number.
6. Customer receives an OTP and verifies it.
7. Customer sees the loyalty program (name, milestones, next upcoming reward).
8. Customer taps to request a visit.
9. Staff member sees the pending request on the staff dashboard.
10. Staff verifies the customer is physically present.
11. Staff approves the request.
12. A visit is recorded; the customer's visit count within the current cycle advances by 1.
13. Customer sees their updated visit count and any newly unlocked milestone rewards.

**Example:**

```
Program: "Café Rewards"  (cycle length: 7 visits)

Milestones:
  Visit 1 → No Reward
  Visit 5 → 25% OFF  ← intermediate milestone
  Visit 7 → 50% OFF  ← final milestone (completes the cycle)

Customer is on Visit 4 (Cycle 1):
  ✅ Visit 1 — (no reward)
  ⏳ Visit 5 — 25% OFF  (1 more visit away)
  ⏳ Visit 7 — 50% OFF  (3 more visits away)

After Visit 5 is approved:
  ✅ Visit 5 — 25% OFF 🎉  [Unlocked — ready to redeem]
  Progress continues toward Visit 7. Cycle does NOT reset here.

After Visit 7 is approved:
  ✅ Visit 7 — 50% OFF 🎉  [Unlocked]
  Cycle 1 complete → New Cycle 2 begins at Visit 1.
```

---

### 6.2 Business Onboarding Journey

1. Business owner signs up with name, email, and password.
2. Owner creates their business profile (name, type, contact details).
3. Owner creates a branch (e.g., main location or specific outlet).
4. Owner creates a loyalty program for that branch.
5. Owner configures the program:
   - Program name (e.g., "Café Rewards")
   - Optional program description
   - Active/inactive status
6. Owner adds visit milestones to the program. For each milestone:
   - Visit number (e.g., 1, 2, 5, 10)
   - Reward type: No Reward / % Discount / Fixed Discount / Free Item or Custom Reward
   - Reward details (e.g., "10% OFF", "Free Coffee", "Free Meal")
   - Enabled/disabled status for the milestone
7. System generates a unique QR code for the branch/program.
8. Owner downloads or prints the QR code to display at the business.
9. Business is ready to accept customer visit requests.

---

### 6.3 Staff Approval Journey

1. Staff member logs into the staff dashboard using their staff credentials.
2. Staff sees a list of pending visit/stamp requests from customers.
3. For each pending request, staff can see:
   - Customer name
   - Customer phone number (masked or partial)
   - Customer's current stamp progress
   - Time of request
4. Staff confirms the customer is physically present.
5. Staff taps "Approve" to issue a stamp.
   - OR staff taps "Reject" if the customer is not present or the request is invalid.
6. The customer's cumulative visit count is incremented by 1.
7. The system checks whether the new visit count matches any enabled milestone in the program.
8. If a matching milestone has a reward, that reward is automatically unlocked for the customer.

---

## 7. Business Features

### 7.1 Authentication
- Business owner registration (name, email, password)
- Business owner login
- Password reset

### 7.2 Business Profile
- Create business profile
- Edit business profile (name, description, contact details, business type)

### 7.3 Branch Management
- Create a branch
- Edit a branch (name, address)
- View branches
- Each branch has its own QR code(s)

### 7.4 Loyalty Program Management
- Create a loyalty program
- Define program-level settings:
  - Program name
  - Program description (optional)
  - Active/inactive status
- Define visit milestones within a program:
  - Visit number at which the milestone triggers (e.g., 1, 2, 5, 10)
  - Reward type per milestone:
    - **No Reward** — milestone is tracked but gives no reward
    - **% Discount** — e.g., "10% OFF"
    - **Fixed Discount** — e.g., "₹50 OFF"
    - **Free Item / Custom Reward** — e.g., "Free Coffee", "Free Meal"
  - Reward name and description per milestone
  - Enable or disable a milestone independently
- Add, edit, or remove milestones from an existing program
- View all programs
- Enable or disable a program

### 7.5 QR Code Management
- Generate a QR code per branch/program
- View generated QR codes
- Download QR code (PNG format minimum)
- Regenerate QR code if needed

### 7.6 Staff Management
- Create staff accounts (name, phone number or email, password)
- View staff list
- Edit staff details
- Deactivate a staff account

### 7.7 Owner Dashboard
The owner dashboard provides a basic overview of loyalty activity.

**Metrics:**
- Total customers enrolled
- Total visits recorded
- Total stamps issued
- Total rewards unlocked
- Total rewards redeemed

**Activity views:**
- Recent activity feed (latest visits, stamps, rewards)
- Customer list with basic profile data
- Visit history
- Reward unlock and redemption history

---

## 8. Staff Features

### 8.1 Authentication
- Staff login using assigned credentials
- Staff are not able to self-register; accounts are created by the business owner

### 8.2 Staff Dashboard
- View all pending visit/stamp requests for the branch
- Each request shows:
  - Customer name
  - Customer phone (masked)
  - Current stamp progress
  - Time of request
- Approve a request → issues a stamp to the customer
- Reject a request → request is dismissed, customer is notified

### 8.3 Restrictions
- Staff cannot view or modify loyalty program settings
- Staff cannot view business analytics
- Staff cannot create or manage other staff accounts
- Staff operate within their assigned branch only

---

## 9. Customer Features

### 9.1 Landing Page (QR Destination)
- Mobile-optimized page that loads when the QR code is scanned
- Displays the business name and loyalty program overview
- Prompts the customer to enter their phone number

### 9.2 Authentication
- Phone number entry
- OTP sent to the customer's phone number
- OTP verification
- On first visit: customer creates a basic profile (name, phone number)
- On repeat visits: customer is recognized by their phone number

### 9.3 Loyalty Program View
- Program name
- Customer's current cumulative visit count
- List of all enabled milestones with:
  - Visit number
  - Reward type and reward name
  - Status: upcoming / unlocked / redeemed
- Next upcoming milestone highlighted (e.g., "1 more visit until Free Coffee")
- Visual progress indicator showing progress toward the next milestone

### 9.4 Visit Request
- Customer taps a button to request a visit
- Request is sent to the staff dashboard as a pending item
- Customer sees a "pending" status while awaiting staff approval
- On approval: cumulative visit count increases; any newly triggered milestone rewards are automatically unlocked and displayed
- On rejection: customer is informed the request was rejected

### 9.5 Reward States

Each milestone reward exists in one of the following states:

| State | Description |
|---|---|
| **Upcoming** | Customer has not yet reached this milestone's visit number in the current cycle. |
| **Unlocked** | Customer's visit count has reached this milestone. The reward is available to claim. The customer can open their Reward QR or human-readable code (`RP-XXXX-XXXX-XXXX`) on their mobile loyalty pass to present to staff. Reaching an intermediate milestone does **not** reset cycle progress. |
| **Redeemed** | Staff or Owner has scanned the customer's reward QR / entered the redemption code and confirmed redemption at checkout. Status transitions to `REDEEMED`, recording timestamp and operational staff actor. |

Important: the cycle resets **only** when the customer reaches the final configured milestone. Intermediate milestone rewards are unlocked and redeemed independently without resetting the cycle.

### 9.6 Loyalty History & Reward Presentation
- Customer can view their past visits at the business.
- Customer can view past rewards (unlocked and redeemed).
- For `UNLOCKED` rewards, customer can tap **[ Show Reward ]** to display an opaque Reward QR code and formatted code (`RP-XXXX-XXXX-XXXX`) along with expiration and usage instructions. Customers cannot self-redeem.
- For `REDEEMED` rewards, the pass displays `✓ Reward Name / REDEEMED / Used on <date>` and the QR code is no longer returned or accessible.

### 9.7 Multi-Business Support (Conceptual)
- A customer is not permanently tied to a single business.
- The same phone number can be used to participate in loyalty programs at multiple businesses on the platform.
- Each business has a separate, independent loyalty relationship with the customer.

---

## 10. Loyalty System

### 10.1 V1 Loyalty Model: Milestone-Based Visit Loyalty

The V1 loyalty system uses a **cycle-based milestone model**. A business defines a set of visit milestones within a loyalty cycle. Each milestone specifies the visit number within the cycle at which it triggers and what reward (if any) the customer receives.

#### Core Rules

- Every real physical store visit creates a `Visit` record.
- `VisitType` distinguishes `QUALIFYING` visits from `REWARD_REDEMPTION` visits.
- Each approved **qualifying** visit adds 1 to the customer's visit count within the current loyalty cycle (`visitType = QUALIFYING`, `visitRequestId = request.id`).
- Reward redemption visits (`visitType = REWARD_REDEMPTION`, `visitRequestId = null`, `visitNumberInCycle = null`) are real store visits recorded for analytics, but do **NOT** increment `LoyaltyCycle.visitCount` and do **NOT** create a `VisitRequest`.
- The system checks after every approved qualifying visit whether the visit count matches any enabled milestone.
- If a match is found and the milestone has a reward, that reward is **automatically unlocked**.
- When unlocked, a secure redemption token (`RP-XXXX-XXXX-XXXX`) is generated and its deterministic SHA-256 hash is stored in the database.
- Unlocking an **intermediate milestone** reward does **not** reset cycle progress — the customer continues toward the next milestone.
- The cycle completes when `visitCount === loyaltyProgram.cycleLength`.
- Terminal rewards are unlocked immediately upon reaching `cycleLength` qualifying visits. The customer can redeem their reward at any time via Reward QR scan at checkout.
- A new cycle (Cycle N+1) begins lazily on the customer's next approved **qualifying** visit (`cycleNumber = N + 1`, `visitCount = 1`).
- Each milestone is unlocked once per cycle. After a cycle rollover, milestones become available again in the new cycle.
- Staff or Owner marks an unlocked reward as **redeemed** by scanning the customer's reward QR or entering their redemption code at checkout. Atomically, status becomes `REDEEMED` and a `REWARD_REDEMPTION` `Visit` record is created. Customers have no self-redeem action.

#### Customer Loyalty UI Visual Presentation (5-Slot Punch Card Rule)

The customer loyalty pass provides an intuitive visual stamp card experience while preserving strict backend cycle counting:

- **Backend `cycleLength = 4`**: Exactly 4 qualifying visits are required to complete the cycle and unlock the terminal reward.
- **Frontend Card (`totalVisualSlots = 5`)**: The UI renders `cycleLength + 1` visual slots:
  - 4 qualifying stamp slots + 1 reward redemption slot.
  - **In Progress (e.g. 2 visits):** Displays `2 of 5` with 2 green checks and slot 5 showing the locked reward icon (`[🎁]`).
  - **Cycle Complete & Reward Unlocked (4 visits):** Displays `4 of 5` (`4 qualifying visits completed`) with 4 green checks and slot 5 showing an active/unlocked reward (`[🎁] Reward`). Primary action switches to **[ Show Reward ]**.
  - **Reward Redeemed:** Displays `5 of 5` (`Reward redeemed • Cycle completed`) with 5 green checks (`[✓] [✓] [✓] [✓] [✓]`).
  - **CRITICAL SEPARATION:** The visual 5th slot represents reward redemption, NOT a 5th qualifying visit, and must **never** increment `LoyaltyCycle.visitCount`. Backend counting remains strictly bound to `cycleLength = 4`.

#### Milestone Configuration

A business configures milestones at the program level. Each milestone has:

| Field | Description |
|---|---|
| `visit_number` | The cumulative visit count at which this milestone triggers (e.g., 1, 2, 5, 10) |
| `reward_type` | One of: `none`, `percent_discount`, `fixed_discount`, `free_item` |
| `reward_name` | Short label for the reward (e.g., "Free Coffee", "10% OFF") |
| `reward_description` | Optional longer description or redemption instructions |
| `is_enabled` | Whether this milestone is active. Disabled milestones are ignored. |

#### Reward Types

| Reward Type | Description | Example |
|---|---|---|
| `none` | No reward at this milestone. Visit is still tracked. | Visit 1 — no reward |
| `percent_discount` | A percentage discount reward. | Visit 2 — "10% OFF" |
| `fixed_discount` | A fixed currency discount reward. | Visit 3 — "₹50 OFF" |
| `free_item` | A free item or custom reward. | Visit 5 — "Free Coffee" |

#### Example Program Configuration

```
Program: "Café Rewards"  (cycle length: 4 qualifying visits)

Milestone 1: Visit 2 → 10% OFF      (enabled)  ← intermediate reward
Milestone 2: Visit 4 → Free Coffee  (enabled)  ← terminal reward at cycle completion
```

#### Customer Experience

```
Cycle 1 — Customer on Qualifying Visit 2:
  ✅ Visit 1 — (no reward)
  ✅ Visit 2 — 10% OFF 🎉 [Unlocked — ready to redeem at any time]
  ⏳ Visit 4 — Free Coffee (2 visits away)
  Card displays: "2 of 5" stamps.

After Qualifying Visit 4 is approved:
  ✅ Visit 4 — Free Coffee 🎉 [Unlocked]
  visitCount = 4 === cycleLength (4) → Cycle 1 COMPLETED.
  Card displays: "4 of 5" ("4 qualifying visits completed").
  Customer taps [ Show Reward ] to show Reward QR to staff.

Physical Store Reward Redemption Visit:
  Staff scans Reward QR and confirms redemption.
  Atomically: Reward status becomes REDEEMED.
  A Visit record is created: visitType = REWARD_REDEMPTION.
  LoyaltyCycle.visitCount remains 4.
  Card displays: "5 of 5" ("Reward redeemed • Cycle completed").

Next Qualifying Store Visit:
  Customer requests stamp via branch QR.
  Staff approves: Cycle 2 created lazily with cycleNumber = 2, visitCount = 1.
  Card resets to: "1 of 5" for Cycle 2.
```

### 10.2 Design for Extensibility

Although V1 only supports visit-based milestones, the loyalty engine should be designed so that additional loyalty rule types can be added later without rewriting the core system.

**Future loyalty models (not for MVP):**

- Spend-based loyalty (milestones triggered by cumulative spend)
- Points accumulation
- Referral rewards
- Birthday rewards
- Streak rewards (consecutive visit bonuses)
- Special campaigns (limited-time double stamps, etc.)
- VIP tiers
- Time-limited rewards

These must NOT be built in V1. The system architecture should simply not make it impossible to add them later.

---

## 11. Customer Data

### 11.1 Data Captured Per Customer

| Field | Notes |
|---|---|
| Name | Provided on first registration |
| Phone number | Primary identifier; used for OTP authentication |
| Account creation date | When the customer first joined the platform |
| Last visit | Date and time of most recent approved visit |
| Total visits | Across all businesses on the platform |
| Visit count (current cycle) | Per business: visit count within the customer's current loyalty cycle |
| Milestone rewards | Per business: list of milestones with their unlock and redemption status |
| Reward redemption history | Per business: dates and details of redeemed milestone rewards |

### 11.2 Multi-Business Customer Model

A single customer (identified by phone number) can participate in loyalty programs at multiple different businesses on the platform.

```
Customer (phone number)
    ├── Business A → loyalty relationship (cumulative visits, milestones, rewards)
    ├── Business B → loyalty relationship (cumulative visits, milestones, rewards)
    └── Business C → loyalty relationship (cumulative visits, milestones, rewards)
```

Each business can only see their own relationship with the customer — not the customer's activity at other businesses.

### 11.3 Privacy Considerations

- Customer data must be isolated per business; Business A cannot access Business B's customer data.
- Customers should be informed about data usage at sign-up (privacy notice).
- Phone numbers must be stored securely.
- OTP codes must expire after a short time window.

---

## 12. Fraud & Abuse Considerations

The system must consider the possibility of customers attempting to collect stamps without actually visiting a business.

### 12.1 V1 Primary Protection

**Staff approval is the primary fraud prevention mechanism in V1.**

A stamp is not issued until a human staff member at the business reviews and approves the request. This requires the customer to be physically present at the location, where staff can verify them.

### 12.2 Future Protections (Not for MVP)

The following protections may be added in future versions:

| Mechanism | Description |
|---|---|
| Visit cooldown | Prevent a customer from requesting more than one stamp within a time window at the same business |
| Daily stamp limits | Limit stamps per customer per day |
| Branch-specific QR codes | Ensure the QR code only works at a specific physical location |
| Device/browser fingerprinting | Detect unusual device patterns |
| Optional location verification | Check GPS proximity to the business at time of request |
| Suspicious activity detection | Flag or auto-reject anomalous stamp request patterns |

These features should NOT be over-engineered in V1. Staff approval is sufficient for the initial launch.

---

## 13. MVP Scope

The MVP must enable the complete end-to-end loyalty lifecycle. If this lifecycle works reliably for a real business, the MVP is successful.

### Business

| Feature | In MVP |
|---|---|
| Business registration and login | ✅ |
| Business profile | ✅ |
| Branch creation | ✅ |
| Loyalty program creation | ✅ |
| Loyalty program editing | ✅ |
| Milestone creation (per program) | ✅ |
| Milestone editing and enable/disable | ✅ |
| Reward type configuration per milestone | ✅ |
| QR code generation | ✅ |
| QR code download | ✅ |
| Staff account creation | ✅ |
| Staff management | ✅ |
| Owner dashboard (basic metrics) | ✅ |
| Customer list | ✅ |
| Visit history | ✅ |
| Milestone reward history | ✅ |

### Staff

| Feature | In MVP |
|---|---|
| Staff login | ✅ |
| Staff dashboard | ✅ |
| View pending stamp requests | ✅ |
| Approve a visit/stamp request | ✅ |
| Reject a visit/stamp request | ✅ |
| View customer visit info | ✅ |

### Customer

| Feature | In MVP |
|---|---|
| QR code landing page | ✅ |
| Phone number entry | ✅ |
| OTP verification | ✅ |
| Customer profile creation (first visit) | ✅ |
| Loyalty program view with milestones | ✅ |
| Visit request | ✅ |
| Cumulative visit count display | ✅ |
| Next milestone progress indicator | ✅ |
| Automatic milestone reward unlock | ✅ |
| Reward unlocked state | ✅ |
| Reward redeemed state | ✅ |
| Basic loyalty history (visits + rewards) | ✅ |

---

## 14. MVP Non-Goals

The following must NOT be built in the first version:

| Non-Goal | Reason |
|---|---|
| Native Android app | PWA/mobile web is sufficient for V1 |
| Native iOS app | PWA/mobile web is sufficient for V1 |
| AI features or recommendations | Unnecessary complexity before validating core loop |
| POS integrations | Out of scope; requires business-specific work |
| Inventory or accounting | Different product domain |
| Advanced marketing automation | Phase 3 feature |
| WhatsApp campaign integration | Phase 3 feature |
| Complex referral system | Phase 4+ feature |
| Points-based loyalty | Phase 2+ feature |
| Digital wallet integrations | Phase 6 feature |
| Subscription billing | Phase 5 feature |
| Cryptocurrency or blockchain | Not relevant to this product |
| Microservices architecture | Unnecessary for early stage |
| Advanced business intelligence | Phase 4 feature |
| Customer segmentation/CRM | Phase 2 feature |
| Review incentivization | Must never be done (policy risk) |

---

## 15. Future Features

### 15.1 Customer CRM (Phase 2)

Enrich the business owner's understanding of their customer base:

- New customers (first visit in the period)
- Returning customers (more than one visit)
- Loyal customers (high visit frequency)
- At-risk customers (declining visit frequency)
- Inactive customers (no visit in N days)

### 15.2 Retention Campaigns (Phase 3)

Allow businesses to send targeted messages to customer segments:

**Example messages:**
- "We haven't seen you in 30 days. Come back and get a bonus stamp."
- "You're one visit away from your reward!"
- "Your reward is waiting for you — come claim it."

**Potential channels:**
- WhatsApp (priority channel for the Indian market)
- SMS
- Email
- Browser push notifications

### 15.3 Advanced Analytics (Phase 4)

- Repeat visit rate
- Customer retention rate
- Reward conversion rate
- Campaign performance metrics
- Customer lifetime value
- Visit frequency trends

### 15.4 Monetization (Phase 5)

- Subscription plans for businesses (e.g., Starter, Growth, Pro)
- Billing and payment integration
- Usage-based limits per plan (e.g., max customers, max campaigns)

### 15.5 Scale & Multi-Branch (Phase 6)

- Full multi-branch management
- Branch-specific loyalty programs
- Advanced staff role and permission system
- Third-party integrations
- Branded/white-labeled loyalty pages per business

### 15.6 Google Reviews (Future, Optional)

The product may eventually help businesses make it easier for customers to discover their Google review page (e.g., display a link on the loyalty page). Important restrictions:

- Loyalty rewards must **never** be conditional on leaving a Google review.
- The product must **never** incentivize positive reviews.
- This must comply fully with Google's review policies and applicable regulations.
- This is not a core feature and should not be treated as one.

---

## 16. Target Business Segments

The MVP should be industry-agnostic. The same loyalty engine should work across all of the following business types without customization:

- Cafés and coffee shops
- Restaurants
- Bakeries
- Salons and barbershops
- Gyms and fitness studios
- Car washes
- Beauty and wellness businesses
- Small retail businesses

The stamp/reward model is generic enough to apply to any business where repeat visits matter.

---

## 17. Product Principles

### 1. Simple First
The first version must solve one problem extremely well: **"Help local businesses turn one-time customers into repeat customers."** Resist the temptation to add features before the core loop is validated.

### 2. Fast Customer Experience
Customers should be able to go from QR scan → loyalty page → phone verification → stamp request in under 60 seconds. Any friction that slows this down is a product defect.

### 3. Mobile First
Customers will primarily use smartphones. The customer-facing interface must be designed for mobile screens first. Desktop is secondary.

### 4. Business Value
Every feature should answer: **"How does this help the business retain customers or generate more repeat visits?"** If it can't answer that question, it doesn't belong in the product yet.

### 5. No Unnecessary Complexity
Do not build features simply because competitors have them. Build features because real businesses and customers need them.

### 6. Security
Customer and business data must be properly isolated. A business must never be able to access another business's data. Customer data must be protected.

### 7. Multi-Tenant from Day One
The platform serves many businesses on shared infrastructure. Business A must never be able to see or access Business B's customers, visits, rewards, staff, analytics, or QR codes.

### 8. Extensible Loyalty Engine
The V1 loyalty model is simple visit-based stamping. The system should be designed so that additional loyalty models (spend-based, points, tiers, etc.) can be added later without requiring a rewrite of the core system.

---

## 18. MVP Success Criteria

The MVP is considered successful if a real business can complete the following lifecycle end-to-end without manual intervention or workarounds:

```
1.  Business owner signs up
2.  Owner creates business profile
3.  Owner creates a branch
4.  Owner creates a loyalty program (e.g., "Café Rewards")
5.  Owner adds milestones:
      - Visit 2  → 10% OFF
      - Visit 5  → Free Coffee
      - Visit 10 → Free Meal
6.  System generates a QR code for the branch/program
7.  Owner downloads the QR code and displays it at the business
8.  Customer scans the QR code
9.  Customer enters their phone number
10. Customer verifies via OTP
11. Customer sees the loyalty program and milestone list
12. Customer requests a visit
13. Staff member sees the pending request
14. Staff approves the request
15. Customer's visit count within the current cycle is incremented
16. Customer sees their updated visit count and progress toward next milestone
17. Customer reaches Visit 5 → "25% OFF" reward automatically unlocked; cycle continues without resetting
18. Customer visits again; reaches Visit 7 (final milestone) → "50% OFF" reward automatically unlocked
19. Cycle 1 complete → new Cycle 2 begins; visit count resets to 1
20. Customer can see all unlocked and upcoming milestone rewards
21. Business owner can see the customer, all visits, and all milestone reward events in their dashboard
```

If this complete flow works reliably and without errors for a real business with real customers, the MVP is complete.

---

## 19. Product Roadmap

| Phase | Name | Focus | Status |
|---|---|---|---|
| **Phase 1** | MVP | Core loyalty/stamp system — QR scan, phone auth, stamp requests, staff approval, reward unlocking, owner dashboard | 🔨 In Progress |
| **Phase 2** | CRM | Customer profiles, segmentation (new, returning, loyal, at-risk, inactive), better customer insights for businesses | 🔮 Planned |
| **Phase 3** | Retention | WhatsApp, SMS, and email campaigns; automated win-back flows; customer engagement triggers | 🔮 Planned |
| **Phase 4** | Analytics | Repeat visit rate, retention analytics, reward performance, customer lifetime value, campaign performance reporting | 🔮 Planned |
| **Phase 5** | Monetization | Business subscription plans, billing, payment integration, usage-based plan limits | 🔮 Planned |
| **Phase 6** | Scale | Full multi-branch management, advanced staff permissions, third-party integrations, white-labeling, larger business capabilities | 🔮 Planned |

> The roadmap reflects the intended direction. Phases may be reordered based on real-world validation and business feedback after the MVP launch.

---

## 20. Customer Experience & Mobile-First App Architecture

RetainPulse provides a consumer-grade, mobile-first web app experience for customers without requiring a native app store download.

### 20.1 Customer Navigation & Screen Hierarchy

```
Customer Mobile Shell (CustomerLayout)
├── Persistent Bottom Navigation
│   ├── 1. Home (/customer/dashboard)
│   ├── 2. Explore (/customer/explore)
│   ├── 3. Central Scan [Elevated Primary Action] (/customer/scan)
│   ├── 4. Rewards (/customer/rewards)
│   └── 5. Profile (/customer/profile)
└── Branch Loyalty Pass (/loyalty/:qrToken)
```

### 20.2 Screen Responsibilities

1. **Home (`/customer/dashboard`)**:
   - Customer greeting ("Welcome back, [Name]")
   - Hero active loyalty card carousel / punch cards
   - Stamp progress ($X / N$ visits) and next upcoming reward milestone
   - Quick action banner: "At a shop right now? Scan QR at the counter"
   - Recently visited places and empty state prompting exploration or QR scanning.

2. **Explore (`/customer/explore`)**:
   - Backed by real database records only (`GET /api/customer/explore`) — no mock distances, fake ratings, or placeholder shops.
   - Search across business names, branch names, addresses, and loyalty program names.
   - Category filtering (`ALL`, `CAFE`, `SALON`, `RESTAURANT`, `FITNESS`, `RETAIL`).
   - Cards display real branch location, active program name, cycle length, and milestones.
   - Real-time customer enrollment indicator (`isEnrolled`) and current visit progress (`currentVisitCount`).
   - Standard server-side pagination with controls for browsing multiple pages of businesses.

3. **Central Scan Action (`/customer/scan`)**:
   - Visually prominent, elevated center button in bottom navigation
   - Mobile camera scanner using `html5-qrcode` to scan in-store branch QR code
   - Resolves branch `qrToken` and routes smoothly to the loyalty pass / stamp request.

4. **Loyalty Pass & Program Detail (`/loyalty/:qrToken`)**:
   - Polished mobile punch card representation using the 5-slot visual model (`totalVisualSlots = cycleLength + 1`).
   - Business & branch header with active program metadata.
   - Visual stamp grid displaying 4 qualifying stamp slots plus 1 reward redemption slot.
   - Visual states: `X of 5` in progress, `4 of 5` when cycle complete with reward unlocked, and `5 of 5` upon redemption.
   - Action states: "Request a Stamp" CTA with live polling for staff approval when in progress; "Show Reward" CTA when milestone reward is unlocked.
   - Dedicated "Earned Rewards" drawer with full QR presentation modal for checkout redemption.

5. **Rewards (`/customer/rewards`)**:
   - Dedicated customer reward wallet
   - Filter tabs: "All", "Available" (UNLOCKED), "Redeemed"
   - "Show Reward" presenting secure SVG QR code and redemption token for in-store staff scan
   - Historical redemption records.

6. **Profile (`/customer/profile`)**:
   - Customer name, verified phone badge
   - Lifetime summary (total visits, rewards unlocked, active programs)
   - Quick support / help information
   - Secure logout.

### 20.3 End-to-End Customer Lifecycle

```
DISCOVER → JOIN → SCAN → REQUEST STAMP → STAFF APPROVES → PROGRESS → MILESTONE → REWARD UNLOCKED → SHOW REWARD → STAFF REDEEMS → RETURN
```

