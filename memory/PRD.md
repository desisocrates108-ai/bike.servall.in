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
1. Collect user feedback on Modules 11 & 12 UX
2. Swap WhatsApp MOCK with Twilio/WATI when API keys ready
3. Start P1 items in priority order
