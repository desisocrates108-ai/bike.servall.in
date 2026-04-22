# CHANGELOG — Servall CRM

## 2026-04-21 — Iteration 11: CEO + Sales Manager Compliance Audit
**Scope**: Full requirements audit against user's CEO + Sales Manager specs. Identified 5 gaps and shipped fixes.

### Backend gaps FIXED
1. **Seeded all 5 branches**: added Amalsad + Vansda (previously only Bilimora, Chikhli, Gandevi)
2. **`call_recording_url` + `call_recording_filename`** fields on `FollowupIn` model + `add_followup` persistence
3. **`RegistrationInfo` model** (status / rto_office / number_allotted / number_allotted_date / plate_fitted / plate_fitted_date / notes) added to `LeadUpdate` — PUT `/api/leads/{id}` now accepts `{registration: {...}}`
4. **Default WhatsApp templates seeded** (idempotent): "Inquiry — send catalog", "Delivery — thank you", "Feedback — request"
5. **Default automation rules seeded** (idempotent): Auto-send catalog on inquiry (`inquiry_created`), Thank you on delivery (`delivery_completed`), Feedback reminder (`feedback_reminder`)

### Frontend gaps FIXED
- **New `/reports` page** (`pages/Reports.jsx`): client-side aggregation over `/api/leads` → Source conversion % table, Loss-reason donut, Funnel chart with drop-offs, Customer behaviour breakdown, Brand performance, Top 10 sold models, Sales exec ranking table (click → /users/:id), Branch comparison bars (CEO only, click → /branches/:id). Super-admin gets `reports-branch-filter` dropdown.
- **Reports sidebar link** `nav-reports` (visible to admin + super_admin)
- **Route** `/reports` gated `roles=["super_admin","admin"]`
- **Registration tab** on LeadDetail (`tab-registration`) with full RegistrationSection form: status dropdown, RTO office, number allotted, allotted date, plate fitted checkbox, plate date (gated), notes, save → persists via PUT
- GlobalSearch now uses distinct testids `global-search-input` (desktop) and `global-search-input-mobile` to avoid duplicate-DOM test collisions

### Testing
- Iteration 11 report: `/app/test_reports/iteration_11.json`
- Backend: **7/7 pytest PASS** (`/app/backend/tests/test_iter11_compliance.py`)
- Frontend Playwright (desktop + mobile) all flows pass
- Super/admin Reports renders correctly; sales_executive is blocked
- Registration PUT round-trip verified (saved → reloaded → values retained)

### Known (non-blocking)
- `/reports` aggregation is client-side — OK for current seed volume; plan server-side `/api/reports/summary` endpoint before 5k+ leads
- Empty-state copy missing when branch filter yields 0 leads (UX polish, not a bug)
- Carry-over LOW: admin cross-branch filter silent scope vs explicit 403
- Carry-over MEDIUM: POST /api/users without phone → 500 (phone index already `sparse=True`; can harden at API layer)

---

## Earlier: Iter 8/9/10 — mobile-first, drill-downs, role hardening, global search, contacts, reminders
## 2026-04-20 — Modules 13-14
## 2026-04-19 — Modules 11-12
## Earlier — Modules 1-10
