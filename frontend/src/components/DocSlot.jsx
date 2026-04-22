import React, { useRef } from "react";
import { Button } from "./ui/button";
import { API } from "../api";
import { Camera, Upload, FileText } from "lucide-react";

export function fileUrl(fid) {
  if (!fid) return null;
  return `${API}/files/${fid}?auth=${encodeURIComponent(localStorage.getItem("access_token") || "")}`;
}

/**
 * Shared DocSlot for uploaded files on an existing Lead (LeadDetail side).
 * Always renders TWO separate buttons:
 *  - 📷 Capture → hidden input with capture=environment (mobile rear cam)
 *  - ⬆️ Upload  → hidden input without capture (gallery/file picker, supports PDF for docs)
 */
export default function DocSlot({
  label, testid, docType, imageOnly, multi, required, optional,
  fileIds = [], onUpload, onDelete,
}) {
  const captureRef = useRef(null);
  const uploadRef = useRef(null);
  const has = fileIds && fileIds.length > 0;
  const isImg = imageOnly === true
    || docType === "front_photo" || docType === "back_photo"
    || docType === "aadhaar" || docType === "aadhaar_back"
    || docType === "rc_front" || docType === "rc_back";
  return (
    <div
      className={`border-2 rounded-sm p-3 ${
        has && required ? "border-emerald-300 bg-emerald-50/30" :
        has ? "border-blue-300 bg-blue-50/30" :
        required ? "border-dashed border-amber-300 bg-amber-50/30" :
        "border-dashed border-zinc-300 bg-zinc-50"
      }`}
      data-testid={testid}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-xs uppercase tracking-wider flex items-center gap-1">
          {label}
          {required && <span className="text-rose-600">*</span>}
          {optional && <span className="text-[9px] font-semibold text-zinc-500">(optional)</span>}
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
