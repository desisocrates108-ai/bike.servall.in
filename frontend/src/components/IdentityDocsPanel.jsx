import React from "react";
import { api, formatApiErrorDetail } from "../api";
import { toast } from "sonner";
import DocSlot from "./DocSlot";

const Card = ({ title, children, right, testid }) => (
  <div className="bg-white border border-zinc-200 rounded-sm p-5 mb-4" data-testid={testid}>
    <div className="flex items-center justify-between mb-4">
      <div className="overline">{title}</div>
      {right}
    </div>
    {children}
  </div>
);

/**
 * Identity documents panel — shared across New + Exchange leads.
 * Shows Aadhaar Front + Aadhaar Back (mandatory) + Other Documents (optional multi).
 */
export default function IdentityDocsPanel({ lead, onReload }) {
  const identity = lead.identity_docs || {};

  const upload = async (file, docType) => {
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
  const del = async (fileId) => {
    if (!window.confirm("Delete this file?")) return;
    try {
      await api.delete(`/leads/${lead.id}/exchange-photos/${fileId}`);
      toast.success("Deleted");
      onReload && onReload();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const doneMandatory =
    (identity.aadhaar?.length ? 1 : 0) + (identity.aadhaar_back?.length ? 1 : 0);
  const otherN = (identity.other || []).length;

  return (
    <Card
      title="Identity Documents (KYC)"
      right={<span className="text-xs text-zinc-500">Aadhaar Front + Back mandatory</span>}
      testid="kyc-card"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4" data-testid="kyc-identity-grid">
        <DocSlot
          label="Aadhaar Front"
          testid="kyc-aadhaar"
          docType="aadhaar"
          required
          fileIds={identity.aadhaar || []}
          onUpload={(f) => upload(f, "aadhaar")}
          onDelete={del}
        />
        <DocSlot
          label="Aadhaar Back"
          testid="kyc-aadhaar-back"
          docType="aadhaar_back"
          required
          fileIds={identity.aadhaar_back || []}
          onUpload={(f) => upload(f, "aadhaar_back")}
          onDelete={del}
        />
      </div>

      <div className="mb-3" data-testid="kyc-other-wrap">
        <div className="overline mb-2">Other Documents (optional)</div>
        <DocSlot
          label="Other Documents"
          testid="kyc-other"
          docType="other"
          multi
          optional
          fileIds={identity.other || []}
          onUpload={(f) => upload(f, "other")}
          onDelete={del}
        />
      </div>

      <div className={`text-xs font-bold ${doneMandatory === 2 ? "text-emerald-700" : "text-amber-700"}`} data-testid="kyc-progress">
        {doneMandatory === 2
          ? `✅ KYC complete (Aadhaar Front + Back)${otherN ? ` · +${otherN} other` : ""}`
          : `⚠️ ${doneMandatory}/2 mandatory KYC files — stage progression blocked${otherN ? ` · +${otherN} other` : ""}`}
      </div>
    </Card>
  );
}
