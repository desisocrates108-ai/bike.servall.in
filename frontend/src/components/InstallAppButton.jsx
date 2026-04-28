import React, { useEffect, useState } from "react";
import { Download, Smartphone, X, Share } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

/**
 * One-tap "Install App" button.
 * - Android/Chrome/Edge: triggers native beforeinstallprompt
 * - iOS Safari: opens a help dialog with Add-to-Home-Screen steps
 * - Hides itself if app already runs in standalone (installed) mode
 */
export default function InstallAppButton({ variant = "compact" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [installed, setInstalled] = useState(false);
  const [iosHelpOpen, setIosHelpOpen] = useState(false);

  const isStandalone =
    (typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)")?.matches ||
        window.navigator?.standalone === true));

  const isIOS = typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent || "") &&
    !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent || "");

  useEffect(() => {
    if (isStandalone) { setInstalled(true); return; }
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [isStandalone]);

  if (installed || isStandalone) return null;

  const onClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    // No native prompt → likely iOS Safari (or unsupported browser)
    setIosHelpOpen(true);
  };

  // Only render the trigger if we have a native prompt OR we're on iOS (where we show manual help)
  const canShow = !!deferredPrompt || isIOS;
  if (!canShow) return null;

  const iconClass = variant === "compact" ? "w-4 h-4" : "w-4 h-4 mr-2";

  return (
    <>
      {variant === "compact" ? (
        <button
          onClick={onClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-brand text-brand hover:bg-brand hover:text-white transition-colors text-xs font-bold uppercase tracking-wider"
          data-testid="install-app-btn"
          title="Install Servall CRM as an app"
        >
          <Download className={iconClass} />
          Install App
        </button>
      ) : (
        <button
          onClick={onClick}
          className="w-full flex items-center justify-center px-4 py-2.5 rounded-sm bg-brand text-white hover:bg-brand-dark text-sm font-bold uppercase tracking-wider"
          data-testid="install-app-btn-full"
        >
          <Download className={iconClass} />
          Install App
        </button>
      )}

      <Dialog open={iosHelpOpen} onOpenChange={setIosHelpOpen}>
        <DialogContent className="max-w-md" data-testid="ios-install-help">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-brand" />
              Install Servall CRM
            </DialogTitle>
            <DialogDescription>
              iPhone / iPad par app install karne ke liye Safari ke <b>Share</b> menu ka use karein.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-sm bg-brand text-white font-bold flex items-center justify-center">1</span>
              <div>
                Safari ke bottom bar mein <b>Share</b> icon <Share className="w-4 h-4 inline align-text-bottom" /> tap karein.
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-sm bg-brand text-white font-bold flex items-center justify-center">2</span>
              <div>Scroll karke <b>"Add to Home Screen"</b> select karein.</div>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-sm bg-brand text-white font-bold flex items-center justify-center">3</span>
              <div>Top-right par <b>"Add"</b> tap karein. App icon home screen pe aa jaayega — bas usse open karein.</div>
            </li>
          </ol>
          <div className="bg-zinc-50 border border-zinc-200 rounded-sm p-3 text-xs text-zinc-600">
            Android par Chrome/Edge use karte ho to is screen ki jagah seedha install prompt aayega.
          </div>
          <button
            onClick={() => setIosHelpOpen(false)}
            className="w-full py-2 rounded-sm bg-zinc-900 text-white font-bold uppercase tracking-wider text-sm"
            data-testid="ios-install-help-close"
          >
            <X className="w-4 h-4 inline mr-1" /> Close
          </button>
        </DialogContent>
      </Dialog>
    </>
  );
}
