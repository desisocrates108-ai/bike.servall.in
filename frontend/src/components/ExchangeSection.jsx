import React, { useEffect, useRef, useState } from "react";
import { api, API, formatApiErrorDetail } from "../api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import { ImagePlus, Handshake, Upload, FileText, Camera } from "lucide-react";

const Card = ({ title, children, right }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

function fileUrl(fid) {
  if (!fid) return null;
  return `${API}/files/${fid}?auth=${encodeURIComponent(localStorage.getItem("access_token") || "")}`;
}

export default function ExchangeSection({ lead, constants, onReload }) {
  const fileRef = useRef(null);
  const [form, setForm] = useState({
    old_model: "", registration_number: "", model_year: "",
    tyre_condition: "", battery_condition: "", body_condition: "",
    self_start: false, finance_on_rc: false,
    expected_price: "", offered_price: "", final_value: "",
    notes: "",
  });
  const [valuations, setValuations] = useState([]);
  const [valForm, setValForm] = useState({ source: "broker", value: "", remarks: "" });

  useEffect(() => {
    const e = lead.exchange || {};
    setForm({
      old_model: e.old_model || "",
      registration_number: e.registration_number || "",
      model_year: e.model_year ?? "",
      tyre_condition: e.tyre_condition || "",
      battery_condition: e.battery_condition || "",
      body_condition: e.body_condition || "",
      self_start: !!e.self_start,
      finance_on_rc: !!e.finance_on_rc,
      expected_price: e.expected_price ?? "",
      offered_price: e.offered_price ?? "",
      final_value: e.final_value ?? "",
      notes: e.notes || "",
    });
    api.get(`/leads/${lead.id}/exchange-valuations`).then((r) => setValuations(r.data));
  }, [lead.id, lead.exchange]);

  const save = async () => {
    try {
      const n = (v) => v === "" || v == null ? null : Number(v);
      const payload = {
        exchange: {
          old_model: form.old_model || null,
          registration_number: form.registration_number || null,
          model_year: n(form.model_year),
          tyre_condition: form.tyre_condition || null,
          battery_condition: form.battery_condition || null,
          body_condition: form.body_condition || null,
          self_start: form.self_start,
          finance_on_rc: form.finance_on_rc,
          expected_price: n(form.expected_price),
          offered_price: n(form.offered_price),
          final_value: n(form.final_value),
          notes: form.notes || null,
          photos: (lead.exchange || {}).photos || [],
        },
      };
      await api.put(`/leads/${lead.id}`, payload);
      toast.success("Exchange saved");
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const addValuation = async () => {
    try {
      if (!valForm.value) { toast.error("Value required"); return; }
      await api.post(`/leads/${lead.id}/exchange-valuations`, {
        source: valForm.source,
        value: Number(valForm.value),
        remarks: valForm.remarks || null,
      });
      setValForm({ source: "broker", value: "", remarks: "" });
      toast.success("Valuation added");
      const r = await api.get(`/leads/${lead.id}/exchange-valuations`);
      setValuations(r.data);
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const uploadPhoto = async (file, docType = "photo") => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      await api.post(`/leads/${lead.id}/exchange-photos`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
        params: { doc_type: docType },
      });
      toast.success("Uploaded");
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const deleteFile = async (fileId) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      await api.delete(`/leads/${lead.id}/exchange-photos/${fileId}`);
      toast.success("Deleted");
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const photos = (lead.exchange || {}).photos || [];
  const documents = (lead.exchange || {}).documents || {};

  return (
    <>
      <Card title="Old Vehicle">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="overline">Old Vehicle Model</Label>
            <Input value={form.old_model} onChange={(e) => setForm({ ...form, old_model: e.target.value })} className="mt-2" data-testid="exch-old-model" />
          </div>
          <div>
            <Label className="overline">Registration Number</Label>
            <Input value={form.registration_number} onChange={(e) => setForm({ ...form, registration_number: e.target.value })} className="mt-2 font-mono" data-testid="exch-reg" />
          </div>
          <div>
            <Label className="overline">Model Year</Label>
            <Input type="number" value={form.model_year} onChange={(e) => setForm({ ...form, model_year: e.target.value })} className="mt-2" />
          </div>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.self_start} onChange={(e) => setForm({ ...form, self_start: e.target.checked })} /> Self Start
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.finance_on_rc} onChange={(e) => setForm({ ...form, finance_on_rc: e.target.checked })} /> Finance on RC
            </label>
          </div>
        </div>
      </Card>

      <Card title="Inspection">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[["tyre_condition", "Tyre"], ["battery_condition", "Battery"], ["body_condition", "Body"]].map(([k, l]) => (
            <div key={k}>
              <Label className="overline">{l}</Label>
              <Select value={form[k] || "__NONE__"} onValueChange={(v) => setForm({ ...form, [k]: v === "__NONE__" ? "" : v })}>
                <SelectTrigger className="mt-2" data-testid={`exch-${k}`}><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">—</SelectItem>
                  {constants?.exchange_conditions?.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </Card>

      <Card
        title="Pricing"
        right={
          <Button size="sm" onClick={save} className="bg-brand hover:bg-brand-dark rounded-sm font-bold" data-testid="exch-save-btn">
            Save
          </Button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="overline">Customer Expected</Label>
            <Input type="number" value={form.expected_price} onChange={(e) => setForm({ ...form, expected_price: e.target.value })} className="mt-2" data-testid="exch-expected" />
          </div>
          <div>
            <Label className="overline">Dealer Initial Offer</Label>
            <Input type="number" value={form.offered_price} onChange={(e) => setForm({ ...form, offered_price: e.target.value })} className="mt-2" data-testid="exch-offer" />
          </div>
          <div>
            <Label className="overline">Final Exchange Value *</Label>
            <Input type="number" value={form.final_value} onChange={(e) => setForm({ ...form, final_value: e.target.value })} className="mt-2 font-bold" data-testid="exch-final" />
            <div className="text-xs text-zinc-500 mt-1">Auto-reduces final payable on the booking.</div>
          </div>
          <div className="md:col-span-3">
            <Label className="overline">Notes</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-2" />
          </div>
        </div>
      </Card>

      <Card
        title="Valuation history"
        right={
          <div className="flex gap-2">
            <Select value={valForm.source} onValueChange={(v) => setValForm({ ...valForm, source: v })}>
              <SelectTrigger className="h-9 w-32" data-testid="val-source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="broker">Broker</SelectItem>
                <SelectItem value="internal">Internal</SelectItem>
                <SelectItem value="online">Online</SelectItem>
              </SelectContent>
            </Select>
            <Input type="number" placeholder="value" className="h-9 w-28" value={valForm.value} onChange={(e) => setValForm({ ...valForm, value: e.target.value })} data-testid="val-value" />
            <Input placeholder="remarks" className="h-9 w-40" value={valForm.remarks} onChange={(e) => setValForm({ ...valForm, remarks: e.target.value })} />
            <Button size="sm" onClick={addValuation} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid="val-add-btn">
              <Handshake className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        }
      >
        {valuations.length === 0 && <div className="text-sm text-zinc-400">No valuations recorded yet.</div>}
        {valuations.length > 0 && (
          <table className="data-table w-full">
            <thead>
              <tr><th>Date</th><th>Source</th><th style={{ textAlign: "right" }}>Value</th><th>Remarks</th><th>By</th></tr>
            </thead>
            <tbody>
              {valuations.map((v) => (
                <tr key={v.id} data-testid={`val-row-${v.id}`}>
                  <td className="font-mono text-sm">{new Date(v.created_at).toLocaleDateString()}</td>
                  <td className="uppercase text-xs font-bold">{v.source}</td>
                  <td className="font-mono font-bold" style={{ textAlign: "right" }}>₹{v.value}</td>
                  <td className="text-zinc-600">{v.remarks || "—"}</td>
                  <td className="text-zinc-500 text-xs">{v.created_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card
        title="Vehicle Documents & Images"
        right={<span className="text-xs text-zinc-500">5 mandatory slots</span>}
      >
        {/* Documents block */}
        <div className="overline mb-2">Identity & Ownership Documents</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5" data-testid="exch-doc-slots">
          <DocSlot
            label="Aadhaar Front"
            testid="slot-aadhaar"
            docType="aadhaar"
            required
            imageOnly={false}
            fileIds={documents.aadhaar || []}
            onUpload={(f) => uploadPhoto(f, "aadhaar")}
            onDelete={deleteFile}
          />
          <DocSlot
            label="Aadhaar Back"
            testid="slot-aadhaar-back"
            docType="aadhaar_back"
            required
            imageOnly={false}
            fileIds={documents.aadhaar_back || []}
            onUpload={(f) => uploadPhoto(f, "aadhaar_back")}
            onDelete={deleteFile}
          />
          <DocSlot
            label="RC Book"
            testid="slot-rc-book"
            docType="rc_book"
            required
            imageOnly={false}
            fileIds={documents.rc_book || []}
            onUpload={(f) => uploadPhoto(f, "rc_book")}
            onDelete={deleteFile}
          />
        </div>

        {/* Vehicle Photos block */}
        <div className="overline mb-2">Vehicle Photos</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5" data-testid="exch-photo-slots">
          <DocSlot
            label="Front Photo"
            testid="slot-front"
            docType="front_photo"
            required
            imageOnly
            fileIds={documents.front_photo || []}
            onUpload={(f) => uploadPhoto(f, "front_photo")}
            onDelete={deleteFile}
          />
          <DocSlot
            label="Back Photo"
            testid="slot-back"
            docType="back_photo"
            required
            imageOnly
            fileIds={documents.back_photo || []}
            onUpload={(f) => uploadPhoto(f, "back_photo")}
            onDelete={deleteFile}
          />
        </div>

        {/* Other Documents */}
        <div className="overline mb-2">Other Documents (optional)</div>
        <DocSlot
          label="Other Documents"
          testid="slot-other"
          docType="other"
          multi
          imageOnly={false}
          fileIds={documents.other || []}
          onUpload={(f) => uploadPhoto(f, "other")}
          onDelete={deleteFile}
        />

        <div className="mt-4 text-xs">
          {(() => {
            const done =
              (documents.aadhaar?.length ? 1 : 0) +
              (documents.aadhaar_back?.length ? 1 : 0) +
              (documents.rc_book?.length ? 1 : 0) +
              (documents.front_photo?.length ? 1 : 0) +
              (documents.back_photo?.length ? 1 : 0);
            const otherN = (documents.other || []).length;
            return (
              <div className={`font-bold ${done === 5 ? "text-emerald-700" : "text-amber-700"}`} data-testid="exch-doc-progress">
                {done === 5
                  ? `✅ All 5 mandatory documents uploaded${otherN ? ` · +${otherN} other` : ""}`
                  : `⚠️ ${done}/5 mandatory documents — all required${otherN ? ` · +${otherN} other` : ""}`}
              </div>
            );
          })()}
        </div>
      </Card>

      {photos.length > 0 && (
        <Card
          title={`Legacy Photos (${photos.length})`}
          right={
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0], "photo")} data-testid="exch-photo-input" />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} className="rounded-sm" data-testid="exch-photo-btn">
                <ImagePlus className="w-4 h-4 mr-1" /> Add
              </Button>
            </>
          }
        >
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {photos.map((fid) => (
              <div key={fid} className="relative group">
                <a href={fileUrl(fid)} target="_blank" rel="noreferrer" className="block">
                  <img src={fileUrl(fid)} alt="" className="border border-zinc-200 w-full aspect-square object-cover" />
                </a>
                <button
                  onClick={() => deleteFile(fid)}
                  className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-sm w-5 h-5 text-xs font-bold opacity-0 group-hover:opacity-100"
                  data-testid={`exch-photo-del-${fid}`}
                >×</button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function DocSlot({ label, testid, docType, imageOnly, multi, required, fileIds, onUpload, onDelete }) {
  const captureRef = useRef(null);
  const uploadRef = useRef(null);
  const has = fileIds && fileIds.length > 0;
  const isImg = imageOnly === true || docType === "front_photo" || docType === "back_photo";
  return (
    <div
      className={`border-2 rounded-sm p-3 ${
        has && required ? "border-emerald-300 bg-emerald-50/30" :
        has && !required ? "border-blue-300 bg-blue-50/30" :
        required ? "border-dashed border-amber-300 bg-amber-50/30" :
        "border-dashed border-zinc-300 bg-zinc-50"
      }`}
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1">
          {label} {required && <span className="text-rose-600">*</span>}
          {multi && <span className="text-[9px] font-semibold text-zinc-500">(multi)</span>}
        </div>
        <span
          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
            has ? "bg-emerald-600 text-white" :
            required ? "bg-amber-500 text-white" :
            "bg-zinc-400 text-white"
          }`}
        >
          {has ? (multi ? fileIds.length : "✓") : (required ? "!" : "+")}
        </span>
      </div>

      {/* Hidden inputs — one for camera, one for gallery/file */}
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onUpload(e.target.files[0]);
            e.target.value = "";
          }
        }}
        data-testid={`${testid}-capture-input`}
      />
      <input
        ref={uploadRef}
        type="file"
        accept={isImg ? "image/*" : "image/*,application/pdf"}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onUpload(e.target.files[0]);
            e.target.value = "";
          }
        }}
        data-testid={`${testid}-upload-input`}
      />

      {/* Two separate action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => captureRef.current?.click()}
          className="rounded-sm font-semibold h-10 bg-white"
          data-testid={`${testid}-capture-btn`}
        >
          <Camera className="w-4 h-4 mr-1" /> {has && !multi ? "Re-capture" : "Capture"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => uploadRef.current?.click()}
          className="rounded-sm font-semibold h-10 bg-white"
          data-testid={`${testid}-upload-btn`}
        >
          <Upload className="w-4 h-4 mr-1" /> {has && !multi ? "Re-upload" : "Upload"}
        </Button>
      </div>

      {/* Preview area */}
      {has && (
        <div className="mt-3">
          <div className={isImg && fileIds.length > 1 ? "grid grid-cols-2 gap-1" : "space-y-1"}>
            {fileIds.map((fid) => {
              const url = fileUrl(fid);
              return (
                <div key={fid} className="relative group">
                  {isImg ? (
                    <a href={url} target="_blank" rel="noreferrer" className="block">
                      <img src={url} alt={label} className="border border-zinc-200 w-full aspect-square object-cover rounded-sm" />
                    </a>
                  ) : (
                    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 bg-white border border-zinc-200 rounded-sm text-xs font-mono hover:border-brand">
                      <FileText className="w-4 h-4 text-brand flex-shrink-0" />
                      <span className="truncate">File · {fid.slice(0, 8)}…</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(fid)}
                    className="absolute top-0.5 right-0.5 bg-rose-600 text-white rounded-sm w-6 h-6 text-xs font-bold opacity-90 group-hover:opacity-100 hover:bg-rose-700 flex items-center justify-center"
                    data-testid={`${testid}-del-${fid}`}
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
