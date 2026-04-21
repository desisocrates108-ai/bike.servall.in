# CHANGELOG — Servall CRM

## 2026-04-21 — Iteration 10: Role Hardening + Global Search + Contacts + Reminder
**Scope**: Branch-admin access restrictions, CEO global search + branch filters, sales-exec contacts + reminder, remove Help button.

### Removed
- **Floating Help (?) guide button** completely. `GuideButton` no longer imported in `Layout.jsx`. File kept for future re-enable but not rendered.
- **Branch Admin** access to Users, Branches, Audit Logs:
  - UI: sidebar nav items only render when `isSuper === true`
  - Routes: `/users`, `/branches`, `/audit-logs` now `roles={["super_admin"]}` only
  - Backend: POST/PUT `/api/users` → `super_admin` only; GET `/api/audit-logs` → `super_admin` only; GET `/api/users` kept for admin (needed for dropdowns)

### Added
- **GlobalSearch** (`components/GlobalSearch.jsx`): top-bar search with debounced dropdown of matching leads (name/phone). Desktop inline; mobile collapsible full-screen sheet. Backend-scoped via `/api/leads?search=` so CEO sees all, admin sees own branch, sales sees own leads. Dropdown rendered at `z-50` inside a `z-30` top bar so it beats PageHeader (`z-20`).
- **Contacts page** (`/contacts`): de-duplicated customer list (by phone) with Call (`tel:`) and WhatsApp (`https://wa.me/91<num>`) one-tap buttons. `data-testid=contact-card-<id>, contact-call-<id>, contact-wa-<id>`.
- **Branch filter** on Dashboard (super_admin only — `dash-branch-filter`) and Funnel (`funnel-branch-filter`). Backend `/api/analytics/summary` and `/api/analytics/performance` now accept optional `branch_id` query honored only for super_admin.
- **Set Reminder** button + dialog on LeadDetail: `set-reminder-btn` opens dialog with `reminder-date`, `reminder-time`, `reminder-type`, `save-reminder-btn`. Saves `next_followup_date/time/type` on the lead via `PUT /api/leads/{id}` → appears in Tasks page automatically. Missed reminders already highlighted in Tasks "Missed" tab.
- **Role-aware bottom nav**:
  - `sales_executive`: Home / Leads / Tasks / **Contacts**
  - `admin` + `super_admin`: Home / Leads / Tasks / **WhatsApp**

### Changed
- `LeadUpdate` Pydantic model now accepts `next_followup_time` field.
- i18n: `nav.contacts`, `search.*`, `contacts.*`, `dash.all_branches` in EN + GU.

### Testing
- Iteration 10 report: `/app/test_reports/iteration_10.json`
- Backend: **13/13** pytest pass (`/app/backend/tests/test_iter10_rbac.py`)
- Frontend: Playwright flows pass after z-index fix on GlobalSearch dropdown (`z-30` on desktop top bar)
- RBAC verified: admin gets 403 on POST/PUT `/users`, GET `/audit-logs`; still 200 on GET `/users`; super_admin full access

### Known minor (non-blocking)
- Admin cross-branch filter silently scoped to own branch (carry-over). Explicit 403 remains optional hardening.
- `POST /api/users` without `phone` surfaced a 500 in one test run — phone index is `sparse=True` and should allow null; could be a race with a prior duplicate-null attempt before the index migration. Make `phone` required at the API layer if desired.

---

## 2026-04-21 — Iteration 9: Drill-down Dashboards + Badge Removal
## 2026-04-21 — Iteration 8: Mobile-First Overhaul
## 2026-04-20 — Modules 13-14
## 2026-04-19 — Modules 11-12
## Earlier — Modules 1-10
