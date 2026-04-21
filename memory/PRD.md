# Two-Wheeler Dealership Sales CRM — PRD

## Original Problem Statement
Build a web-based CRM for a multi-branch two-wheeler dealership with lead-source tracking, assignment (manual + round-robin), inquiry → sales funnel management, follow-up scheduling, document uploads, role-based access (Super Admin / Admin / Sales Executive), and basic analytics.

## User Choices (confirmed)
- **Auth:** JWT (email + password), cookies + Bearer token
- **Seed demo data:** Yes (branches, brands/models/variants, colors, users, sample leads)
- **File storage:** Emergent Object Storage
- **Lead auto-assignment:** Round-robin per branch
- **Analytics depth:** Basic (per source, per stage, converted, lost, follow-ups due today)

## Architecture
- **Backend:** FastAPI single-file `/app/backend/server.py`, MongoDB (motor), bcrypt + PyJWT, Emergent Object Storage via HTTP
- **Frontend:** React + React Router + Tailwind + Shadcn UI, Sonner toasts, lucide icons, IBM Plex Sans / Outfit fonts
- **DB:** `twowheeler_crm` — collections: users, branches, brands, vehicle_models, variants, colors, leads, followups, timeline, files, rr_counters

## User Personas
- **Super Admin** — Full access across all branches, manages master data (brands/models/variants/colors/branches) and users
- **Branch Admin** — Manages all leads in assigned branch, can reassign leads within branch
- **Sales Executive** — Sees only own leads, updates stages, logs follow-ups, uploads documents

## Core Requirements
1. Lead capture with source, branch, priority, assignment
2. Vehicle selection (brand → model → variant → color) from master data
3. Conditional Exchange Vehicle form (photos, RC, condition, expected price)
4. Deal + payment/finance details
5. 10-stage funnel with validation rules (Deal/Booking/Registration/Lost prerequisites)
6. Follow-up system with history + counter + due-today filter
7. Document uploads to cloud storage (ID proof, RC, finance docs, etc.)
8. Timeline logs for every significant event
9. Dashboard analytics (leads by source, stage, converted/lost counts)
10. Role-based data access enforced on every endpoint

## What's Been Implemented (2026-02-20)
### Backend (cumulative 151/151 tests passing across iters 1-5)
- JWT auth + RBAC (sales_executive / admin / super_admin)
- Master data CRUD; Leads CRUD with round-robin, stage validation
- **Module 3** — Follow-up & Call Tracking (7-field follow-up, 60s anti-spam, at-risk flag, tasks, performance analytics)
- **Module 4** — Deal & Negotiation (ex-showroom, final price, ₹5000 approval threshold, negotiation history)
- **Module 5** — Booking Management (multi-entry payments, confirm/cancel, auto-advance)
- **Module 6** — Vehicle Allotment (unique chassis, auto-advance Delivery)
- **Module 7** — Documents + Gemini OCR (14 types, version control, verify/reject, masking, duplicate detection)
- **Module 8** — Delivery Management (checklist, accessories, OTP, printable challan, WhatsApp log-only pipeline)
- **Module 9** — Payment & Finance System
  - `payment_type` (Booking/Margin/Final/Other) on every payment
  - Auto-computed `payment_status` (Pending/Partial/Completed) on booking
  - `net_payable` = final_deal_price − exchange.final_value
  - `/bookings/{id}/payment-summary` with by-type breakdown + margin-alert when delivery ≤ 3 days away with no Margin payment
  - `/payments/{id}/receipt` — printable HTML receipt
  - Finance Cases (unique per lead) with status flow Not Applied → Applied → Under Review → Approved/Rejected
  - Auto-compute `loan_amount` = final_price − downpayment
  - Approve/Reject restricted to admin/super_admin; reject requires reason
  - Downpayment-received toggle
  - Delivery /complete now allows finance path: **pending>0 OK if finance Approved + downpayment received**
- **Module 10** — Exchange Vehicle System
  - Extended ExchangeInfo (old_model, self_start, finance_on_rc, expected/offered/final/broker values, notes)
  - `/leads/{id}/exchange-valuations` — broker/internal/online valuation history
  - `/leads/{id}/exchange-photos` — multi-photo upload to Emergent Object Storage
  - Auto-adjusts booking payable on exchange.final_value change
  - Visible in UI only when `purchase_type='Exchange Vehicle'`

### Frontend
- Login + Dashboard + Leads list + Lead form
- Lead detail page tabs: Overview / Follow-ups / Deal / **Booking** (with payment_type selector, receipt print button, payment-breakdown card, finance-case card with status stepper + approve/reject + downpayment toggle, margin alert) / **Exchange** (conditional tab with inspection form, pricing, valuation history, photos) / Delivery / Documents / Timeline
- Funnel kanban, Tasks page, User management, Master Data management

## Seeded Credentials
- Super Admin: `superadmin@dealer.com` / `super123`
- Branch Admin (Bilimora): `admin@dealer.com` / `admin123`
- Sales Execs: `sales1-4@dealer.com` / `sales123`

## Prioritized Backlog
### P1 — High value next phase
- Drag-and-drop on Funnel kanban for stage change
- Advanced analytics dashboard: executive performance, branch comparison, conversion funnel chart, monthly trends
- WhatsApp / SMS notification on follow-up reminders
- Lead export to CSV

### P2 — Nice to have
- Soft-delete for leads + trash view
- Enforce stage progression order (currently only prerequisites enforced)
- Cascading master-data deletes
- Brute-force protection on /login (lockout after 5 fails)
- /api/auth/refresh endpoint for refresh-token flow
- Email notifications (welcome, password reset)
- Audit log viewer (admin-wide, not per-lead)

### P3 — Polish
- Customer self-service portal
- Service reminders module
- Inventory / stock management
- Commission tracking for sales execs

## Next Task List
1. Gather user feedback on initial build
2. If approved, start P1 items with priority
