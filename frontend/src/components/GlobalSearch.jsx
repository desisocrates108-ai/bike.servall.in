import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, X, Phone } from "lucide-react";
import { api } from "../api";
import { stageClass } from "../lib/labels";

/**
 * Global search — customer name / phone / lead id / vehicle.
 * Uses /api/leads?search= which is already RBAC scoped at the backend
 * (super_admin → all, admin → own branch, sales → own leads).
 */
export default function GlobalSearch() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults([]);
      return;
    }
    const h = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/leads", { params: { search: q, page_size: 12 } });
        setResults(data || []);
      } catch { /* noop */ }
      setLoading(false);
    }, 220);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (id) => {
    nav(`/leads/${id}`);
    setQ("");
    setOpen(false);
    setMobileOpen(false);
  };

  const input = (autoFocus = false, testidSuffix = "") => (
    <div className="relative w-full" ref={boxRef}>
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
      <input
        type="search"
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={t("search.placeholder", "Search name, phone, lead…")}
        className="w-full pl-9 pr-9 h-10 rounded-sm border border-zinc-200 bg-white text-sm focus:outline-none focus:border-brand"
        data-testid={`global-search-input${testidSuffix}`}
      />
      {q && (
        <button
          onClick={() => { setQ(""); setResults([]); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-900"
          aria-label="Clear"
          data-testid="global-search-clear"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {open && q.length >= 2 && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-white border border-zinc-200 rounded-sm shadow-lg max-h-96 overflow-auto z-50"
          data-testid="global-search-results"
        >
          {loading && <div className="p-3 text-xs text-zinc-400">{t("common.loading")}</div>}
          {!loading && results.length === 0 && (
            <div className="p-3 text-xs text-zinc-400">{t("search.no_results", "No results")}</div>
          )}
          {results.map((l) => (
            <button
              key={l.id}
              onClick={() => go(l.id)}
              className="w-full flex items-center justify-between gap-3 px-3 py-2 hover:bg-zinc-50 active:bg-zinc-100 text-left border-b border-zinc-100 last:border-0"
              data-testid={`global-search-item-${l.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm truncate">{l.customer_name}</div>
                <div className="text-xs text-zinc-500 font-mono flex items-center gap-1 truncate">
                  <Phone className="w-3 h-3 flex-shrink-0" /> {l.phone}
                </div>
              </div>
              <span className={`flex-shrink-0 inline-block px-1.5 py-0.5 rounded-sm text-[10px] font-bold uppercase ${stageClass(l.stage)}`}>
                {l.stage}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop inline */}
      <div className="hidden md:block w-full">{input(false, "")}</div>

      {/* Mobile collapsible */}
      <button
        onClick={() => setMobileOpen(true)}
        className="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100 active:bg-zinc-200"
        aria-label="Search"
        data-testid="global-search-btn-mobile"
      >
        <Search className="w-5 h-5" strokeWidth={2} />
      </button>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white" data-testid="global-search-sheet">
          <div className="flex items-center gap-2 p-3 border-b border-zinc-200">
            <button
              onClick={() => { setMobileOpen(false); setQ(""); }}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-zinc-100"
              aria-label="Close"
              data-testid="global-search-close-mobile"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1">{input(true, "-mobile")}</div>
          </div>
        </div>
      )}
    </>
  );
}
