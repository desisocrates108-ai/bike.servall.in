import React, { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { api } from "../api";
import {
  REPORT_TYPES,
  exportToExcel,
  exportToPDF,
} from "../utils/exportReports";

/**
 * Download Reports menu — shows on Reports & Analytics page.
 * Props:
 *  - leads: array of lead objects (already filtered by branch in parent)
 *  - users: array of user objects
 *  - branches: array of branch objects
 *  - branchFilter: current branch_id filter (or empty)
 */
export default function DownloadReportsMenu({ leads = [], users = [], branches = [], branchFilter = "" }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null); // `${reportId}-${format}`
  const ref = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function fetchBookingsIfNeeded(reportId) {
    if (reportId !== "booking") return null;
    try {
      const params = branchFilter ? { branch_id: branchFilter } : {};
      const res = await api.get("/bookings", { params });
      return res.data || [];
    } catch (err) {
      console.error("Failed to fetch bookings", err);
      return [];
    }
  }

  async function handleExport(report, format) {
    const key = `${report.id}-${format}`;
    setBusy(key);
    try {
      const bookings = await fetchBookingsIfNeeded(report.id);
      const data = report.builder({
        leads,
        users,
        branches,
        bookings: bookings || [],
      });
      if (format === "xlsx") exportToExcel(data);
      else exportToPDF(data);
      setOpen(false);
    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to generate report. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 h-10 px-4 rounded-sm bg-brand text-white text-sm font-medium hover:bg-brand-dark focus:outline-none"
        data-testid="download-reports-btn"
      >
        <Download size={16} />
        Download Reports
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] bg-white border border-zinc-200 rounded-sm shadow-lg z-50"
          data-testid="download-reports-menu"
        >
          <div className="px-3 py-2 border-b border-zinc-100 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Select report &amp; format
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {REPORT_TYPES.map((r) => (
              <div
                key={r.id}
                className="px-3 py-2 border-b border-zinc-50 last:border-b-0 hover:bg-zinc-50"
              >
                <div className="text-sm font-medium text-zinc-800 mb-1">{r.label}</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy === `${r.id}-xlsx`}
                    onClick={() => handleExport(r, "xlsx")}
                    className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-sm bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
                    data-testid={`export-${r.id}-xlsx`}
                  >
                    {busy === `${r.id}-xlsx` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <FileSpreadsheet size={12} />
                    )}
                    Excel
                  </button>
                  <button
                    type="button"
                    disabled={busy === `${r.id}-pdf`}
                    onClick={() => handleExport(r, "pdf")}
                    className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-sm bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                    data-testid={`export-${r.id}-pdf`}
                  >
                    {busy === `${r.id}-pdf` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <FileText size={12} />
                    )}
                    PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-zinc-100 text-[11px] text-zinc-400">
            {branchFilter ? "Reports respect current branch filter." : "Reports include all accessible data."}
          </div>
        </div>
      )}
    </div>
  );
}
