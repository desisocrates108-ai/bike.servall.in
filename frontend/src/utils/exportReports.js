// Reports export utility — supports Excel (.xlsx) and PDF
// Date format: DD-MM-YYYY everywhere
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Format date as DD-MM-YYYY (accepts ISO date or YYYY-MM-DD strings)
export function formatDate(d) {
  if (!d) return "";
  try {
    // YYYY-MM-DD only → split directly to avoid TZ surprises
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [y, m, day] = d.split("-");
      return `${day}-${m}-${y}`;
    }
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d).slice(0, 10);
    const day = String(dt.getDate()).padStart(2, "0");
    const month = String(dt.getMonth() + 1).padStart(2, "0");
    const year = dt.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return String(d).slice(0, 10);
  }
}

function safeFileName(name) {
  const ts = new Date().toISOString().slice(0, 10);
  return `${name.replace(/[^a-zA-Z0-9-_]/g, "_")}_${ts}`;
}

// ------------- Excel ------------------
export function exportToExcel({ title, sheets }) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const headerRow = sheet.columns.map((c) => c.header);
    const data = (sheet.rows || []).map((r) =>
      sheet.columns.map((c) => {
        const v = r[c.key];
        return v === null || v === undefined ? "" : v;
      })
    );
    const aoa = [headerRow, ...data];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = sheet.columns.map((c, idx) => {
      const maxLen = Math.max(
        c.header.length,
        ...data.map((row) => String(row[idx] || "").length)
      );
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${safeFileName(title)}.xlsx`);
}

// ------------- PDF ------------------
export function exportToPDF({ title, sheets, orientation = "landscape" }) {
  const doc = new jsPDF({ orientation, unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text(title.replace(/_/g, " "), pageWidth / 2, 36, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth / 2, 52, { align: "center" });
  doc.setTextColor(0);

  let startY = 70;
  sheets.forEach((sheet, i) => {
    if (i > 0) {
      doc.addPage();
      startY = 40;
    }
    doc.setFontSize(12);
    doc.text(sheet.name, 40, startY);

    autoTable(doc, {
      startY: startY + 8,
      head: [sheet.columns.map((c) => c.header)],
      body: (sheet.rows || []).map((r) =>
        sheet.columns.map((c) => {
          const v = r[c.key];
          return v === null || v === undefined ? "" : String(v);
        })
      ),
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      headStyles: { fillColor: [220, 38, 38], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { left: 30, right: 30 },
    });
  });
  doc.save(`${safeFileName(title)}.pdf`);
}

// =====================================================================
// Report builders — convert raw API data into sheet definitions
// =====================================================================

const CONVERTED_STAGES = ["Delivery", "Allotment", "Feedback"];
const LOST_STAGES = ["Lost"];

function isConverted(l) {
  return CONVERTED_STAGES.includes(l.stage);
}

function vehicleLabel(l, brandMap, modelMap) {
  const parts = [];
  if (l.brand_id && brandMap?.[l.brand_id]) parts.push(brandMap[l.brand_id]);
  if (l.model_id && modelMap?.[l.model_id]) parts.push(modelMap[l.model_id]);
  return parts.join(" ");
}

// 1. Performance Report
export function buildPerformanceReport({ leads, users, branches }) {
  const total = leads.length;
  const converted = leads.filter(isConverted).length;
  const lost = leads.filter((l) => LOST_STAGES.includes(l.stage)).length;
  const conv = total ? ((converted / total) * 100).toFixed(1) + "%" : "0%";

  const summarySheet = {
    name: "Summary",
    columns: [
      { header: "Metric", key: "metric" },
      { header: "Value", key: "value" },
    ],
    rows: [
      { metric: "Total Leads", value: total },
      { metric: "Converted Leads", value: converted },
      { metric: "Lost Leads", value: lost },
      { metric: "Conversion %", value: conv },
    ],
  };

  // Source-wise
  const sourceSet = new Set(leads.map((l) => l.source).filter(Boolean));
  const srcRows = Array.from(sourceSet).map((src) => {
    const arr = leads.filter((l) => l.source === src);
    const c = arr.filter(isConverted).length;
    const ls = arr.filter((l) => LOST_STAGES.includes(l.stage)).length;
    return {
      source: src,
      total: arr.length,
      converted: c,
      lost: ls,
      conv_pct: arr.length ? ((c / arr.length) * 100).toFixed(1) + "%" : "0%",
    };
  });
  const sourceSheet = {
    name: "Source Performance",
    columns: [
      { header: "Source", key: "source" },
      { header: "Total", key: "total" },
      { header: "Converted", key: "converted" },
      { header: "Lost", key: "lost" },
      { header: "Conversion %", key: "conv_pct" },
    ],
    rows: srcRows,
  };

  // Executive-wise
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const execGroup = new Map();
  for (const l of leads) {
    const uid = l.assigned_to;
    if (!uid) continue;
    if (!execGroup.has(uid)) execGroup.set(uid, []);
    execGroup.get(uid).push(l);
  }
  const execRows = Array.from(execGroup.entries()).map(([uid, arr]) => {
    const u = userMap.get(uid);
    const c = arr.filter(isConverted).length;
    const ls = arr.filter((l) => LOST_STAGES.includes(l.stage)).length;
    return {
      executive: u ? u.name : uid,
      total: arr.length,
      converted: c,
      lost: ls,
      conv_pct: arr.length ? ((c / arr.length) * 100).toFixed(1) + "%" : "0%",
    };
  });
  const execSheet = {
    name: "Executive Performance",
    columns: [
      { header: "Executive", key: "executive" },
      { header: "Total Leads", key: "total" },
      { header: "Converted", key: "converted" },
      { header: "Lost", key: "lost" },
      { header: "Conversion %", key: "conv_pct" },
    ],
    rows: execRows,
  };

  // Branch-wise
  const branchMap = new Map((branches || []).map((b) => [b.id, b]));
  const branchGroup = new Map();
  for (const l of leads) {
    const bid = l.branch_id;
    if (!bid) continue;
    if (!branchGroup.has(bid)) branchGroup.set(bid, []);
    branchGroup.get(bid).push(l);
  }
  const branchRows = Array.from(branchGroup.entries()).map(([bid, arr]) => {
    const b = branchMap.get(bid);
    const c = arr.filter(isConverted).length;
    const ls = arr.filter((l) => LOST_STAGES.includes(l.stage)).length;
    return {
      branch: b ? b.name : bid,
      total: arr.length,
      converted: c,
      lost: ls,
      conv_pct: arr.length ? ((c / arr.length) * 100).toFixed(1) + "%" : "0%",
    };
  });
  const branchSheet = {
    name: "Branch Performance",
    columns: [
      { header: "Branch", key: "branch" },
      { header: "Total Leads", key: "total" },
      { header: "Converted", key: "converted" },
      { header: "Lost", key: "lost" },
      { header: "Conversion %", key: "conv_pct" },
    ],
    rows: branchRows,
  };

  return {
    title: "Performance_Report",
    sheets: [summarySheet, sourceSheet, execSheet, branchSheet],
  };
}

// 2. Customer Details Report
export function buildCustomerDetailsReport({ leads, users, branches, brands, models }) {
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const branchMap = new Map((branches || []).map((b) => [b.id, b]));
  const brandMap = Object.fromEntries((brands || []).map((b) => [b.id, b.name]));
  const modelMap = Object.fromEntries((models || []).map((m) => [m.id, m.name]));
  const rows = leads.map((l) => ({
    lead_id: l.id,
    customer_name: l.customer_name || "",
    mobile: l.phone || "",
    source: l.source || "",
    stage: l.stage || "",
    assigned_to: userMap.get(l.assigned_to)?.name || "",
    branch: branchMap.get(l.branch_id)?.name || "",
    priority: l.priority || "",
    follow_up_date: formatDate(l.next_followup_date),
    created_date: formatDate(l.created_at),
    vehicle: vehicleLabel(l, brandMap, modelMap),
    notes: l.notes || "",
    conversion_status: isConverted(l) ? "Converted" : l.stage === "Lost" ? "Lost" : "In Progress",
  }));
  return {
    title: "Customer_Details_Report",
    sheets: [
      {
        name: "Customer Details",
        columns: [
          { header: "Customer Name", key: "customer_name" },
          { header: "Mobile Number", key: "mobile" },
          { header: "Source", key: "source" },
          { header: "Stage", key: "stage" },
          { header: "Assigned To", key: "assigned_to" },
          { header: "Branch", key: "branch" },
          { header: "Priority", key: "priority" },
          { header: "Follow-up Date", key: "follow_up_date" },
          { header: "Lead Created Date", key: "created_date" },
          { header: "Vehicle Interested", key: "vehicle" },
          { header: "Notes", key: "notes" },
          { header: "Conversion Status", key: "conversion_status" },
        ],
        rows,
      },
    ],
  };
}

// 3. Leads Report
export function buildLeadsReport({ leads, users, branches }) {
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const branchMap = new Map((branches || []).map((b) => [b.id, b]));
  const rows = leads.map((l) => ({
    customer_name: l.customer_name || "",
    phone: l.phone || "",
    source: l.source || "",
    stage: l.stage || "",
    assigned_to: userMap.get(l.assigned_to)?.name || "",
    branch: branchMap.get(l.branch_id)?.name || "",
    created_date: formatDate(l.created_at),
    last_follow_up: formatDate(l.last_followup_at || l.next_followup_date),
    priority: l.priority || "",
  }));
  return {
    title: "Leads_Report",
    sheets: [
      {
        name: "All Leads",
        columns: [
          { header: "Customer Name", key: "customer_name" },
          { header: "Phone", key: "phone" },
          { header: "Source", key: "source" },
          { header: "Stage", key: "stage" },
          { header: "Assigned To", key: "assigned_to" },
          { header: "Branch", key: "branch" },
          { header: "Lead Created Date", key: "created_date" },
          { header: "Last Follow-up Date", key: "last_follow_up" },
          { header: "Priority", key: "priority" },
        ],
        rows,
      },
    ],
  };
}

// 4. Lost Leads Report
export function buildLostLeadsReport({ leads, users }) {
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const lostLeads = leads.filter((l) => l.stage === "Lost");
  const rows = lostLeads.map((l) => ({
    customer_name: l.customer_name || "",
    mobile: l.phone || "",
    source: l.source || "",
    lost_reason: l.lost_reason || l.lost_reason_text || "",
    assigned_to: userMap.get(l.assigned_to)?.name || "",
    created_date: formatDate(l.created_at),
    lost_date: formatDate(l.updated_at),
  }));
  return {
    title: "Lost_Leads_Report",
    sheets: [
      {
        name: "Lost Leads",
        columns: [
          { header: "Customer Name", key: "customer_name" },
          { header: "Mobile", key: "mobile" },
          { header: "Source", key: "source" },
          { header: "Lost Reason", key: "lost_reason" },
          { header: "Assigned Executive", key: "assigned_to" },
          { header: "Created Date", key: "created_date" },
          { header: "Lost Date", key: "lost_date" },
        ],
        rows,
      },
    ],
  };
}

// 5. Converted / Booking Report
export function buildBookingReport({ bookings, leads, users, brands, models }) {
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const leadMap = new Map((leads || []).map((l) => [l.id, l]));
  const brandMap = Object.fromEntries((brands || []).map((b) => [b.id, b.name]));
  const modelMap = Object.fromEntries((models || []).map((m) => [m.id, m.name]));
  const rows = (bookings || []).map((b) => {
    const lead = leadMap.get(b.lead_id) || {};
    return {
      customer_name: lead.customer_name || "",
      mobile: lead.phone || "",
      vehicle: vehicleLabel(lead, brandMap, modelMap),
      booking_amount: b.booking_amount ?? "",
      final_amount: b.final_deal_price ?? "",
      booking_date: formatDate(b.booking_date),
      delivery_date: formatDate(b.expected_delivery_date),
      chassis_number: b.chassis_number || b.allotment?.chassis_number || "",
      assigned_to: userMap.get(lead.assigned_to)?.name || "",
      status: b.status || "",
    };
  });
  return {
    title: "Booking_Report",
    sheets: [
      {
        name: "Converted Bookings",
        columns: [
          { header: "Customer Name", key: "customer_name" },
          { header: "Mobile", key: "mobile" },
          { header: "Vehicle", key: "vehicle" },
          { header: "Booking Amount", key: "booking_amount" },
          { header: "Final Amount", key: "final_amount" },
          { header: "Booking Date", key: "booking_date" },
          { header: "Expected Delivery Date", key: "delivery_date" },
          { header: "Chassis Number", key: "chassis_number" },
          { header: "Assigned Executive", key: "assigned_to" },
          { header: "Status", key: "status" },
        ],
        rows,
      },
    ],
  };
}

// 6. Follow-up Report
export function buildFollowUpReport({ leads, users }) {
  const userMap = new Map((users || []).map((u) => [u.id, u]));
  const rows = leads
    .filter((l) => !isConverted(l) && l.stage !== "Lost")
    .map((l) => ({
      customer_name: l.customer_name || "",
      mobile: l.phone || "",
      next_follow_up: formatDate(l.next_followup_date),
      assigned_to: userMap.get(l.assigned_to)?.name || "",
      stage: l.stage || "",
      priority: l.priority || "",
    }));
  return {
    title: "Follow_Up_Report",
    sheets: [
      {
        name: "Follow-ups",
        columns: [
          { header: "Customer Name", key: "customer_name" },
          { header: "Mobile", key: "mobile" },
          { header: "Next Follow-up Date", key: "next_follow_up" },
          { header: "Assigned Executive", key: "assigned_to" },
          { header: "Current Stage", key: "stage" },
          { header: "Priority", key: "priority" },
        ],
        rows,
      },
    ],
  };
}

export const REPORT_TYPES = [
  { id: "performance", label: "Performance Report", builder: buildPerformanceReport },
  { id: "customer", label: "Customer Details Report", builder: buildCustomerDetailsReport },
  { id: "leads", label: "Leads Report", builder: buildLeadsReport },
  { id: "lost", label: "Lost Leads Report", builder: buildLostLeadsReport },
  { id: "booking", label: "Converted / Booking Report", builder: buildBookingReport, needsBookings: true },
  { id: "followup", label: "Follow-up Report", builder: buildFollowUpReport },
];
