import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

function normalizePercentCell(v) {
  if (v == null) return 0;
  if (typeof v === 'number') return v > 1 ? v / 100 : v;
  const s = String(v).trim().replace('%', '').replace(',', '.');
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return n > 1 ? n / 100 : n;
}

function readLocalExcel() {
  const filePath = path.join(process.cwd(), 'data.xlsx');
  if (!fs.existsSync(filePath)) throw new Error('Local Excel file not found: ' + filePath);
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false });
  return rows.filter(row => Object.values(row).some(v => v !== null && v !== undefined && v !== ''));
}

function generateSummary(data) {
  const map = {};
  data.forEach(r => {
    const site = r['الموقع'] || 'غير محدد';
    if (!map[site]) map[site] = { planned: [], actual: [], lat: r.Latitude || r.latitude || null, lng: r.Longitude || r.longitude || null };
    map[site].planned.push(normalizePercentCell(r['النسبة المخططة (%)']));
    map[site].actual.push(normalizePercentCell(r['النسبة الفعلية (%)']));
  });
  return Object.entries(map).map(([site, v]) => ({
    'الموقع': site,
    'متوسط النسبة المخططة': v.planned.length ? v.planned.reduce((a,b)=>a+b,0)/v.planned.length : 0,
    'متوسط النسبة الفعلية': v.actual.length ? v.actual.reduce((a,b)=>a+b,0)/v.actual.length : 0,
    'Latitude': v.lat,
    'Longitude': v.lng
  }));
}

function calculateProjectDates(data) {
  const starts = data.map(r => r['تاريخ البداية']).filter(Boolean).map(d => new Date(d)).map(dt => dt.getTime());
  const ends = data.map(r => r['تاريخ النهاية']).filter(Boolean).map(d => new Date(d)).map(dt => dt.getTime());
  if (!starts.length || !ends.length) return { totalDays: 0, elapsed: 0, remaining: 0 };
  const start = Math.min(...starts); const end = Math.max(...ends);
  const totalDays = Math.ceil((end - start)/(1000*60*60*24));
  const elapsed = Math.max(0, Math.ceil((Date.now() - start)/(1000*60*60*24)));
  const remaining = Math.max(0, totalDays - elapsed);
  return { totalDays, elapsed, remaining };
}

export default async function handler(req, res) {
  try {
    const data = readLocalExcel();
    const summary = generateSummary(data);
    const geo = summary.filter(s => s.Latitude != null && s.Longitude != null);
    const projectDates = calculateProjectDates(data);
    return res.status(200).json({ data: { detailed: data, summary, geo, projectDates } });
  } catch (err) {
    console.error('sheets API error', err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}