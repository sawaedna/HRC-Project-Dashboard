
const XLSX = require('xlsx');
const path = require('path');

try {
    const filePath = path.join(process.cwd(), 'data.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null, raw: false }); // raw: false gets formatted strings

    console.log('Total rows:', data.length);
    if (data.length > 0) {
        console.log('First row keys:', Object.keys(data[0]));
        console.log('First 5 rows dates:');
        data.slice(0, 5).forEach((r, i) => {
            console.log(`Row ${i}: Start='${r['تاريخ البداية']}', End='${r['تاريخ النهاية']}'`);
        });
    }
} catch (err) {
    console.error(err);
}
