# CHANGELOG — Servall CRM

## 2026-04-21 — Mobile-First + Strict Funnel + Guide + PWA (Iteration 8)
**Scope**: One-shot complete overhaul per user's master document.

### Backend (`/app/backend/server.py`)
- Added `Allotment` stage to `STAGES` between Booking and Delivery
- Strict stage-transition validation in `POST /api/leads/{lid}/stage`:
  - → Follow-up: name + phone + vehicle required
  - → Interest: ≥1 Connected follow-up with `Interested` response
  - → Deal: brand + model + customer_expected_price + connected follow-up
  - → Booking: final_deal_price + payment_mode + approved-if-threshold
  - → Allotment: booking_amount > 0
  - → Delivery: chassis_number via allotment
  - → Registration: full payment + verified docs
- Tests added `/app/backend/tests/test_strict_funnel.py` (16/16 pass)

### Frontend
- `Layout.jsx`: mobile-first; hamburger sheet drawer + desktop sidebar; sticky mobile top bar with brand, lang toggle; bottom nav (Home/Leads/Tasks/WhatsApp) with z-index 10000 (beats preview watermark); FAB "+" for new lead
- `PageHeader.jsx` (new): reusable header with back button + title + subtitle + sticky option
- `GuideButton.jsx` (new): floating "?" using `react-joyride` — role-based tours (Sales/Admin/CEO + path-aware: Dashboard/Leads/LeadDetail/Tasks/WhatsApp); auto-runs once per browser
- `Dashboard.jsx`: role-based variants
  - Sales Executive → action-based (Smart Actions banner, hot-lead list, call today CTA)
  - Admin → control-based (conversion, at-risk, deals in progress)
  - CEO (super_admin) → decision-based (branch comparison, loss analysis, revenue)
- `Leads.jsx`: card layout on mobile + table on desktop; PageHeader with total count
- `Tasks.jsx`: tab strip (Today/Missed/Upcoming/At-Risk) + mobile cards + desktop table
- `LeadDetail.jsx`: `StageFlow` progress indicator (visual funnel strip); stage-change dialog limits options to adjacent-next + Lost; `stageHint()` shows required-field hint; supports `?tab=whatsapp` deep-link
- `Whatsapp.jsx` (new): global WhatsApp hub page (stat cards + quick actions + recent leads for send)
- i18n: expanded `en.json` + `gu.json` with `dash.*`, `wa.*`, `guide.*`, `nav.home`, `nav.whatsapp`
- Mobile CSS: 40px+ tap targets, `.no-scrollbar` utility

### PWA
- `public/manifest.json` (#ED1C24 theme, standalone)
- `public/service-worker.js` (app-shell cache, network-first nav)
- `public/icons/icon-192.png` + `icon-512.png`
- `public/index.html` — manifest link, theme-color, viewport-fit=cover, apple touch icon
- `src/index.js` registers SW in production only

### Testing
- Iteration 8 test report: `/app/test_reports/iteration_8.json`
- 16/16 backend tests pass
- All frontend Playwright flows pass
- Post-fix: bottom-nav z-index bumped above Emergent preview watermark

## 2026-04-20 — Modules 13-14 + Gujarati + Rebrand
- Advanced Role-Based Access Control (RBAC)
- Branch management + audit logs
- Rebranded to Servall CRM with #ED1C24
- Bilingual EN/GU toggle via i18next

## 2026-04-19 — Modules 11-12
- WA Automation + Campaigns wiring to frontend

## Earlier
- Modules 1-10: Lead capture, follow-ups, deals, booking, delivery, exchange, documents with Gemini OCR
