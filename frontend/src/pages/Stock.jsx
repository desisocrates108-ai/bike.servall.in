import React, { useEffect, useRef, useState } from "react";
import { api, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import PageHeader from "../components/PageHeader";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Upload, Plus, Search, Trash2, Boxes, FileSpreadsheet, X, AlertTriangle } from "lucide-react";

/**
 * Stock / Inventory page — chassis-level vehicle stock for Bilimora hub.
 * - Bulk upload via CSV / XLSX
 * - Manual single-row add
 * - List with status filter (available / booked / delivered)
 * - Delete (only for available items)
 */
export default function StockPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "super_admin" || user?.role === "admin";
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ status: "", brand: "", model: "", chassis: "" });
  const [showAdd, setShowAdd] = useState(false);
  const fileRef = useRef(null);
  const [uploadBusy, setUploadBusy] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.brand) params.brand = filter.brand;
      if (filter.model) params.model = filter.model;
      if (filter.chassis) params.chassis = filter.chassis;
      const { data } = await api.get("/inventory", { params });
      setItems(data || []);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [filter.status, filter.brand, filter.model, filter.chassis]); // eslint-disable-line

  const handleUpload = async (file) => {
    setUploadBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/inventory/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Added ${data.added} new · ${data.skipped_duplicates} duplicates skipped${data.errors?.length ? ` · ${data.errors.length} errors` : ""}`);
      if (data.errors?.length) {
        console.warn("Upload errors:", data.errors);
      }
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const handleDelete = async (iid) => {
    if (!window.confirm("Delete this stock item?")) return;
    try {
      await api.delete(`/inventory/${iid}`);
      toast.success("Deleted");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Delete failed");
    }
  };

  const counts = items.reduce((c, it) => {
    c[it.status || "other"] = (c[it.status || "other"] || 0) + 1;
    return c;
  }, {});

  return (
    <>
      <PageHeader title="Stock & Chassis" subtitle="Vehicle inventory hub" />
      <div className="container-tight py-4 space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          <KPI label="Available" value={counts.available || 0} tone="emerald" testid="stock-kpi-available" />
          <KPI label="Booked" value={counts.booked || 0} tone="amber" testid="stock-kpi-booked" />
          <KPI label="Total" value={items.length} tone="brand" testid="stock-kpi-total" />
        </div>

        {/* Actions */}
        {isAdmin && (
          <div className="bg-white border border-zinc-200 rounded-sm p-4 sm:p-5">
            <div className="overline mb-3">Add Stock</div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) { handleUpload(e.target.files[0]); e.target.value = ""; } }}
                data-testid="stock-upload-input"
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploadBusy}
                className="bg-brand hover:bg-brand-dark rounded-sm h-11 font-bold flex-1"
                data-testid="stock-upload-btn"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {uploadBusy ? "Uploading…" : "Upload CSV / Excel"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowAdd((v) => !v)}
                className="rounded-sm h-11 font-bold flex-1"
                data-testid="stock-add-toggle"
              >
                <Plus className="w-4 h-4 mr-2" /> {showAdd ? "Close" : "Add Single"}
              </Button>
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              CSV columns (case-insensitive): <code>brand</code>, <code>model</code>, <code>chassis_number</code> (mandatory) · optional: <code>variant</code>, <code>color</code>, <code>engine_number</code>, <code>notes</code>
            </div>
            {showAdd && <SingleAdd onSaved={reload} />}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white border border-zinc-200 rounded-sm p-3 grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="stock-filters">
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="h-10 rounded-sm border border-zinc-200 bg-white px-2 text-sm font-medium"
            data-testid="stock-filter-status"
          >
            <option value="">All statuses</option>
            <option value="available">Available</option>
            <option value="booked">Booked</option>
            <option value="delivered">Delivered</option>
          </select>
          <Input placeholder="Brand" value={filter.brand} onChange={(e) => setFilter((f) => ({ ...f, brand: e.target.value }))} data-testid="stock-filter-brand" />
          <Input placeholder="Model" value={filter.model} onChange={(e) => setFilter((f) => ({ ...f, model: e.target.value }))} data-testid="stock-filter-model" />
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-3 text-zinc-400" />
            <Input placeholder="Chassis…" className="pl-8" value={filter.chassis} onChange={(e) => setFilter((f) => ({ ...f, chassis: e.target.value }))} data-testid="stock-filter-chassis" />
          </div>
        </div>

        {/* List */}
        <div className="bg-white border border-zinc-200 rounded-sm overflow-x-auto" data-testid="stock-list">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left">
                <th className="px-3 py-2 overline">Brand / Model</th>
                <th className="px-3 py-2 overline">Variant / Color</th>
                <th className="px-3 py-2 overline">Chassis #</th>
                <th className="px-3 py-2 overline">Status</th>
                {isAdmin && <th className="px-3 py-2 overline w-20"></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading && (
                <tr><td colSpan={isAdmin ? 5 : 4} className="px-3 py-8 text-center text-zinc-400" data-testid="stock-empty">
                  <Boxes className="w-8 h-8 mx-auto mb-2 text-zinc-300" />
                  No stock items. Upload CSV/Excel or add manually.
                </td></tr>
              )}
              {items.map((it) => (
                <tr key={it.id} className="border-b border-zinc-100 hover:bg-zinc-50" data-testid={`stock-row-${it.id}`}>
                  <td className="px-3 py-2">
                    <div className="font-bold">{it.brand}</div>
                    <div className="text-xs text-zinc-500">{it.model}</div>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div>{it.variant || "—"}</div>
                    <div className="text-zinc-500">{it.color || ""}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{it.chassis_number}</td>
                  <td className="px-3 py-2">
                    <StatusBadge s={it.status} />
                  </td>
                  {isAdmin && (
                    <td className="px-3 py-2">
                      {it.status === "available" && (
                        <button
                          onClick={() => handleDelete(it.id)}
                          className="p-1.5 hover:bg-rose-50 rounded-sm text-rose-600"
                          data-testid={`stock-del-${it.id}`}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function KPI({ label, value, tone, testid }) {
  const cls = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    brand: "border-brand bg-brand/5 text-brand-dark",
  }[tone] || "border-zinc-200 bg-white";
  return (
    <div className={`border-2 rounded-sm p-3 ${cls}`} data-testid={testid}>
      <div className="overline">{label}</div>
      <div className="font-display font-bold text-2xl mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ s }) {
  const map = {
    available: "bg-emerald-100 text-emerald-800",
    booked: "bg-amber-100 text-amber-800",
    delivered: "bg-zinc-100 text-zinc-700",
  };
  return <span className={`text-[10px] font-bold px-2 py-1 rounded-sm uppercase ${map[s] || "bg-zinc-100 text-zinc-700"}`}>{s || "—"}</span>;
}

function SingleAdd({ onSaved }) {
  const [f, setF] = useState({ brand: "", model: "", variant: "", color: "", chassis_number: "", engine_number: "" });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!f.brand.trim() || !f.model.trim() || !f.chassis_number.trim()) {
      toast.error("Brand, Model and Chassis are required");
      return;
    }
    setBusy(true);
    try {
      await api.post("/inventory", f);
      toast.success("Added to stock");
      setF({ brand: "", model: "", variant: "", color: "", chassis_number: "", engine_number: "" });
      onSaved && onSaved();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail) || "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-zinc-200" data-testid="stock-single-form">
      <Input placeholder="Brand *" value={f.brand} onChange={(e) => setF((s) => ({ ...s, brand: e.target.value }))} data-testid="stock-add-brand" />
      <Input placeholder="Model *" value={f.model} onChange={(e) => setF((s) => ({ ...s, model: e.target.value }))} data-testid="stock-add-model" />
      <Input placeholder="Chassis Number *" value={f.chassis_number} onChange={(e) => setF((s) => ({ ...s, chassis_number: e.target.value }))} data-testid="stock-add-chassis" />
      <Input placeholder="Variant" value={f.variant} onChange={(e) => setF((s) => ({ ...s, variant: e.target.value }))} data-testid="stock-add-variant" />
      <Input placeholder="Color" value={f.color} onChange={(e) => setF((s) => ({ ...s, color: e.target.value }))} data-testid="stock-add-color" />
      <Input placeholder="Engine Number" value={f.engine_number} onChange={(e) => setF((s) => ({ ...s, engine_number: e.target.value }))} data-testid="stock-add-engine" />
      <Button onClick={save} disabled={busy} className="bg-brand hover:bg-brand-dark rounded-sm col-span-2 sm:col-span-3 h-10 font-bold" data-testid="stock-add-save">
        {busy ? "Saving…" : "Add to Stock"}
      </Button>
    </div>
  );
}
