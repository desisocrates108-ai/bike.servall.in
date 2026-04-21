import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Mobile-first reusable header with back button + title.
 * Desktop: inline card heading; Mobile: handled by Layout top bar.
 * Still show this for page-level H1 on all viewports.
 */
export default function PageHeader({
  title,
  subtitle,
  showBack = true,
  backTo,
  right,
  sticky = false,
}) {
  const nav = useNavigate();
  const loc = useLocation();
  const isRoot = loc.pathname === "/dashboard";

  const handleBack = () => {
    if (backTo) nav(backTo);
    else if (window.history.length > 1) nav(-1);
    else nav("/dashboard");
  };

  return (
    <div
      className={`bg-white border-b border-zinc-200 px-4 py-3 sm:px-6 sm:py-4 ${
        sticky ? "sticky top-0 z-20" : ""
      }`}
      data-testid="page-header"
    >
      <div className="flex items-center gap-3">
        {showBack && !isRoot && (
          <button
            onClick={handleBack}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-zinc-100 active:bg-zinc-200 transition-colors flex-shrink-0"
            aria-label="Back"
            data-testid="page-back-btn"
          >
            <ArrowLeft className="w-5 h-5" strokeWidth={2} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight truncate" data-testid="page-title">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {right && <div className="flex-shrink-0">{right}</div>}
      </div>
    </div>
  );
}
