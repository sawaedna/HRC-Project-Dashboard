import XLSX from "xlsx";

export default async function handler(req, res) {
  try {
    // رابط تصدير الشيت كـ XLSX (من Google Sheets -> File -> Share -> Publish to web)
    const XLSX_URL =
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDa_RClRJJzLiqGbIx4JKDRcbuhoBdZQSgXCXv-5xBix6gifHCwNvGgwZHe3v5kQfxrhs_i5AW9X2D/pub?output=xlsx";

    const resp = await fetch(XLSX_URL);
    if (!resp.ok) throw new Error(`Failed to fetch XLSX: ${resp.status}`);
    const buffer = await resp.arrayBuffer();

    // قراءة الملف وتحويله إلى JSON
    const wb = XLSX.read(buffer, { type: "array" });

    // نحاول قراءة Sheets بالاسم لو موجودة وإلا نقرأ أول شيت
    const detailedSheet =
      wb.Sheets["الإنجاز التفصيلي"] || wb.Sheets["الانجاز التفصيلي"] || wb.Sheets[wb.SheetNames[0]];
    const summarySheet = wb.Sheets["ملخص"] || wb.Sheets["summary"] || null;
    const geoSheet = wb.Sheets["المواقع - جغرافيا"] || wb.Sheets["geo"] || null;

    const detailed = detailedSheet ? XLSX.utils.sheet_to_json(detailedSheet, { defval: null }) : [];
    const summary = summarySheet ? XLSX.utils.sheet_to_json(summarySheet, { defval: null }) : [];
    const geo = geoSheet ? XLSX.utils.sheet_to_json(geoSheet, { defval: null }) : [];

    return res.status(200).json({ data: { detailed, summary, geo } });
  } catch (err) {
    console.error("Google Sheet XLSX fetch error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
