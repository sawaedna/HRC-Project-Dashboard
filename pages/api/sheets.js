import { google } from 'googleapis';

function tryParseJson(raw) {
  if (!raw) throw new Error('Missing GOOGLE_SERVICE_ACCOUNT_JSON');
  let s = String(raw).trim();
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) s = s.slice(1,-1);
  s = s.replace(/\r\n/g,'\\n').replace(/\n/g,'\\n');
  try { return JSON.parse(s); } catch(e){
    try { return JSON.parse(s.replace(/\\\\n/g,'\\n')); } catch(e2){
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ' + e2.message);
    }
  }
}

export default async function handler(req, res){
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    if (!sheetId) return res.status(500).json({ error: 'Missing GOOGLE_SHEET_ID' });

    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    let key;
    try { key = tryParseJson(raw); } catch(e){
      console.error('Service account parse error', e.message);
      return res.status(500).json({ error: 'Invalid GOOGLE_SERVICE_ACCOUNT_JSON' });
    }

    const jwt = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key.replace(/\\n/g,'\n'),
      ['https://www.googleapis.com/auth/spreadsheets.readonly']
    );
    await jwt.authorize();
    const sheets = google.sheets({ version: 'v4', auth: jwt });

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
    const sheetTitles = (meta.data.sheets || []).map(s=>s.properties.title).filter(Boolean);

    const find = (keys) => {
      for (const t of sheetTitles){
        for (const k of keys){
          if (!k) continue;
          if (t.toLowerCase().includes(k.toLowerCase())) return t;
        }
      }
      return null;
    };

    const detailedTitle = find(['الانجاز التفصيلي','الإنجاز التفصيلي','detailed','details']) || sheetTitles[0] || null;
    const summaryTitle = find(['ملخص','summary','overview']) || null;
    const geoTitle = find(['المواقع','جغرافيا','geo','locations']) || null;

    const out = { detailed: [], summary: [], geo: [], detectedSheets: { detailedTitle, summaryTitle, geoTitle, all: sheetTitles } };

    async function read(title){
      if(!title) return [];
      const resp = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: title });
      const rows = resp.data.values || [];
      if(!rows.length) return [];
      const headers = rows[0];
      return rows.slice(1).map(r => {
        const o = {};
        for(let i=0;i<headers.length;i++) o[headers[i]] = r[i] ?? null;
        return o;
      });
    }

    out.detailed = await read(detailedTitle);
    out.summary = await read(summaryTitle);
    out.geo = await read(geoTitle);

    return res.status(200).json({ data: out });
  } catch(err){
    console.error(err);
    return res.status(500).json({ error: err.message || String(err) });
  }
}
