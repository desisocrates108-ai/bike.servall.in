# CHANGELOG — Servall CRM

## 2026-04-21 — Iteration 9: Drill-down Dashboards + Badge Removal
**Scope**: Complete drill-down system + remove Emergent badge + new detail pages + charts + filter chips.

### Removed
- `Made with Emergent` badge removed from `public/index.html` (the `<a id="emergent-badge">` element deleted). Verified — badge HTML/text is 100% absent from served HTML.
- Legacy branch-performance and user-performance dialogs removed from `Branches.jsx` and `Users.jsx` (replaced by dedicated detail pages).

### Added
- **BranchDetail.jsx** (`/branches/:id`): PageHeader with back, clickable KPIs, funnel chart (click stage → /leads?branch_id=X&stage=Y), team list (click exec → /users/:id), loss-reason donut, sources bar chart, recent leads
- **UserDetail.jsx** (`/users/:id`): PageHeader, KPIs, funnel chart, loss-reason donut, activity timeline (last 15 follow-ups), recent leads
- **Charts.jsx**: Reusable `FunnelChart`, `BarChart`, `DonutBreakdown` (zero-dep SVG-less)
- **Filter chip UI** on `/leads`: `active-filter-chips` region with `chip-<key>` x-to-clear + `clear-all-chips`; `useSearchParams` keeps URL in sync so deep links and back-nav work
- Dashboard drill-downs:
  - All stat cards have `linkTo` → filtered `/leads`
  - Funnel blocks clickable → `/leads?stage=<S>`
  - Branch comparison rows clickable → `/branches/:id` + new `SimpleBarChart` above the table
  - Team perf rows clickable → `/users/:id`
  - Loss card wrapped in `<Link>` → `/leads?stage=Lost`
- **Funnel.jsx** rewritten with PageHeader + clickable column headers (`funnel-col-link-<Stage>` → filtered /leads)

### Updated
- `Leads.jsx` — reads & writes `useSearchParams`, active chip strip, "filtered" subtitle, back button appears when filtered
- `Branches.jsx` — PageHeader, mobile `branch-card-<id>`, row click → /branches/:id
- `Users.jsx` — PageHeader, mobile `user-card-<id>`, row click → /users/:id
- `Automation.jsx`, `Campaigns.jsx`, `AuditLogs.jsx`, `Masters.jsx`, `LeadForm.jsx` — all have PageHeader with back button + mobile padding
- i18n `tasks.*`, `branches.sub` keys added to EN + GU

### Restored
- Bottom nav z-index reverted to `z-40` (badge removal fixed the overlap root cause)

### Testing
- Iteration 9 report: `/app/test_reports/iteration_9.json`
- Backend: 14/14 pytest pass (`/app/backend/tests/test_iter9_drilldown.py`)
- Frontend: 28/28 Playwright drill-down flows pass
- RBAC verified: super_admin all; admin branch-only (cross-branch filter bypass silently scoped to own branch — zero leakage); sales_executive own-leads-only
- PWA: `/manifest.json` + `/service-worker.js` both 200

### Known minor (non-blocking)
- Cross-branch `?branch_id=X` for admin returns own-branch data silently (safe, no leakage) — explicit 403 would be sugar
- Mobile 390px: some KPI labels still truncate on first render (cosmetic)
- Radix `DialogTitle` a11y warning on Change-Stage dialog (carry-over)

---

## 2026-04-21 — Iteration 8: Mobile-First Overhaul
See previous entries.

## 2026-04-20 — Modules 13-14 + Gujarati + Rebrand
## 2026-04-19 — Modules 11-12
## Earlier — Modules 1-10
