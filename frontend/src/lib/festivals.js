// Static Gujarati / Hindu festival calendar — curated key dates.
// Format: YYYY-MM-DD and a short label. Covers 2026 Q1 onwards.
export const FESTIVALS = [
  // 2026
  { date: "2026-01-14", name: "Uttarayan (Makar Sankranti)", important: true },
  { date: "2026-01-15", name: "Vasi Uttarayan" },
  { date: "2026-01-20", name: "Agyaras (Shattila Ekadashi)" },
  { date: "2026-02-03", name: "Agyaras (Jaya Ekadashi)" },
  { date: "2026-02-15", name: "Maha Shivratri" },
  { date: "2026-02-19", name: "Agyaras (Vijaya Ekadashi)" },
  { date: "2026-03-04", name: "Holika Dahan" },
  { date: "2026-03-05", name: "Holi / Dhuleti", important: true },
  { date: "2026-03-07", name: "Agyaras (Amalaki Ekadashi)" },
  { date: "2026-03-19", name: "Gudi Padwa / Navratri Start", important: true },
  { date: "2026-03-21", name: "Agyaras (Papmochani Ekadashi)" },
  { date: "2026-03-26", name: "Ram Navami" },
  { date: "2026-04-05", name: "Agyaras (Kamada Ekadashi)" },
  { date: "2026-04-20", name: "Agyaras (Varuthini Ekadashi)" },
  { date: "2026-04-29", name: "Akshaya Tritiya", important: true },
  { date: "2026-05-04", name: "Agyaras (Mohini Ekadashi)" },
  { date: "2026-05-19", name: "Agyaras (Apara Ekadashi)" },
  { date: "2026-06-03", name: "Agyaras (Nirjala Ekadashi)" },
  { date: "2026-06-17", name: "Agyaras (Yogini Ekadashi)" },
  { date: "2026-07-04", name: "Jagannath Rath Yatra" },
  { date: "2026-07-16", name: "Agyaras (Devshayani Ekadashi)" },
  { date: "2026-08-01", name: "Agyaras (Kamika Ekadashi)" },
  { date: "2026-08-09", name: "Raksha Bandhan", important: true },
  { date: "2026-08-15", name: "Agyaras (Putrada Ekadashi)" },
  { date: "2026-08-16", name: "Janmashtami", important: true },
  { date: "2026-08-31", name: "Agyaras (Aja Ekadashi)" },
  { date: "2026-09-13", name: "Agyaras (Parsva Ekadashi)" },
  { date: "2026-09-14", name: "Ganesh Chaturthi", important: true },
  { date: "2026-09-22", name: "Navratri Start", important: true },
  { date: "2026-09-30", name: "Agyaras (Indira Ekadashi)" },
  { date: "2026-10-01", name: "Dussehra (Vijayadashami)", important: true },
  { date: "2026-10-14", name: "Agyaras (Papankusha Ekadashi)" },
  { date: "2026-10-28", name: "Agyaras (Rama Ekadashi)" },
  { date: "2026-11-05", name: "Dhanteras", important: true },
  { date: "2026-11-07", name: "Diwali", important: true },
  { date: "2026-11-08", name: "Gujarati New Year (Bestu Varas)", important: true },
  { date: "2026-11-09", name: "Bhai Beej" },
  { date: "2026-11-13", name: "Labh Pancham (Muhurat Day)", important: true },
  { date: "2026-11-13", name: "Agyaras (Devuthani Ekadashi)" },
  { date: "2026-11-27", name: "Agyaras (Utpanna Ekadashi)" },
  { date: "2026-12-13", name: "Agyaras (Mokshada Ekadashi)" },
  { date: "2026-12-27", name: "Agyaras (Saphala Ekadashi)" },

  // 2027 – key ones
  { date: "2027-01-14", name: "Uttarayan (Makar Sankranti)", important: true },
  { date: "2027-02-24", name: "Holi / Dhuleti", important: true },
  { date: "2027-04-17", name: "Akshaya Tritiya", important: true },
  { date: "2027-08-05", name: "Janmashtami", important: true },
  { date: "2027-09-15", name: "Navratri Start", important: true },
  { date: "2027-10-20", name: "Dussehra", important: true },
  { date: "2027-10-27", name: "Diwali", important: true },
  { date: "2027-10-28", name: "Gujarati New Year", important: true },
];

export function upcomingFestivals(fromDate = new Date(), days = 60) {
  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + days);
  return FESTIVALS
    .filter((f) => {
      const d = new Date(f.date);
      return d >= from && d <= to;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function pastFestivals(toDate = new Date(), days = 30) {
  const to = new Date(toDate);
  to.setHours(0, 0, 0, 0);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  return FESTIVALS
    .filter((f) => {
      const d = new Date(f.date);
      return d >= from && d < to;
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function daysUntil(dateStr) {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
}
