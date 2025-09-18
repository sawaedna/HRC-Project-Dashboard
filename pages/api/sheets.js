import fetch from 'node-fetch';
import XLSX from 'xlsx';

export default async function handler(req, res) {
  try {
    const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRDa_RClRJJzLiqGbIx4JKDRcbuhoBdZQSgXCXv-5xBix6gifHCwNvGgwZHe3v5kQfxrhs_i5AW9X2D/pub?output=xlsx";
    const response = await fetch(sheetUrl);

    if (!response.ok) {
      return res.status(500).json({ error: `Failed to load file from Google Sheets (${response.status})` });
    }

    const arrayBuffer = await response.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: "array" });

    // تجهيز البيانات مع فلترة الصفوف الفارغة
    const rawData = XLSX.utils.sheet_to_json(workbook.Sheets["Sheet1"], {
      defval: null,
      raw: false,
    }).filter(row => {
      // تحقق من أن الصف يحتوي على بيانات فعلية وليست فارغة بالكامل
      return Object.values(row).some(value => 
        value !== null && value !== undefined && value !== ''
      );
    });

    // Process rawData to create detailed, summary, and geo structures
    const detailed = rawData.map(row => {
      const newRow = { ...row };

      // Convert date strings to Date objects for 'تاريخ البداية' and 'تاريخ النهاية'
      // XLSX.utils.sheet_to_json with raw:false often returns dates as formatted strings
      if (typeof newRow['تاريخ البداية'] === 'string') {
        try {
          newRow['تاريخ البداية'] = new Date(newRow['تاريخ البداية']);
        } catch (e) {
          newRow['تاريخ البداية'] = null;
        }
      }
      if (typeof newRow['تاريخ النهاية'] === 'string') {
        try {
          newRow['تاريخ النهاية'] = new Date(newRow['تاريخ النهاية']);
        } catch (e) {
          newRow['تاريخ النهاية'] = null;
        }
      }

      // Ensure percentages are parsed correctly. They should already be strings like '15%' with raw:false
      // The frontend normalizePercent function will handle the conversion to number.

      return newRow;
    });

    // Aggregate summary data (example logic, adjust as needed)
    const summaryMap = {};
    detailed.forEach(row => {
      const site = row['الموقع'] || 'غير محدد';
      if (!summaryMap[site]) {
        summaryMap[site] = {
          'الموقع': site,
          'النسبة المخططة (%)': [],
          'النسبة الفعلية (%)': [],
          'Latitude': row['Latitude'] || 0,
          'Longitude': row['Longitude'] || 0,
        };
      }
      if (row['النسبة المخططة (%)'] !== null) summaryMap[site]['النسبة المخططة (%)'].push(parseFloat(String(row['النسبة المخططة (%)']).replace('%', '')) / 100);
      if (row['النسبة الفعلية (%)'] !== null) summaryMap[site]['النسبة الفعلية (%)'].push(parseFloat(String(row['النسبة الفعلية (%)']).replace('%', '')) / 100);
    });

    const summary = Object.values(summaryMap).map(s => ({
      'الموقع': s['الموقع'],
      'متوسط النسبة المخططة': s['النسبة المخططة (%)'].length ? (s['النسبة المخططة (%)'].reduce((acc, val) => acc + val, 0) / s['النسبة المخططة (%)'].length) : 0,
      'متوسط النسبة الفعلية': s['النسبة الفعلية (%)'].length ? (s['النسبة الفعلية (%)'].reduce((acc, val) => acc + val, 0) / s['النسبة الفعلية (%)'].length) : 0,
      'Latitude': s['Latitude'],
      'Longitude': s['Longitude'],
    }));

    // Geo data can be the same as summary if it contains lat/lng
    const geo = summary.filter(s => s.Latitude && s.Longitude);

    // Calculate project dates
    const projectDates = (() => {
      const parsedDates = detailed
        .map(r => {
          const start = r["تاريخ البداية"];
          const end = r["تاريخ النهاية"];
          return start && end ? { start, end } : start ? { start, end: start } : null;
        })
        .filter(Boolean);

      if (!parsedDates.length) return null;

      const starts = parsedDates.map(x => x.start.getTime());
      const ends = parsedDates.map(x => x.end.getTime());

      const min = new Date(Math.min(...starts));
      const max = new Date(Math.max(...ends));
      const today = new Date();

      const totalDays = Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24))) + 1;
      const elapsed = Math.max(0, Math.ceil((today - min) / (1000 * 60 * 60 * 24)));
      const remaining = Math.max(0, Math.ceil((max - today) / (1000 * 60 * 60 * 24)));

      return { totalDays, elapsed, remaining };
    })();

    return res.status(200).json({ data: { detailed, summary, geo, projectDates } });
  } catch (err) {
    console.error("API Error:", err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}

