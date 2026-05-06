import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Bike, ArrowRight } from "lucide-react";
import LanguageToggle from "../components/LanguageToggle";

const HERO =
  "https://images.unsplash.com/photo-1771402382481-de35db6c4159?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxtb3RvcmN5Y2xlJTIwc2hvd3Jvb218ZW58MHx8fHwxNzc2Njg1ODgxfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) {
      toast.success(t("login.welcome"));
      navigate("/dashboard");
    } else {
      toast.error(res.error || t("login.invalid"));
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      <div className="absolute top-4 right-4 z-30">
        <LanguageToggle />
      </div>
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-brand rounded-sm flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-black text-xl leading-none" data-testid="login-brand">
                {t("brand.name", "Servall CRM")}
              </div>
              <div className="overline mt-1" style={{ fontSize: "0.5625rem" }}>Dealership CRM</div>
            </div>
          </div>

          <div className="overline mb-2">{t("login.sign_in")}</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-2">
            {t("login.welcome")}.
          </h1>
          <p className="text-sm text-zinc-500 mb-8">
            {t("login.subtitle")}
          </p>

          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <div>
              <Label htmlFor="email" className="overline">{t("login.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter Email"
                autoComplete="off"
                className="mt-2 rounded-sm"
                data-testid="login-email-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="overline">{t("login.password")}</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter Password"
                autoComplete="new-password"
                className="mt-2 rounded-sm"
                data-testid="login-password-input"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-brand hover:bg-brand-dark text-white font-bold tracking-wide h-11"
              data-testid="login-submit-button"
            >
              {busy ? t("login.signing_in") : t("login.sign_in")} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </div>
      </div>

      <div className="hidden lg:block relative">
        <img src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/85 via-zinc-900/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <div className="overline text-white/70 mb-3">Built for dealerships</div>
          <h2 className="font-display text-4xl font-black leading-tight max-w-md">
            {t("brand.name", "Servall CRM")} — From walk-in to delivery, every lead tracked.
          </h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm">
            Multi-branch, role-based, and tuned for sales executives who move fast.
          </p>
        </div>
      </div>
    </div>
  );
}
