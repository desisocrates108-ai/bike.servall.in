import React, { useMemo, useState } from "react";
import { fileUrl } from "./DocSlot";
import { FileText, X as XIcon, Image as ImageIcon, FileBadge2, CircleUserRound, Bike, FilePlus2 } from "lucide-react";

/**
 * Consolidated "Uploaded Documents & Photos" view for Lead Detail.
 * Groups identity + exchange + other into sections with thumbnails.
 * Click any thumbnail → full-screen lightbox.
 * Renders only files that actually exist.
 */
export default function DocumentsGallery({ lead }) {
  const [lightbox, setLightbox] = useState(null); // { url, label, isImage }

  const identity = lead.identity_docs || {};
  const exchDocs = (lead.exchange || {}).documents || {};
  const legacyPhotos = (lead.exchange || {}).photos || [];

  const groups = useMemo(() => {
    const imgExt = (fid) => true; // We treat identity buckets as images; PDFs are shown as filename cards below
    const sections = [];

    // Identity
    const identityItems = [];
    (identity.aadhaar || []).forEach((fid) => identityItems.push({ fid, label: "Aadhaar Front", isImage: true }));
    (identity.aadhaar_back || []).forEach((fid) => identityItems.push({ fid, label: "Aadhaar Back", isImage: true }));
    if (identityItems.length) {
      sections.push({ key: "identity", icon: CircleUserRound, title: "Identity (Aadhaar)", items: identityItems, tone: "emerald" });
    }

    // Exchange RC
    const rcItems = [];
    (exchDocs.rc_front || []).forEach((fid) => rcItems.push({ fid, label: "RC Front", isImage: true }));
    (exchDocs.rc_back || []).forEach((fid) => rcItems.push({ fid, label: "RC Back", isImage: true }));
    (exchDocs.rc_pdf || []).forEach((fid) => rcItems.push({ fid, label: "RC PDF", isImage: false }));
    (exchDocs.rc_book || []).forEach((fid) => rcItems.push({ fid, label: "RC Book", isImage: false }));
    if (rcItems.length) {
      sections.push({ key: "rc", icon: FileBadge2, title: "Vehicle Documents (RC Book)", items: rcItems, tone: "blue" });
    }

    // Vehicle Photos
    const photoItems = [];
    (exchDocs.front_photo || []).forEach((fid) => photoItems.push({ fid, label: "Vehicle Front Photo", isImage: true }));
    (exchDocs.back_photo || []).forEach((fid) => photoItems.push({ fid, label: "Vehicle Back Photo", isImage: true }));
    legacyPhotos.forEach((fid) => photoItems.push({ fid, label: "Legacy Photo", isImage: true }));
    if (photoItems.length) {
      sections.push({ key: "photos", icon: Bike, title: "Vehicle Photos", items: photoItems, tone: "amber" });
    }

    // Other
    const otherItems = [];
    (identity.other || []).forEach((fid) => otherItems.push({ fid, label: "Other Document", isImage: false }));
    if (otherItems.length) {
      sections.push({ key: "other", icon: FilePlus2, title: "Other Documents", items: otherItems, tone: "zinc" });
    }

    return sections;
  }, [lead]);

  const total = groups.reduce((s, g) => s + g.items.length, 0);

  if (total === 0) {
    return null;
  }

  const toneHeader = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    zinc: "border-zinc-200 bg-zinc-50 text-zinc-700",
  };

  return (
    <>
      <div className="bg-white border border-zinc-200 rounded-sm p-5 mb-4" data-testid="docs-gallery">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="overline">Uploaded Documents & Photos</div>
            <div className="font-display font-bold text-lg mt-0.5">{total} file{total === 1 ? "" : "s"}</div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-emerald-600 text-white">ALL FILES</span>
        </div>

        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.key} className="mb-4 last:mb-0 border border-zinc-200 rounded-sm" data-testid={`gallery-section-${g.key}`}>
              <div className={`flex items-center gap-2 px-3 py-2 border-b ${toneHeader[g.tone]}`}>
                <Icon className="w-4 h-4" />
                <div className="font-bold text-xs uppercase tracking-wider flex-1">{g.title}</div>
                <span className="font-mono text-xs font-bold">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 p-3" data-testid={`gallery-grid-${g.key}`}>
                {g.items.map((it, idx) => (
                  <button
                    key={`${it.fid}-${idx}`}
                    type="button"
                    onClick={() => setLightbox({ url: fileUrl(it.fid), label: it.label, isImage: it.isImage, fid: it.fid })}
                    className="group relative border border-zinc-200 rounded-sm overflow-hidden hover:border-brand transition-colors text-left"
                    data-testid={`gallery-thumb-${g.key}-${idx}`}
                  >
                    {it.isImage ? (
                      <>
                        <img
                          src={fileUrl(it.fid)}
                          alt={it.label}
                          className="w-full aspect-square object-cover bg-zinc-100"
                          loading="lazy"
                          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                        />
                        <div className="hidden w-full aspect-square bg-zinc-100 items-center justify-center text-zinc-400">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full aspect-square bg-zinc-50 flex flex-col items-center justify-center p-1 gap-1">
                        <FileText className="w-6 h-6 text-brand" />
                        <div className="text-[9px] font-mono truncate max-w-full text-zinc-500">{it.fid.slice(0, 8)}…</div>
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white text-[10px] font-bold px-1.5 py-1 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {it.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {lightbox && (
        <Lightbox item={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
}

function Lightbox({ item, onClose }) {
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="gallery-lightbox"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 w-10 h-10 rounded-sm bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        data-testid="gallery-lightbox-close"
        aria-label="Close"
      >
        <XIcon className="w-5 h-5" />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-4xl w-full max-h-[90vh] flex flex-col items-center"
      >
        <div className="text-white font-bold text-sm mb-2 uppercase tracking-wider">{item.label}</div>
        {item.isImage ? (
          <img src={item.url} alt={item.label} className="max-w-full max-h-[80vh] object-contain rounded-sm" />
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="bg-white rounded-sm px-6 py-4 flex items-center gap-3 text-sm font-bold hover:bg-zinc-100"
          >
            <FileText className="w-5 h-5 text-brand" />
            Open {item.label} in new tab →
          </a>
        )}
      </div>
    </div>
  );
}
