import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

export default function LanguageToggle() {
  const { i18n } = useTranslation();
  const lang = i18n.language?.startsWith("gu") ? "gu" : "en";

  const set = (lng) => {
    i18n.changeLanguage(lng);
    try { localStorage.setItem("servall_lang", lng); } catch { /* noop */ }
  };

  return (
    <div
      className="inline-flex items-center gap-1 bg-white border border-zinc-200 rounded-sm p-0.5 shadow-sm"
      data-testid="language-toggle"
    >
      <span className="pl-2 pr-1 flex items-center text-zinc-500">
        <Globe className="w-3.5 h-3.5" />
      </span>
      <button
        type="button"
        onClick={() => set("en")}
        className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-colors ${
          lang === "en" ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"
        }`}
        data-testid="lang-en"
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => set("gu")}
        className={`px-2.5 py-1 text-xs font-bold rounded-sm transition-colors ${
          lang === "gu" ? "bg-brand text-white" : "text-zinc-600 hover:bg-zinc-100"
        }`}
        data-testid="lang-gu"
      >
        ગુ
      </button>
    </div>
  );
}
