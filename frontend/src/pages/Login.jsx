import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { Bike, ArrowRight } from "lucide-react";

const HERO =
  "https://images.unsplash.com/photo-1771402382481-de35db6c4159?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1ODh8MHwxfHNlYXJjaHwyfHxtb3RvcmN5Y2xlJTIwc2hvd3Jvb218ZW58MHx8fHwxNzc2Njg1ODgxfDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [email, setEmail] = useState("superadmin@dealer.com");
  const [password, setPassword] = useState("super123");
  const [busy, setBusy] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const res = await login(email, password);
    setBusy(false);
    if (res.ok) {
      toast.success("Welcome back");
      navigate("/dashboard");
    } else {
      toast.error(res.error || "Login failed");
    }
  };

  const quickLogin = (mail, pw) => {
    setEmail(mail);
    setPassword(pw);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-zinc-900 rounded-sm flex items-center justify-center">
              <Bike className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <div>
              <div className="font-display font-black text-xl leading-none">TORQUE</div>
              <div className="overline mt-1" style={{ fontSize: "0.5625rem" }}>Dealership CRM</div>
            </div>
          </div>

          <div className="overline mb-2">Sign in</div>
          <h1 className="font-display text-3xl sm:text-4xl font-black tracking-tight mb-2">
            Welcome back.
          </h1>
          <p className="text-sm text-zinc-500 mb-8">
            Log in to manage leads, follow-ups, and deliveries.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="overline">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 rounded-sm"
                data-testid="login-email-input"
                required
              />
            </div>
            <div>
              <Label htmlFor="password" className="overline">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-2 rounded-sm"
                data-testid="login-password-input"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="w-full rounded-sm bg-zinc-900 hover:bg-zinc-800 text-white font-bold tracking-wide h-11"
              data-testid="login-submit-button"
            >
              {busy ? "Signing in..." : "Sign in"} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>

          <div className="mt-10 p-4 border border-dashed border-zinc-300 rounded-sm">
            <div className="overline mb-3">Quick demo logins</div>
            <div className="space-y-2 text-sm">
              <button
                onClick={() => quickLogin("superadmin@dealer.com", "super123")}
                className="w-full text-left hover:bg-zinc-50 px-3 py-2 rounded-sm flex justify-between"
                data-testid="quick-login-super"
                type="button"
              >
                <span className="font-medium">Super Admin</span>
                <span className="text-zinc-500 font-mono text-xs">super123</span>
              </button>
              <button
                onClick={() => quickLogin("admin@dealer.com", "admin123")}
                className="w-full text-left hover:bg-zinc-50 px-3 py-2 rounded-sm flex justify-between"
                data-testid="quick-login-admin"
                type="button"
              >
                <span className="font-medium">Branch Admin</span>
                <span className="text-zinc-500 font-mono text-xs">admin123</span>
              </button>
              <button
                onClick={() => quickLogin("sales1@dealer.com", "sales123")}
                className="w-full text-left hover:bg-zinc-50 px-3 py-2 rounded-sm flex justify-between"
                data-testid="quick-login-sales"
                type="button"
              >
                <span className="font-medium">Sales Executive</span>
                <span className="text-zinc-500 font-mono text-xs">sales123</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="hidden lg:block relative">
        <img src={HERO} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/85 via-zinc-900/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <div className="overline text-white/70 mb-3">Built for dealerships</div>
          <h2 className="font-display text-4xl font-black leading-tight max-w-md">
            From walk-in to delivery — every lead, tracked.
          </h2>
          <p className="mt-4 text-sm text-white/70 max-w-sm">
            Multi-branch, role-based, and tuned for sales executives who move fast.
          </p>
        </div>
      </div>
    </div>
  );
}
