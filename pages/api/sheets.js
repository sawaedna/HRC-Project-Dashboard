import fetch from 'node-fetch';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  try {
    // رابط الشيت العام بصيغة XLSX (تأكد أنه نفس الرابط الخاص بك)
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDa_RClRJJzLiqGbIx4JKDRcbuhoBdZQSgXCXv-5xBix6gifHCwNvGgwZHe3v5kQfxrhs_i5AW9X2D/pub?output=xlsx";
    const response = await fetch(sheetUrl);

    if (!response.ok) {
      return res.status(500).json({ error: `فشل تحميل الملف من Google Sheets (${response.status})` });
    }

    // قراءة الملف كـ ArrayBuffer وتحويله لـ Workbook
    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    // استخراج الشيت المطلوب (Sheet1)
    const sheet = workbook.Sheets["Sheet1"] || workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) {
      return res.status(500).json({ error: "لم يتم العثور على الشيت المطلوب (Sheet1)" });
    }

    // تحويل الشيت لصفوف JSON
    const detailed = XLSX.utils.sheet_to_json(sheet, { defval: null });

    return res.status(200).json({ data: { detailed, summary: [], geo: [] } });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
