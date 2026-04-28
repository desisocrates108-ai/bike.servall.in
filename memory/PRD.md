# Servall CRM — Two-Wheeler Dealership Sales CRM

## Original Problem Statement
Build a comprehensive Two-Wheeler Dealership Sales CRM ("Servall CRM") that feels like a smart mobile sales assistant — NOT a typical web CRM. End users are dealership sales executives, branch admins and the CEO. Must cover the full life-cycle from walk-in inquiry to delivery + registration + feedback, with strict form-gated stage transitions and first-class mobile UX.

**User Language**: Hindi / Hinglish — all replies to the user should be in Hinglish.

## Tech Stack
- **Backend**: FastAPI + Motor (MongoDB async) + JWT auth
- **Frontend**: React 19 + React Router 7 + TailwindCSS + Shadcn UI
- **i18n**: i18next (English + Gujarati)
- **Walkthroughs**: react-joyride
- **PWA**: manifest + service worker
- **LLM**: Gemini 3 Flash (Vision OCR via Emergent LLM Key)
- **Object Storage**: Emergent Object Storage (photos, documents)

## Architecture
```
/app
├── backend/
│   ├── server.py          # Monolithic FastAPI (auth, leads, funnel, bookings, deliveries, docs, WA, campaigns, users, branches, audit)
│   └── tests/             # pytest modules tests + strict funnel test
├── frontend/src/
│   ├── App.js             # Routes
│   ├── index.js           # PWA SW registration (prod only)
│   ├── components/
│   │   ├── Layout.jsx           # Mobile-first: hamburger drawer + desktop sidebar + bottom nav + FAB
│   │   ├── PageHeader.jsx       # Reusable header with back button + title
│   │   ├── GuideButton.jsx      # Floating "?" walkthrough (role-based, auto-start once)
│   │   ├── LanguageToggle.jsx   # EN/GU switch
│   │   ├── ProtectedRoute.jsx
│   │   ├── BookingSection, DeliverySection, DocumentsSection,
│   │   │   ExchangeSection, WhatsappSection (lead-scoped modules)
│   │   └── ui/                  # Shadcn components
│   ├── pages/
│   │   ├── Dashboard.jsx        # Role-based (Sales action / Admin control / CEO decision)
│   │   ├── Leads.jsx            # Mobile cards + desktop table
│   │   ├── LeadDetail.jsx       # Stage-flow indicator, form-gated transitions, tabs
│   │   ├── LeadForm.jsx
│   │   ├── Tasks.jsx            # Today/Missed/Upcoming/At Risk
│   │   ├── Funnel.jsx           # Kanban
│   │   ├── Whatsapp.jsx         # Global WA hub
│   │   ├── Automation.jsx, Campaigns.jsx
│   │   ├── Users.jsx, Branches.jsx, AuditLogs.jsx, Masters.jsx
│   │   └── Login.jsx
│   └── i18n/ (en.json, gu.json)
└── frontend/public/
    ├── manifest.json
    ├── service-worker.js
    ├── icons/icon-192.png, icon-512.png
    └── index.html  (manifest link, theme-color #ED1C24)
```

## Core Funnel — Simplified (Iter 18+)
Inquiry → Follow-up → Hold → Booking → Delivery → Allotment → Feedback → Lost

**Customer Type routing on Lead create (Iter 19):**
- "Instant Buyer" → starts at Inquiry, identity docs (Aadhaar+PAN+Other) collected
- "Token Finance Buyer" → starts at Inquiry, identity docs collected
- "Just Inquiry" → starts directly at Follow-up, no docs required

**Finance docs simplified (Iter 20):** Aadhaar Card + PAN Card + Bank Passbook (was: Bank Statement)
**Follow-up form simplified (Iter 20):** default 4 fields (Type, Notes*, Next Date*, Next Time); 6 secondary fields behind "Show advanced" toggle.

## What's Implemented
(See CHANGELOG below.)

## Mobile UX Principles
- Hamburger drawer (left sheet) for full nav
- Bottom nav (Home/Leads/Tasks/WhatsApp) — z-index 10000 (above preview watermark)
- Floating FAB "+" for new lead
- Floating "?" guide button (role-aware Joyride)
- Card lists on <sm viewports, tables on ≥sm
- Min 40-44px tap targets
- Safe-area-inset-bottom support for notched devices

## PWA
- `manifest.json` with theme #ED1C24
- `service-worker.js` (cache-first static, network-first nav, no API cache)
- Registered in `index.js` only when `NODE_ENV=production`

## CHANGELOG
See `/app/memory/CHANGELOG.md`

## Next Actions / Roadmap
See `/app/memory/ROADMAP.md`
