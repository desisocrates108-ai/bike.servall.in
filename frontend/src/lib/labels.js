export const priorityClass = (p) => {
  if (p === "Hot") return "bg-rose-100 text-rose-700 border-rose-200";
  if (p === "Warm") return "bg-amber-100 text-amber-700 border-amber-200";
  if (p === "Cold") return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-zinc-100 text-zinc-700 border-zinc-200";
};

export const priorityStrip = (p) => {
  if (p === "Hot") return "priority-hot";
  if (p === "Warm") return "priority-warm";
  if (p === "Cold") return "priority-cold";
  return "";
};

export const stageClass = (s) => {
  const map = {
    Inquiry: "bg-zinc-100 text-zinc-700",
    "Follow-up": "bg-indigo-100 text-indigo-700",
    Interest: "bg-violet-100 text-violet-700",
    "Test Ride": "bg-cyan-100 text-cyan-700",
    Deal: "bg-amber-100 text-amber-700",
    Booking: "bg-emerald-100 text-emerald-700",
    Delivery: "bg-emerald-200 text-emerald-800",
    Registration: "bg-emerald-300 text-emerald-900",
    Feedback: "bg-teal-100 text-teal-700",
    Lost: "bg-rose-100 text-rose-700",
  };
  return map[s] || "bg-zinc-100 text-zinc-700";
};

export const roleLabel = (r) => {
  const map = { super_admin: "Super Admin", admin: "Admin", sales_executive: "Sales Exec" };
  return map[r] || r;
};
