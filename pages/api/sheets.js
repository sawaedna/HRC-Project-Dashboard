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
    'متوسط النسبة المخططة': v.planned.length ? v.planned.reduce((a, b) => a + b, 0) / v.planned.length : 0,
    'متوسط النسبة الفعلية': v.actual.length ? v.actual.reduce((a, b) => a + b, 0) / v.actual.length : 0,
    'Latitude': v.lat,
    'Longitude': v.lng
  }));
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date && !isNaN(v)) return v.getTime();
  if (typeof v === 'number') {
    // Excel serial date handling if raw=true was used, but here raw=false strings are expected.
    return new Date(Math.round((v - 25569) * 86400 * 1000)).getTime();
  }
  const str = String(v).trim();
  // Try YYYY-MM-DD or MM/DD/YYYY (standard JS)
  let d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();

  // Try DD/MM/YYYY
  const parts = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    const day = parseInt(parts[1], 10);
    const month = parseInt(parts[2], 10) - 1;
    const year = parseInt(parts[3], 10);
    d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

function calculateProjectDates(data) {
  const starts = data.map(r => parseDate(r['تاريخ البداية'])).filter(t => t !== null);
  // Fixed value as per user request
  const totalDays = 120;

  let elapsed = 0;
  if (starts.length > 0) {
    const start = Math.min(...starts);
    elapsed = Math.max(0, Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24)));
  }

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