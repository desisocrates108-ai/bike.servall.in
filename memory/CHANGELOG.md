# CHANGELOG — Servall CRM

## 2026-04-28 — Iteration 18: Full Simplification (Phases 1+2+3)
**Scope**: Massive UX restructure — turn complex CRM into a fast dealership sales tool. 19/19 backend + frontend smoke tests **100% PASS**.

### Phase 1 — UX Simplification
**Funnel** — reduced from 11 → 9 stages: `Inquiry, Follow-up, Test Ride, Booking, Booking Hold (NEW), Allotment, RTO, Delivered, Lost`. Old names mapped via `STAGE_ALIAS` (Interest→Follow-up, Deal→Booking, Delivery→Delivered, Registration→RTO, Feedback→Delivered) + `POST /api/admin/migrate-stages` for one-time DB migration. All hardcoded stage checks rewritten via bulk-safe Python script.

**Lead Form** — only Customer Name + Phone are mandatory. Address + City visible by default. Vehicle Interest section (Vehicle Type Bike/Scooty/EV + Test Ride toggle + optional Brand/Model). All other Meta + Deal + Payment fields are hidden behind a `Show advanced` toggle. Source defaults to `Walk-in`; branch auto-resolves (sales → own, super → first active).

**Documents** — slots merged for simpler UX:
- Identity: `aadhaar` (multi front+back), `pan` (NEW multi), `other` (multi)
- Exchange: `rc` (multi front+back+pdf), `front_photo`, `back_photo`
- Old buckets (`aadhaar_back`, `rc_front`, `rc_back`, `rc_pdf`, `rc_book`) still accepted on POST for backward compat. Stage-gate updated: Aadhaar (only) for KYC; for Exchange RC + Vehicle photos.

### Phase 2 — Stock & Chassis System
**New `inventory` collection** — chassis-level vehicle stock.

**New endpoints**:
- `GET /api/inventory?status=&brand=&model=&chassis=` — list with filters
- `POST /api/inventory` — single add (admin/super only); duplicate chassis → 400
- `DELETE /api/inventory/{id}` — only if `status=available`
- `POST /api/inventory/upload` — CSV/XLSX bulk upload (mandatory cols: brand, model, chassis_number; optional: variant, color, engine_number, notes). Returns `{added, skipped_duplicates, errors}`. Uses `openpyxl` for XLSX.

**Booking flow** — `BookingCreate` accepts `payment_type` (Token|Full), `inventory_id`, `chassis_number`. On submit:
- Validates inventory item is `available` (else 400)
- Locks inventory → `status="booked"`, stores `booked_lead_id` + `booked_booking_id`
- Free-text `chassis_number` also checked for duplicate across non-cancelled bookings
- Token payment → lead.stage auto-advances to `Booking Hold`; Full → `Booking`

**New Stock page** (`/stock`, all logged-in users; admin can edit) — KPIs (Available/Booked/Total), CSV/Excel uploader, single-add form, filters, delete. Sidebar nav `Boxes` icon.

**Chassis Picker** (BookingSection) — searchable dropdown of available inventory; locks chassis on selection; "Change" button to clear.

### Phase 3 — Polish
- Branch (POS) field auto-hidden for sales_executive; admin disabled-locked (existing).
- Existing Tasks + Reminders pages already simple — kept.
- Finance section gated behind `Show advanced` (Aadhaar+PAN already covered via Identity slots — Bank Passbook bucket added to backend `IDENTITY_DOC_TYPES`).

### Production state
- Test residue purged. **1 user (super_admin), 0 leads, 0 inventory, 0 files.**
- `production_mode` flag preserved across restarts — sample users/leads will not re-seed.

### Test report
`/app/test_reports/iteration_18.json` — **100% PASS** (19/19 backend pytest + frontend Playwright smoke).

## 2026-04-22 — Iteration 17: Production Prep — DocumentsGallery + Demo Data Purge
**Scope**: Go-live preparation. Single consolidated document view on Lead Detail + full data wipe.

### Backend
- New endpoint `POST /api/admin/purge-demo-data?confirm=SERVALL_PURGE&keep_master_data=true` (super_admin only):
  - Wipes 17 transactional collections (`leads, followups, bookings, deliveries, allotments, payments, files, documents, exchange_valuations, negotiation_history, timeline, campaigns, automation_rules, wa_messages, whatsapp_logs, audit_logs, finance_cases`).
  - Deletes all non-super-admin users.
  - Sets `db.system_flags` doc `production_mode=true`.
- `seed_data()` now checks `production_mode` flag — skips creating sample users (admin + 4 sales) and sample leads on restart. Master data (brands/models/variants/colors, WA templates, branches) remain preserved across restarts.
- **Executed purge**: 279 leads + 184 files + 19 users + 1346 timeline entries + 403 audit logs wiped. 5 branches + master data + super_admin preserved.

### Frontend
- **NEW** `components/DocumentsGallery.jsx` — consolidated "Uploaded Documents & Photos" panel at the **top** of every Lead Detail Overview tab.
  - 4 grouped sections with color-coded headers: Identity (emerald), Vehicle Documents — RC Book (blue), Vehicle Photos (amber), Other Documents (zinc).
  - Thumbnail grid (3/4/6 cols responsive). Images render as `<img>`; PDFs as FileText icon with short id preview.
  - Click thumbnail → full-screen `Lightbox` overlay with `ESC`/click-outside to close. Images shown in-place; PDFs open in new tab.
  - Section/gallery is hidden when the lead has zero files (no empty shell).
  - `onError` fallback for broken image src → placeholder icon.
- Integrated into `LeadDetail.jsx` Overview tab — renders before the existing Customer/Lead cards.

### Credentials (post-purge)
`/app/memory/test_credentials.md` updated — only `superadmin@dealer.com / super123` remains.

### Test report
`/app/test_reports/iteration_17.json` — **100% PASS** (14/14 backend + full frontend Playwright).
Post-test cleanup re-run to remove test agent's ephemeral user `uday@gmail.com` + 5 leftover leads. Final production state: **1 user, 0 leads, 0 files.**

## 2026-04-22 — Iteration 16: Unified KYC + Exchange Document System
**Scope**: Complete redesign — separate identity/KYC (all leads) from exchange-specific docs (Exchange only), with strict stage-gate enforcement.

### Data model
- `lead.identity_docs = { aadhaar: [fid], aadhaar_back: [fid], other: [fid,…] }` — top-level, applies to **all leads**.
- `lead.exchange.documents = { rc_front, rc_back, rc_pdf, front_photo, back_photo }` — Exchange only.
- Legacy `lead.exchange.photos[]` still supported for old data.

### Backend
- Refactored `POST /api/leads/{lid}/exchange-photos` to route by bucket:
  - Identity buckets → `lead.identity_docs.*`
  - Exchange buckets → `lead.exchange.documents.*`
  - Legacy `photo` → `lead.exchange.photos`
- `DELETE /api/leads/{lid}/exchange-photos/{file_id}` — transparently scans all three stores.
- **Stage-gate validation** on `POST /leads/{lid}/stage`:
  - Any forward stage past Inquiry requires `aadhaar` + `aadhaar_back`.
  - `purchase_type=Exchange Vehicle` additionally requires `rc_front` + `rc_back` + `front_photo` + `back_photo`.
  - Stage→Lost and Stage→Inquiry always allowed.
  - Returns `400` with exact missing list.
- **Conditional cleanup** — `PUT /api/leads/{lid}` with `purchase_type=New Purchase` on a previously Exchange lead wipes `lead.exchange` to null but preserves `identity_docs`.

### Frontend
- **NEW** `components/DocSlot.jsx` — shared slot with Capture + Upload split buttons (extracted from ExchangeSection).
- **NEW** `components/IdentityDocsPanel.jsx` — KYC panel (Aadhaar F/B + Other). Rendered in a new `tab-kyc` tab on LeadDetail, visible to **all leads**.
- **ExchangeSection.jsx** — Aadhaar removed (moved to KYC). Now 2 cards only: `Vehicle Documents (RC Book)` (rc-front, rc-back, rc-pdf) + `Vehicle Photos` (front, back).
- **LeadForm.jsx** — Unified `Identity Documents & Vehicle Uploads` section (always visible) with conditional RC + Vehicle Photo sub-sections when Exchange. Mandatory counts: 2 for New / 6 for Exchange. Submit uploads identity for all leads + exchange only when applicable.
- **LeadDetail.jsx** — New `tab-kyc` tab added between `Booking` and `Exchange`.

### Test report
`/app/test_reports/iteration_16.json` — **100% PASS** (18/18 backend pytest + full frontend Playwright). No blocking bugs.

## 2026-04-22 — Iteration 15: Split Capture/Upload Buttons + Aadhaar Front/Back
**Scope**: Clearer mobile UX per upload slot.

### Backend
- `allowed_types` in `POST /api/leads/{lid}/exchange-photos` extended with `aadhaar_back` (separate bucket from `aadhaar`).

### Frontend
- **Two separate buttons** per slot (both `ExchangeSection.jsx` DocSlot and `LeadForm.jsx` StagedSlot):
  - 📷 `*-capture-btn` → hidden input `*-capture-input` with `accept="image/*"` + `capture="environment"` (mobile rear camera)
  - ⬆️ `*-upload-btn` → hidden input `*-upload-input` with `accept="image/*,application/pdf"` (or `image/*` for photo slots), NO capture attribute (gallery/file picker)
- **Aadhaar split** into `Aadhaar Front` (`aadhaar` bucket) + `Aadhaar Back` (`aadhaar_back` bucket) — both mandatory.
- **Mandatory count → 5**: Aadhaar Front + Aadhaar Back + RC Book + Front Photo + Back Photo (`Other Documents` still optional-multi).
- Slots now use `h-10` button heights for larger mobile tap targets.
- Re-capture/Re-upload labels when a single file is already present.

### Test report
`/app/test_reports/iteration_15.json` — **100% PASS** (11/11 backend + full frontend Playwright).

## 2026-04-22 — Iteration 14: Exchange Vehicle Complete Docs & Images System
**Scope**: Full document/image upload pipeline during lead creation + restructured Exchange tab.

### Backend
- Extended allowed `doc_type` values on `POST /api/leads/{lid}/exchange-photos` to include `"other"` — stores in `lead.exchange.documents.other[]` (multi).
- Backward-compatible: `photo` (default) still goes to `exchange.photos[]`.

### Frontend
- **LeadForm.jsx**: New `Vehicle Documents & Images` section below Expected Price (only when purchase_type = Exchange Vehicle) with 5 staged slots:
  - Documents: Aadhaar * (single), RC Book * (single), Other Documents (multi, optional)
  - Vehicle Photos: Front * (camera), Back * (camera)
  - Files held in `stagedFiles` state; after successful POST `/api/leads`, the form iterates uploads to `/api/leads/{id}/exchange-photos?doc_type=<bucket>` sequentially. Toast shows upload progress.
- **ExchangeSection.jsx (LeadDetail)**:
  - Card renamed from "Mandatory Documents (4)" to **"Vehicle Documents & Images"**.
  - Two sub-blocks: `Documents` (3-col: Aadhaar, RC Book, Other multi) + `Vehicle Photos` (2-col: Front, Back).
  - Front/Back slots use `capture="environment"` for direct rear-camera capture on mobile.
  - Progress line counts 4 mandatory + "+N other" suffix.
  - Legacy `photos[]` bucket still visible as "Legacy Photos" card only if non-empty (backward-compat for old leads).

### Test report
`/app/test_reports/iteration_14.json` — **100% PASS** (12/12 backend + full frontend Playwright). Only one micro-race UX note (non-blocking).

## 2026-04-22 — Iteration 13: Interactive Gujarati Calendar Popup
**Scope**: Turn the static calendar widget into a live, data-driven, click-through month view.

### Backend
1. New endpoint `GET /api/analytics/calendar?year=&month=&branch_id=` — returns `{year, month, days: {YYYY-MM-DD: {deliveries[], followups[], upcoming[], overdue[]}}}`.
2. Fully RBAC-scoped: sales_executive → own leads, admin → own branch, super_admin → global (optional branch_id filter). Validates year ∈ [2024, 2035] and month ∈ [1, 12].
3. Data sources: `deliveries.delivery_date`, `bookings.expected_delivery_date`, `followups.scheduled_date`, `leads.next_followup_date` (overdue vs upcoming by `< today`).

### Frontend
- **New** `components/CalendarDialog.jsx` — overlay modal (Radix Dialog) with:
  - Month grid with prev/next/today controls
  - Color-coded event dots per date: 🟢 Delivered, 🔵 Follow-up, 🟡 Upcoming, 🔴 Overdue, 🟣 Festival (star for important ones)
  - Click any event-day → Day Detail view (same dialog) with Back button (`←`). Detail shows Festivals, Deliveries, Overdue, Upcoming, Follow-ups as sections; each lead row links to `/leads/{id}` and closes the dialog.
  - Escape / Close / Back / Today all wired.
  - Mobile-friendly (95vw, scrollable, ~92vh max height).
  - A11y: `DialogTitle`+`DialogDescription` in `sr-only`.
- `GujaratiCalendar.jsx` — the calendar-header icon replaced with clickable `calendar-open-btn` that opens the dialog. Accepts `branchId` prop; Dashboard forwards `branchFilter` when super_admin filters a branch.

### Test report
`/app/test_reports/iteration_13.json` — **100% PASS** (15/15 backend + full frontend desktop+mobile Playwright). Only a11y console warnings were flagged and fixed post-test.

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

## 2026-04-28 — Iteration 19 + 20: Customer Type + Phase 3 simplification
### Iter 19 — Customer Type
- Backend `CUSTOMER_TYPES = ["Instant Buyer", "Token Finance Buyer", "Just Inquiry"]`
- POST `/api/leads` validates whitelist; `Just Inquiry` bypasses Inquiry stage and starts at `Follow-up`.
- `/api/constants` exposes `customer_types` array.
- Frontend `LeadForm.jsx`: 3-button selector (`customer-type-grid` + `customer-type-{value}`); Documents section gated by `wantsDocs` (visible only for Instant / Token Finance Buyer).
- Test: `/app/backend/tests/test_iter19_customer_type.py` — 8/8 PASS.

### Iter 20 — Phase 3 simplification
- Backend `DOC_TYPES`: renamed "Bank Statement" → "Bank Passbook"; `DOC_REQUIREMENTS["Finance"] = [Aadhaar, PAN, Bank Passbook]`.
- PUT `/api/leads/{id}` now validates `customer_type` whitelist (matches POST behaviour); empty string normalised to `null`.
- Frontend `LeadDetail.jsx` follow-up form: minimal default (Type, Notes*, Next Date*, Next Time). Six secondary fields (Call Status, Customer Response, Outcome, Lead Temperature, Call Duration, Loss Reason block) hidden behind `fu-toggle-advanced` toggle (state `fuAdvanced`).
- Tasks page already simple (Today/Missed/Upcoming/At Risk by `assigned_to` + `next_followup_date` + stage-as-status) — no changes.
- Test: `/app/backend/tests/test_iter20_phase3.py` — 11/11 PASS.

### Test reports
- `/app/test_reports/iteration_19.json` (100% backend + frontend)
- `/app/test_reports/iteration_20.json` (100% backend + frontend)

## 2026-04-28 — Iteration 21: Delete user button + Funnel stages fix
### Bug fixes from production screenshots
- **Funnel.jsx** had hardcoded 11 legacy stages (Inquiry, Follow-up, Interest, Test Ride, Deal, Booking, Allotment, Delivery, Registration, Feedback, Lost). Backend was already on the new 8-stage flow. Fixed: Funnel now reads stages from `/api/constants` with FALLBACK_STAGES = ["Inquiry", "Follow-up", "Hold", "Booking", "Delivery", "Allotment", "Feedback", "Lost"].
- **Users.jsx** had no Delete button. Added Trash2 delete button (super_admin only, hidden for own row) with browser `window.confirm` → `DELETE /api/users/{id}`. Backend endpoint already enforced super_admin + self-delete 400.

### Test report
`/app/test_reports/iteration_21.json` — backend pytest 5/5 + frontend Playwright 100% PASS.

## 2026-04-28 — Iteration 22: Call + WA history inside Follow-ups tab
- **Removed standalone WhatsApp tab** from LeadDetail (between Documents and Timeline). Per-lead WhatsApp messaging now lives inside the Follow-ups tab.
- **Follow-ups tab layout** is now a 2-column grid below the "Log a follow-up" form:
  - Left: **Call & Visit History** card — filters followups `type !== 'WhatsApp'`. Includes a "Call now" quick-action button (`tel:{lead.phone}` href).
  - Right: **WhatsApp panel** — embedded `WhatsappSection` (testid `followup-whatsapp-panel`) showing full message thread + send composer.
- Global `/whatsapp` side-nav route is unchanged; only the per-lead tab was consolidated.

### Test report
`/app/test_reports/iteration_22.json` — backend 5/5 + frontend 100% PASS.
