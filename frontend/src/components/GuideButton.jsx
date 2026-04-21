import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Joyride, STATUS } from "react-joyride";
import { HelpCircle } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useLocation } from "react-router-dom";

/**
 * Floating "?" guide button – role-aware walkthrough.
 * Uses react-joyride to overlay step-by-step hints.
 */
const buildSteps = (role, t, path) => {
  // Global steps tailored per path
  const dashSteps = [
    {
      target: '[data-testid="page-title"]',
      content: t("guide.dash_title", "This is your home. Key numbers and actions for the day."),
      disableBeacon: true,
    },
    {
      target: '[data-testid="bottom-nav-home"]',
      content: t("guide.bottom_nav", "Quickly jump between Home, Leads, Tasks, and WhatsApp."),
    },
    {
      target: '[data-testid="fab-new-lead"]',
      content: t("guide.fab", "Tap this + button to add a new inquiry anywhere."),
    },
  ];
  const leadsSteps = [
    {
      target: '[data-testid="page-title"]',
      content: t("guide.leads_title", "All your leads live here. Tap a card to open details."),
      disableBeacon: true,
    },
    {
      target: '[data-testid="search-input"]',
      content: t("guide.leads_search", "Search by customer name or phone instantly."),
    },
    {
      target: '[data-testid="new-lead-btn"]',
      content: t("guide.leads_new", "Create a new lead with a one-screen form."),
    },
  ];
  const leadDetailSteps = [
    {
      target: '[data-testid="lead-stage-badge"]',
      content: t("guide.lead_stage", "This is the current funnel stage. Each next stage has mandatory fields."),
      disableBeacon: true,
    },
    {
      target: '[data-testid="stage-flow"]',
      content: t("guide.stage_flow", "Tap ▶ Next to advance. Missing fields are highlighted in red."),
    },
    {
      target: '[data-testid="tab-followups"]',
      content: t("guide.lead_followups", "Log every call or WhatsApp here — it moves the funnel forward."),
    },
  ];
  const tasksSteps = [
    {
      target: '[data-testid="page-title"]',
      content: t("guide.tasks_title", "Your daily action queue. Focus on 'Today' and 'Missed'."),
      disableBeacon: true,
    },
  ];
  const waSteps = [
    {
      target: '[data-testid="page-title"]',
      content: t("guide.wa_title", "WhatsApp hub: templates, automation rules, and campaigns."),
      disableBeacon: true,
    },
  ];

  if (path.startsWith("/leads/") && path !== "/leads/new") return leadDetailSteps;
  if (path.startsWith("/leads")) return leadsSteps;
  if (path.startsWith("/tasks")) return tasksSteps;
  if (path.startsWith("/whatsapp") || path.startsWith("/automation") || path.startsWith("/campaigns"))
    return waSteps;

  // Dashboard / default — role-specific flavour
  if (role === "sales_executive") {
    return [
      ...dashSteps,
      {
        target: '[data-testid="bottom-nav-tasks"]',
        content: t("guide.sales_tasks", "Check Tasks every morning — never miss a follow-up."),
      },
    ];
  }
  if (role === "admin") {
    return [
      ...dashSteps,
      {
        target: '[data-testid="admin-section"]',
        content: t("guide.admin", "Monitor branch performance, funnel drop-offs, and team tracking."),
      },
    ];
  }
  // super_admin / CEO
  return [
    ...dashSteps,
    {
      target: '[data-testid="ceo-insights"]',
      content: t("guide.ceo", "Compare branches, conversion rates, and spot loss reasons."),
    },
  ];
};

export default function GuideButton() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const loc = useLocation();
  const [run, setRun] = useState(false);

  // Auto-start on first login (per browser)
  React.useEffect(() => {
    try {
      const seen = localStorage.getItem("servall_guide_seen");
      if (!seen && user) {
        const t1 = setTimeout(() => setRun(true), 1200);
        return () => clearTimeout(t1);
      }
    } catch { /* noop */ }
  }, [user]);

  const steps = buildSteps(user?.role, t, loc.pathname);

  const handleCallback = (data) => {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(data.status)) {
      setRun(false);
      try { localStorage.setItem("servall_guide_seen", "1"); } catch { /* noop */ }
    }
  };

  return (
    <>
      <button
        onClick={() => setRun(true)}
        className="fixed z-40 left-4 md:left-auto md:right-6 bottom-24 md:bottom-6 w-12 h-12 rounded-full bg-brand text-white shadow-lg hover:bg-brand-dark active:scale-95 transition-all flex items-center justify-center"
        aria-label="Help"
        data-testid="guide-btn"
      >
        <HelpCircle className="w-6 h-6" strokeWidth={2} />
      </button>
      <Joyride
        key={`${loc.pathname}-${i18n.language}`}
        steps={steps}
        run={run}
        continuous
        showSkipButton
        showProgress
        disableScrolling={false}
        locale={{
          back: t("guide.back", "Back"),
          close: t("guide.close", "Close"),
          last: t("guide.finish", "Got it"),
          next: t("guide.next", "Next"),
          skip: t("guide.skip", "Skip"),
        }}
        styles={{
          options: {
            primaryColor: "#ED1C24",
            zIndex: 10000,
            arrowColor: "#fff",
            backgroundColor: "#fff",
            textColor: "#09090b",
          },
          buttonNext: { borderRadius: 4, fontWeight: 700 },
          buttonBack: { color: "#52525b" },
        }}
        callback={handleCallback}
      />
    </>
  );
}
