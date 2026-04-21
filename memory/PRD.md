# Two-Wheeler Dealership Sales CRM — PRD

## Original Problem Statement
Build a web-based CRM for a multi-branch two-wheeler dealership with lead-source tracking, assignment (manual + round-robin), inquiry → sales funnel management, follow-up scheduling, document uploads, role-based access (Super Admin / Admin / Sales Executive), and basic analytics — evolving into a 12-module suite ending with WhatsApp Automation and Marketing Campaigns.

## User Choices (confirmed)
- **Auth:** JWT (email + password), cookies + Bearer token
- **Seed demo data:** Yes (branches, brands/models/variants, colors, users, sample leads)
- **File storage:** Emergent Object Storage
- **Lead auto-assignment:** Round-robin per branch
- **Analytics depth:** Basic (per source, per stage, converted, lost, follow-ups due today)
- **Language:** Hindi / English (Hinglish) for user communication
- **WhatsApp provider:** MOCKED (auto-marks SENT in DB). Ready for Twilio/WATI drop-in.

## Architecture
- **Backend:** FastAPI single-file `/app/backend/server.py` (3.6k lines), MongoDB (motor), bcrypt + PyJWT, Emergent Object Storage via HTTP, Gemini 3 Flash Vision for OCR
- **Frontend:** React + React Router + Tailwind + Shadcn UI, Sonner toasts, lucide icons
- **DB:** `twowheeler_crm` — collections: users, branches, brands, vehicle_models, variants, colors, leads, followups, timeline, files, rr_counters, bookings, allotments, documents, payments, finance_cases, exchange_valuations, wa_templates, wa_messages, wa_optouts, automation_rules, campaigns, tasks, whatsapp_logs

## User Personas
- **Super Admin** — Full access across all branches, manages master data and users, creates global campaigns & automation rules.
- **Branch Admin** — Manages all leads in assigned branch, can reassign within branch, can manage/send campaigns and automation for branch.
- **Sales Executive** — Sees only own leads, updates stages, logs follow-ups, sends manual WhatsApp, uploads documents. No access to campaigns/automation.

## What's Been Implemented
### 2026-02-20 — Modules 1-10 (cumulative 151/151 backend tests)
- Modules 1-2: Lead Source, Assignment, Inquiry Funnel
- Modules 3-4: Follow-up (60s anti-spam, at-risk, tasks, perf analytics) + Deal Negotiation (₹5000 approval gate)
- Modules 5-6: Booking (multi-entry payments) + Vehicle Allotment (unique chassis)
- Modules 7-8: Documents + Gemini OCR (14 types, versioning, verify/reject, PII masking) + Delivery (OTP, checklist, accessories, challan)
- Module 9: Payment & Finance (payment_type, auto payment_status, margin alerts, finance approval flow)
- Module 10: Exchange System (valuation history, photos, net_payable auto-adjust)
- Full RBAC across every endpoint
- Frontend tabs for all above on Lead Detail

### 2026-04-21 — Modules 11 & 12 (24/24 backend tests + frontend E2E)
- **Module 11 — WhatsApp Communication Automation**
  - `wa_templates` CRUD (admin/super_admin write, 14 categories, variable placeholders via Jinja-like render)
  - `automation_rules` CRUD with event trigger (`inquiry_created`, `stage_changed`, `feedback_reminder`, `rc_reminder`, `lost_reengage`, etc.), JSON conditions matcher, delay support, active toggle
  - `fire_event` auto-queues messages on matching rules
  - `/leads/{id}/wa-messages` chat history + manual send (template OR content)
  - `/leads/{id}/wa-inbound` to log customer replies with reply_tag
  - `/wa-messages/{id}/retry` (WA_MAX_RETRIES=3)
  - `/wa-messages/{id}/mark` status transitions (SENT→DELIVERED→READ / FAILED)
  - `/leads/{id}/wa-optout` POST/DELETE/GET (opt-out blocks sending with 403)
  - **Safety:** duplicate guard (identical content to same lead within 60s → 429), rate limit (>10 outbound/lead/minute → 429)
  - Outbound send MOCKED: auto-marked SENT immediately (ready for Twilio/WATI worker swap)
- **Module 12 — Marketing Campaigns**
  - `campaigns` CRUD with targeting (stages, priorities, sources, branches, purchase_types, audience leads/past_buyers/all)
  - Draft → Scheduled → Running → Completed status lifecycle
  - `/campaigns/{id}/preview` returns audience_count + sample leads
  - `/campaigns/{id}/send` bulk queues with per-campaign dedupe, flips status, honours opt-outs
  - `/campaigns/{id}/stats` counters for queued/sent/delivered/read/failed/responses/conversions
  - Admin sees own + branch-scoped + global (super_admin) campaigns
- **Frontend**
  - New routes `/campaigns` and `/automation` (admin/super_admin only)
  - Sidebar links Campaigns & Automation under Admin section
  - LeadDetail new **WhatsApp** tab with chat UI (outbound right green / inbound left), template picker, opt-out toggle, inbound-simulation input with reply_tag selector
  - Automation page — Templates + Rules tabs, full CRUD dialogs with a11y DialogDescription
  - Campaigns page — list + stats dialog + preview dialog + rich audience-filter dialog

## Seeded Credentials
- Super Admin: `superadmin@dealer.com` / `super123`
- Branch Admin (Bilimora): `admin@dealer.com` / `admin123`
- Sales Execs: `sales1-4@dealer.com` / `sales123`

## Prioritized Backlog
### P1 — High value next phase
- Drag-and-drop on Funnel kanban for stage change
- Advanced analytics dashboard (executive perf, branch compare, conversion funnel chart, monthly trends)
- Real WhatsApp gateway swap (Twilio/WATI worker replacing auto-SENT mock in `_queue_message`)
- Lead export to CSV
- Split `server.py` (3.6k LOC) into `routers/whatsapp.py`, `routers/campaigns.py`, `routers/automation.py` + models/

### P2 — Nice to have
- Campaign background worker (BackgroundTasks → 202 + poll via /stats) for 50k+ lead campaigns
- `_conditions_match` operator support (in, not-in, range, nested paths)
- Env-driven `WA_RATE_LIMIT_PER_MIN` and `WA_DUP_WINDOW_SEC`
- Soft-delete for leads + trash view
- Enforce strict stage-progression order
- Brute-force protection on /login (lockout after 5 fails)
- Email notifications (welcome, password reset)
- Audit log viewer (admin-wide)

### P3 — Polish
- Customer self-service portal
- Service reminders module
- Inventory / stock management
- Commission tracking for sales execs

## Next Task List
1. Collect user feedback on Modules 13 & 14 (users/branches/audit UX)
2. Swap WhatsApp MOCK with Twilio/WATI when API keys ready
3. Implement P1 items (kanban drag-and-drop, lead CSV export, advanced analytics)

### 2026-04-21 — Modules 13 & 14 (19/19 backend tests + frontend E2E)
- **Module 13 — Advanced User & Role Management**
  - Extended `User` schema — `phone` (UNIQUE sparse index), `reporting_manager_id`, `joining_date`, `permissions` (schema-only, future-ready), existing `is_active`
  - `POST/PUT /api/users` validate phone uniqueness and manager role (must be admin/super_admin)
  - `GET /api/users` filters: `?role`, `?branch_id`, `?status=active|inactive`, `?q=` (name/email/phone search)
  - `GET /api/users/{id}/performance` — leads_total / leads_lost / leads_delivered / leads_pending (not double-counting Delivery) / followups_total / conversion_rate_pct
  - RBAC: sales_executive can only view own performance
  - `GET /api/permissions/modules` returns catalog of CRM_MODULES × PERMISSION_ACTIONS (future-ready, not enforced)
- **Module 14 — Advanced Branch/POS Management**
  - Extended `Branch` schema — `code` (UNIQUE sparse), `city`, `assigned_admin_id`, `is_active`, `allow_login_when_inactive`
  - Full CRUD on `/api/branches` with duplicate-code and admin-role validation
  - DELETE blocked when linked users/leads exist
  - `GET /api/branches/{id}/performance` — per-branch leads/conversions/lost/revenue (sum of Delivered booking `final_deal_price`)
  - `GET /api/branches-compare` — super_admin only, cross-branch leaderboard
  - **Inactive branch logic** (configurable per branch):
    - `is_active=false` always blocks new lead creation (POST /leads → 403)
    - `allow_login_when_inactive=false` also blocks login for users in that branch (→ 403 "Your branch is currently inactive")
    - Default: `is_active=true`, `allow_login_when_inactive=true`
- **Audit Logs (kept forever)**
  - New `audit_logs` collection with indexes on created_at, actor_id, branch_id, action
  - `log_audit()` helper — never raises, best-effort append
  - Instrumented: login / login_failed / logout / lead_created / lead_updated / stage_changed / deal_closed / lead_lost / followup_created / user_{created,updated,deleted} / branch_{created,updated,deleted}
  - `GET /api/audit-logs` with filters (user_id, action, entity_type, since, until, limit)
  - RBAC: super_admin sees all, admin scoped to own branch_id, sales_executive → 403
- **Seed updates**
  - Each seeded user now has `phone`, `joining_date`, `reporting_manager_id` (sales → branch admin → super admin)
  - Bilimora branch `assigned_admin_id` wired to Ravi Admin
  - Safe backfill on re-seed for existing deployments
- **Frontend**
  - `/users` page rewritten — role/branch/status/search filters, edit dialog with phone/manager/joining date/active toggle, performance dialog
  - `/branches` new standalone page — add/edit dialog with `code`, `city`, `assigned_admin`, `is_active` + `allow_login_when_inactive` toggles, performance dialog
  - `/audit-logs` new page — filter panel (user, action, entity, date range) + tabular trail
  - Dashboard — branch comparison card for super_admin (Leads/Converted/Lost/Conv%/Revenue)
  - Sidebar: Branches + Audit Logs links under Admin for admin+super_admin

## Next Task List
1. Collect user feedback on Modules 13 & 14 (users/branches/audit UX)
2. Swap WhatsApp MOCK with Twilio/WATI when API keys ready
3. Implement P1 items (kanban drag-and-drop, lead CSV export, advanced analytics)
