# ROADMAP — Servall CRM

## ✅ Shipped (Iterations 8-9)
- Mobile-first UI (hamburger + bottom nav + cards + tap targets)
- Global back buttons via `PageHeader`
- Strict form-gated funnel (Allotment stage added)
- Role-based dashboards (Sales/Admin/CEO) — fully clickable drill-down
- **Emergent badge removed** from UI
- Branch detail page `/branches/:id` with funnel/team/loss charts
- User detail page `/users/:id` with timeline
- Filter chips on Leads with URL sync
- Interactive guide button (react-joyride)
- PWA (manifest + SW + icons)
- Bilingual EN/GU

## 🔴 P1 — Next
- [ ] Explicit 403 for cross-branch `?branch_id=<other>` attempts (currently silently filtered)
- [ ] Server-side aggregation for `/api/branches/{id}/performance` (include funnel + loss_reasons + sources to avoid client-side aggregation over large lead lists)
- [ ] Pagination / top-N on Team perf table when >50 users
- [ ] Fix mobile KPI label truncation on 390px
- [ ] Silence Radix DialogTitle a11y warning on Change-Stage dialog
- [ ] Reports & Analytics Engine (Module 15) — CSV/Excel/PDF exports
- [ ] Master Data CRUD UI enhancements (Module 16)

## 🟡 P2 — Future
- [ ] RTO Registration tracking workflow (Module 17)
- [ ] Feedback & Retention System (Module 18)
- [ ] Customer Profiling Engine (Module 19)
- [ ] Buying Intent Engine (Module 20) — heat score from call signals
- [ ] Real WhatsApp Business API (replace mock)
- [ ] Offline-first data sync (IndexedDB + SW background sync)

## 🟢 P3 — Nice to have
- [ ] "Add to Home Screen" install prompt banner
- [ ] Push notifications (follow-up reminders)
- [ ] Dark mode
- [ ] Split `server.py` (4067 lines) into `routes/`, `models/`, `services/`
- [ ] More advanced charts (historical trends, cohort analysis)
