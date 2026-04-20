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
### Backend (iter 1: 43, iter 2: +14, iter 3: +18 — all passing)
- JWT auth with cookies + Bearer header fallback
- Master data CRUD (branches, brands, models, variants, colors) — super_admin
- Leads CRUD with round-robin auto-assignment, RBAC, stage validation
- **Module 3 — Follow-up & Call Tracking** (call_status, customer_response, outcome_tag, temperature, duration, loss_reason; mandatory notes+date; 60s anti-spam; at-risk flag after 2+ missed)
  - `/api/tasks?kind=today|missed|upcoming|at_risk`
  - `/api/analytics/performance` (per-exec metrics)
- **Module 4 — Deal & Negotiation** (ex-showroom, final_deal_price, auto approval-required at ₹5000 threshold, request-approval / approve / reject; full negotiation history)
  - Stricter stage rules: Deal → 1+ Connected call; Booking → final_deal_price + approval
  - `/api/analytics/deals`
- **Module 5 — Booking Management**
  - Bookings collection (one active per lead)
  - Multi-entry payments sub-collection with auto total_paid / pending_amount
  - Business rules: booking_amount ≤ final_deal_price, delivery ≥ booking_date, confirm needs paid ≥ booking_amount
  - `POST /api/leads/{id}/booking`, `PUT /api/bookings/{id}`, `/confirm`, `/cancel` (admin)
  - `POST /api/bookings/{id}/payments`, `GET /api/bookings/{id}/payments`
  - Auto-advances lead.stage → Booking on creation
- **Module 6 — Vehicle Allotment**
  - Allotments collection (unique chassis_number system-wide, one per booking)
  - Requires booking.status='Confirmed'
  - `POST /api/bookings/{id}/allotment`, `PUT /api/allotments/{id}` (admin)
  - Auto-advances lead.stage → Delivery on allotment
- File upload via Emergent Object Storage
- Idempotent seed on startup

### Frontend
- Login page (split-screen) with quick demo logins
- Dashboard: stat cards + conversion %, missed/upcoming/at-risk (linked to Tasks), deals-in-progress, pending approvals, avg discount, top-execs leaderboard
- Leads list with full filter bar
- Lead creation form (section-based, conditional)
- Lead detail page with tabs:
  - Overview / Follow-ups / Deal / **Booking** / Documents / Timeline
  - Enhanced follow-up form
  - Deal tab: editable pricing, auto-discount calc, approval flow, negotiation history
  - **Booking tab:** create/edit booking form, payments table with add-payment dialog, vehicle allotment (chassis + engine) sub-section with confirm / cancel / assign-vehicle actions
- Sales Funnel kanban
- Tasks page (Today / Missed / Upcoming / At-Risk)
- User management, Master Data management

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
