import React, { useEffect, useState } from "react";
import { api, API, formatApiErrorDetail } from "../api";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "./ui/dialog";
import { toast } from "sonner";
import {
  Upload, Sparkles, ShieldCheck, ShieldX, FileText, Printer, AlertTriangle,
  CheckCircle2, Eye, History,
} from "lucide-react";

const statusClass = {
  Pending: "bg-amber-100 text-amber-700",
  Verified: "bg-emerald-100 text-emerald-700",
  Rejected: "bg-rose-100 text-rose-700",
};

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

export default function DocumentsSection({ lead, constants, onReload }) {
  const { user } = useAuth();
  const isManager = user?.role === "admin" || user?.role === "super_admin";

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  // Upload form
  const [upload, setUpload] = useState({ doc_type: "Aadhaar Card", doc_number: "", notes: "" });
  const [frontFile, setFrontFile] = useState(null);
  const [backFile, setBackFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [rejectFor, setRejectFor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [viewingDoc, setViewingDoc] = useState(null);
  const [duplicates, setDuplicates] = useState([]);

  const reload = async () => {
    setLoading(true);
    const { data } = await api.get(`/leads/${lead.id}/documents`, { params: { include_history: showHistory } });
    setDocs(data);
    setLoading(false);
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, [lead?.id, showHistory]);

  const submitUpload = async (e) => {
    e.preventDefault();
    if (!frontFile) {
      toast.error("Front image is required");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("doc_type", upload.doc_type);
      if (upload.doc_number) fd.append("doc_number", upload.doc_number);
      if (upload.notes) fd.append("notes", upload.notes);
      fd.append("front", frontFile);
      if (backFile) fd.append("back", backFile);
      await api.post(`/leads/${lead.id}/documents`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Document uploaded");
      setUpload({ doc_type: "Aadhaar Card", doc_number: "", notes: "" });
      setFrontFile(null);
      setBackFile(null);
      await reload();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setUploading(false);
    }
  };

  const runOcr = async (did) => {
    toast.info("Running OCR via Gemini...");
    try {
      await api.post(`/documents/${did}/ocr`);
      toast.success("OCR complete");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const saveExtracted = async (doc, newExtracted, newNumber) => {
    try {
      await api.put(`/documents/${doc.id}`, {
        extracted: newExtracted,
        doc_number: newNumber,
      });
      toast.success("Saved");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const verify = async (did) => {
    try {
      await api.post(`/documents/${did}/verify`);
      toast.success("Verified");
      reload();
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const reject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Reason required");
      return;
    }
    try {
      await api.post(`/documents/${rejectFor}/reject`, { reason: rejectReason });
      toast.success("Rejected");
      setRejectFor(null);
      setRejectReason("");
      reload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const loadDuplicates = async (did) => {
    try {
      const { data } = await api.get(`/documents/${did}/duplicates`);
      setDuplicates(data);
    } catch {
      setDuplicates([]);
    }
  };

  return (
    <>
      <Card
        title="Upload document"
        right={
          <label className="flex items-center gap-2 text-xs text-zinc-600 select-none">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
              data-testid="toggle-history"
            />
            Show history
          </label>
        }
      >
        <form onSubmit={submitUpload} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="overline">Document Type *</Label>
            <Select value={upload.doc_type} onValueChange={(v) => setUpload({ ...upload, doc_type: v })}>
              <SelectTrigger className="mt-2" data-testid="upload-doc-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {constants?.doc_types?.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="overline">Document Number (optional)</Label>
            <Input value={upload.doc_number} onChange={(e) => setUpload({ ...upload, doc_number: e.target.value })} className="mt-2 font-mono" data-testid="upload-doc-number" />
          </div>
          <div>
            <Label className="overline">Front (image/pdf) *</Label>
            <Input required type="file" accept="image/*,application/pdf" onChange={(e) => setFrontFile(e.target.files?.[0] || null)} className="mt-2" data-testid="upload-front" />
          </div>
          <div>
            <Label className="overline">Back (optional)</Label>
            <Input type="file" accept="image/*,application/pdf" onChange={(e) => setBackFile(e.target.files?.[0] || null)} className="mt-2" data-testid="upload-back" />
          </div>
          <div className="md:col-span-2">
            <Label className="overline">Notes</Label>
            <Textarea rows={2} value={upload.notes} onChange={(e) => setUpload({ ...upload, notes: e.target.value })} className="mt-2" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" disabled={uploading} className="rounded-sm bg-brand hover:bg-brand-dark font-bold" data-testid="upload-submit">
              <Upload className="w-4 h-4 mr-1" /> {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </form>
      </Card>

      {loading && <div className="text-sm text-zinc-400">Loading documents...</div>}
      {!loading && docs.length === 0 && <div className="text-sm text-zinc-400">No documents uploaded yet.</div>}

      <div className="space-y-3">
        {docs.map((d) => (
          <DocumentCard
            key={d.id}
            doc={d}
            onOcr={() => runOcr(d.id)}
            onSave={(ext, num) => saveExtracted(d, ext, num)}
            onVerify={() => verify(d.id)}
            onReject={() => setRejectFor(d.id)}
            onView={() => { setViewingDoc(d); loadDuplicates(d.id); }}
            isManager={isManager}
          />
        ))}
      </div>

      <Dialog open={!!rejectFor} onOpenChange={(v) => !v && setRejectFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject document</DialogTitle></DialogHeader>
          <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Reason..." data-testid="reject-reason-input" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>Cancel</Button>
            <Button onClick={reject} className="bg-rose-600 hover:bg-rose-700" data-testid="confirm-reject-btn">Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingDoc} onOpenChange={(v) => !v && setViewingDoc(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{viewingDoc?.doc_type}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {viewingDoc?.front_file_id && (
              <a href={fileUrl(viewingDoc.front_file_id)} target="_blank" rel="noreferrer" className="block">
                <div className="overline mb-1">Front</div>
                <img src={fileUrl(viewingDoc.front_file_id)} alt="front" className="border border-zinc-200 w-full" />
              </a>
            )}
            {viewingDoc?.back_file_id && (
              <a href={fileUrl(viewingDoc.back_file_id)} target="_blank" rel="noreferrer" className="block">
                <div className="overline mb-1">Back</div>
                <img src={fileUrl(viewingDoc.back_file_id)} alt="back" className="border border-zinc-200 w-full" />
              </a>
            )}
          </div>
          {duplicates.length > 0 && (
            <div className="mt-4 p-3 border border-amber-200 bg-amber-50 rounded-sm">
              <div className="flex items-center gap-2 text-amber-800 text-sm font-semibold mb-2">
                <AlertTriangle className="w-4 h-4" /> Duplicate detected
              </div>
              <ul className="text-xs space-y-1">
                {duplicates.map((du) => (
                  <li key={du.id}>
                    Lead <span className="font-mono">{du.lead_id.slice(0, 8)}</span> · {du.customer_name} · {du.status}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocumentCard({ doc, onOcr, onSave, onVerify, onReject, onView, isManager }) {
  const [editing, setEditing] = useState(false);
  const [extracted, setExtracted] = useState(doc.extracted || {});
  const [docNumber, setDocNumber] = useState(doc.doc_number || "");

  useEffect(() => {
    setExtracted(doc.extracted || {});
    setDocNumber(doc.doc_number || "");
  }, [doc]);

  const confLow = (extracted.confidence_score ?? 1) < 0.6;

  return (
    <div className="bg-white border border-zinc-200 rounded-sm p-4" data-testid={`doc-${doc.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className="w-4 h-4 text-zinc-500" />
            <span className="font-semibold text-sm">{doc.doc_type}</span>
            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${statusClass[doc.status]}`}>{doc.status}</span>
            <span className="text-[10px] font-mono text-zinc-500">v{doc.version}</span>
            {doc.ocr_ran && (
              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${confLow ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                OCR {confLow ? "· Manual check" : "✓"}
              </span>
            )}
            {!doc.is_latest && <span className="text-[10px] text-zinc-400 uppercase">archived</span>}
          </div>
          <div className="text-xs text-zinc-500 mt-1 font-mono">
            {doc.doc_number_masked || doc.doc_number || <span className="text-zinc-400">No number</span>}
          </div>
          {doc.rejection_reason && (
            <div className="text-xs text-rose-700 mt-1">Rejected: {doc.rejection_reason}</div>
          )}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" className="rounded-sm" onClick={onView} data-testid={`view-${doc.id}`}>
            <Eye className="w-3 h-3" />
          </Button>
          {doc.is_latest && (
            <>
              <Button size="sm" variant="outline" className="rounded-sm" onClick={onOcr} data-testid={`ocr-${doc.id}`}>
                <Sparkles className="w-3 h-3 mr-1" /> OCR
              </Button>
              <Button size="sm" variant="outline" className="rounded-sm" onClick={() => setEditing(!editing)} data-testid={`edit-${doc.id}`}>
                {editing ? "Close" : "Edit"}
              </Button>
              {isManager && doc.status !== "Verified" && (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-sm" onClick={onVerify} data-testid={`verify-${doc.id}`}>
                  <ShieldCheck className="w-3 h-3 mr-1" /> Verify
                </Button>
              )}
              {isManager && doc.status !== "Rejected" && (
                <Button size="sm" variant="outline" className="rounded-sm border-rose-200 text-rose-700" onClick={onReject} data-testid={`reject-${doc.id}`}>
                  <ShieldX className="w-3 h-3 mr-1" /> Reject
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-4 pt-4 border-t border-zinc-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label className="overline">Doc Number</Label>
            <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} className="mt-2 font-mono" />
          </div>
          {["name", "address", "chassis_number", "engine_number", "vehicle_model", "variant"].map((k) => (
            <div key={k}>
              <Label className="overline">{k.replace(/_/g, " ")}</Label>
              <Input value={extracted[k] || ""} onChange={(e) => setExtracted({ ...extracted, [k]: e.target.value })} className="mt-2" data-testid={`ext-${k}-${doc.id}`} />
            </div>
          ))}
          {extracted.confidence_score !== undefined && (
            <div className="md:col-span-2 text-xs text-zinc-500">
              Confidence: <span className="font-mono">{(Number(extracted.confidence_score) * 100).toFixed(0)}%</span>
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button size="sm" onClick={() => { onSave(extracted, docNumber); setEditing(false); }} className="bg-brand hover:bg-brand-dark rounded-sm" data-testid={`save-ext-${doc.id}`}>
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
