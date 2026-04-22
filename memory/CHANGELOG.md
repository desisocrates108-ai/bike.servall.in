# CHANGELOG — Servall CRM

## 2026-04-22 — Iteration 12: Wiring + Forms + Exchange Multi-Upload (P0 Bundle)
**Scope**: Complete the in-progress Iteration 12. All P0 items shipped + tested (18/18 backend + full frontend Playwright PASS).

### Backend
1. Extended `POST /api/leads/{lid}/exchange-photos` to accept `doc_type` query param ∈ {photo, aadhaar, rc_book, front_photo, back_photo}. Typed uploads land in `lead.exchange.documents.<bucket>[]`; default `photo` stays in `exchange.photos[]` (backward-compat preserved).
2. Added `DELETE /api/leads/{lid}/exchange-photos/{file_id}` — removes from both `photos[]` and `documents.*` and sets file `is_deleted=true`.
3. Verified `POST /api/leads/{lid}/stage` — stage=Lost without `lost_reason` returns 400 (pre-existing).
4. Verified `POST /api/leads` as `sales_executive` ignores body `branch_id` and auto-assigns user's own branch + assigns lead to self (pre-existing).
5. `GET /api/analytics/summary` + `/analytics/performance` `from_date`/`to_date` filters confirmed working.

### Frontend
- **Routes wired**: `/reminders` (all roles) + `/integrations` (super_admin + admin).
- **Sidebar nav**: `nav-reminders` (all roles) + `nav-integrations` (admin section).
- **Dashboard wiring**:
  - `DateRangeFilter` (today/week/month/year/all/custom) in header — feeds `/analytics/summary` + `/analytics/performance`.
  - `GujaratiCalendar` widget for super_admin + admin with crawling ticker, upcoming festivals, upcoming deliveries, past 14-day stats.
  - **Loss-analysis breakdown** card: per-`lost_reason` counts + % bars + links → `/leads?stage=Lost` (replaces plain loss card).
- **LeadForm.jsx**: `sales_executive` sees read-only `branch-auto-label` (auto-assigned branch) instead of branch dropdown.
- **LeadDetail.jsx**: Change-Stage `Confirm` button disabled until `lost_reason` picked; picking `Other` additionally requires `lost_reason_text`.
- **ExchangeSection.jsx**: new 4-slot `DocSlot` grid (Aadhaar, RC Book, Vehicle Front, Vehicle Back) with progress indicator (X/4), per-slot upload+delete. Existing `Additional Photos` section retained for extras.
- i18n (en + gu) keys added: `nav.reminders`, `nav.integrations`.

### Test report
`/app/test_reports/iteration_12.json` — **100% PASS** (18/18 backend + full frontend Playwright). No regressions.

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
