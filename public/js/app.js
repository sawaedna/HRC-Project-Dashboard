(function () {
  if (typeof window === 'undefined') return;

  // ======== عناصر الجذر ========
  const root = document.getElementById('app');
  root.innerHTML = `
  <div class="container">
    <div class="topbar">
      <div class="brand">
        <div>
          <h1 style="margin:0">تنفيذ الهوية على مباني الهيئة</h1>
          <div id="subtitle" style="color:var(--muted);font-size:14px;font-weight:600;margin-top:4px">تَغَيَّرَتْ هُوِّيَتُنَا وَقِيَمُنَا ثَابِتَةٌ</div>
        </div>
      </div>
      <div class="controls">
        <div id="lastUpdate" class="lastUpdate">آخر تحديث: —</div>
        <button id="themeBtn" class="btn">🌓</button>
      </div>
    </div>
    
    <div class="tabs" style="margin-top:10px">
      <div class="tab active" data-tab="summary">الملخص</div>
      <div class="tab" data-tab="details">التفاصيل</div>
    </div>

    <div id="viewSummary">

      <div class="filters" style="margin-top:12px">
        <select id="siteFilter" class="select"><option value="">كل المواقع</option></select>
        <button id="clearFilter" class="btn clear-btn" style="display:none;margin-right:8px;padding:6px 10px;background:var(--danger);border:none;border-radius:6px;color:white;cursor:pointer">🔄 إزالة الفلتر</button>
      </div>

      <div class="grid" style="margin-bottom:12px">
        <div id="kpiArea" class="card kpi"></div>
        
        <div class="panel card">
          <h3>مخطط/فعلي</h3>
          <canvas id="chartPlanActual"></canvas>
        </div>
        
        <div class="panel card">
          <h3>المواقع</h3>
          <div id="map" style="height:320px;border-radius:8px"></div>
        </div>

        <div class="card full">
          <h3 id="performanceTitle">أداء المواقع</h3>
          <div id="donutArea" class="donuts"></div>
          <div id="gaugeArea" style="display:none;text-align:center;padding:20px"></div>
        </div>
        
        <div id="sunburstChartContainer" class="card empty-container">
          <canvas id="sunburstChartCanvas"></canvas>
        </div>

        <div class="empty-container">مساحة فارغة #1</div>
        <div class="empty-container">مساحة فارغة #2</div>
        <div class="empty-container">مساحة فارغة #4</div>
      </div>
    </div>

    <div id="viewDetails" style="display:none">
      <div class="table-wrap card full" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px">
          <strong>التفاصيل</strong>
          <input id="searchInput" placeholder="ابحث..." style="padding:8px;border-radius:8px;background:transparent;color:var(--text);border:1px solid rgba(255,255,255,0.03)" />
        </div>
        <div style="overflow:auto">
          <table id="dataTable">
            <thead id="tableHead"></thead>
            <tbody id="tableBody"></tbody>
          </table>
        </div>
        <div id="tableFooter" class="table-footer"></div>
      </div>
    </div>

  </div>

  <div id="loader" class="loader" style="display:none"><div class="spinner"></div></div>
  `;

  // ======== الحالة العامة ========
  const state = {
    raw: { detailed: [], summary: [], geo: [] },
    filtered: { detailed: [], summary: [], geo: [] },
    charts: { main: null, donuts: [], gauge: null, sunburst: null },
    map: { instance: null, markers: [], originalView: null },
    selectedSite: null,
    selectedStage: null, // تم إضافة حالة جديدة للمرحلة
    lastUpdated: null,
    refreshIntervalId: null
  };

  // ======== دوال مساعدة ========
  function normalizePercent(value) {
    if (value == null) return 0;
    if (typeof value === 'number') return value > 1 ? value / 100 : value;
    let s = String(value).trim();
    if (s === '') return 0;
    s = s.replace('%', '').replace(',', '.');
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return n > 1 ? n / 100 : n;
  }
  function avg(arr) {
    const a = arr.filter(n => typeof n === 'number' && !isNaN(n));
    if (!a.length) return 0;
    return a.reduce((s, v) => s + v, 0) / a.length;
  }
  const pct = v => `${(v * 100).toFixed(1)}%`;
  function formatDateTime(d) {
    try { return new Date(d).toLocaleString('ar-SA'); } catch (e) { return String(d); }
  }

  // دالة تحويل للأرقام العربية
  function toArabicNumbers(str) {
    return str.replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  }

  // دالة التاريخ الهجري الديناميكي
  function getHijriDate() {
    const today = new Date();
    try {
      const hijriFormatter = new Intl.DateTimeFormat('ar-TN-u-ca-islamic', {
        year: 'numeric', month: '2-digit', day: '2-digit'
      });
      const hijriParts = hijriFormatter.formatToParts(today);
      const hijriYear = hijriParts.find(p => p.type === 'year').value;
      const hijriMonth = hijriParts.find(p => p.type === 'month').value;
      const hijriDay = hijriParts.find(p => p.type === 'day').value;
      const hijriDateRaw = hijriDay + '/' + hijriMonth + '/' + hijriYear + 'هـ';
      return toArabicNumbers(hijriDateRaw);
    } catch (e) {
      // fallback if Hijri calendar not supported
      const gDay = today.getDate().toString().padStart(2, '0');
      const gMonth = (today.getMonth()+1).toString().padStart(2, '0');
      const gYear = today.getFullYear();
      return toArabicNumbers(`${gDay}/${gMonth}/${gYear}م`);
    }
  }

  // ======== Theme ========
  const themeBtn = document.getElementById('themeBtn');
  function applyTheme() {
    const t = localStorage.getItem('theme') || 'dark';
    if (t === 'light') document.body.classList.add('light');
    else document.body.classList.remove('light');
  }
  themeBtn.addEventListener('click', () => {
    const now = document.body.classList.toggle('light') ? 'light' : 'dark';
    localStorage.setItem('theme', now);
  });
  applyTheme();

  // ======== Loader ========
  const loader = document.getElementById('loader');
  function showLoader() { loader.style.display = 'flex'; }
  function hideLoader() { loader.style.display = 'none'; }

  // ======== جلب البيانات من الـ API ========
  async function fetchSheetsOnce() {
    try {
      const res = await fetch('/api/sheets');
      const j = await res.json();
      if (j.error) {
        console.error('API Sheets error:', j.error);
        return null;
      }
      return j.data || j;
    } catch (e) {
      console.error('Fetch sheets failed:', e);
      return null;
    }
  }

  // ======== تهيئة البيانات داخل الواجهة ========
  function hydrate(data) {
    const detailed = (data.detailed || data.data?.detailed || []).map(r => ({ ...r }));
    const summary = (data.summary || data.data?.summary || []).map(r => ({ ...r }));
    const geo = (data.geo || data.data?.geo || []).map(r => ({ ...r }));
    state.raw = { detailed, summary, geo };
    buildFilters();
    applyFilters();
    renderAll();
  }

  function buildFilters() {
    const sel = document.getElementById('siteFilter');
    const sites = [...new Set(state.raw.detailed.map(r => r['الموقع'] || r['SiteKey'] || '').filter(Boolean))].sort();
    sel.innerHTML = '<option value="">كل المواقع</option>' + sites.map(s => `<option value="${s}">${s}</option>`).join('');
  }

  // ======== فلترة مترابطة (تحترم state.selectedSite و state.selectedStage) ========
  function applyFilters() {
    const site = state.selectedSite || (document.getElementById('siteFilter')?.value || '');
    state.filtered.detailed = state.raw.detailed.filter(r => 
      (!site || (String(r['الموقع'] || '') === String(site))) &&
      (!state.selectedStage || (String(r['المرحلة'] || '') === String(state.selectedStage)))
    );
    state.filtered.summary = state.raw.summary.filter(r => !site || (String(r['الموقع'] || '') === String(site)));
    state.filtered.geo = state.raw.geo.filter(r => !site || (String(r['الموقع'] || '') === String(site)));
    
    // إظهار/إخفاء زر إزالة الفلتر
    const clearBtn = document.getElementById('clearFilter');
    if (site || state.selectedStage) {
      clearBtn.style.display = 'inline-block';
    } else {
      clearBtn.style.display = 'none';
    }
  }

  // ======== حساب تواريخ المشروع ========
  function computeProjectDates() {
    const rows = state.filtered.detailed;
    const parsed = rows.map(r => {
      const s = r['تاريخ البداية'] || r['start'] || r['تarih_start'] || null;
      const e = r['تاريخ النهاية'] || r['end'] || r['تarih_end'] || null;
      const start = s ? new Date(s) : null;
      const end = e ? new Date(e) : null;
      return (start && end) ? { start, end } : (start ? { start, end: start } : null);
    }).filter(Boolean);
    if (!parsed.length) return null;
    const starts = parsed.map(x => x.start.getTime());
    const ends = parsed.map(x => x.end.getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    const today = new Date();
    const totalDays = Math.max(0, Math.ceil((max - min) / (1000 * 60 * 60 * 24)));
    const elapsed = Math.max(0, Math.ceil((today - min) / (1000 * 60 * 60 * 24)));
    const remaining = Math.max(0, Math.ceil((max - today) / (1000 * 60 * 60 * 24)));
    return { min, max, totalDays, elapsed, remaining };
  }

  // ======== رندر KPIs ========
  function renderKPIs() {
    const container = document.getElementById('kpiArea');
    if (!container) return;
    const summary = state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true);
    const sitesCount = new Set(state.filtered.detailed.map(r => r['الموقع'] || r['SiteKey'])).size;
    const avgPlan = avg(summary.map(s => normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0)));
    const avgActual = avg(summary.map(s => normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0)));
    const avgDelta = avgActual - avgPlan;
    const pd = computeProjectDates();

    container.innerHTML = `
      <div class="card kpi"><h3>عدد المواقع</h3><div class="value">${sitesCount}</div></div>
      <div class="card kpi"><h3>متوسط المخطط</h3><div class="value">${pct(avgPlan)}</div></div>
      <div class="card kpi"><h3>متوسط الفعلي</h3><div class="value" style="color:${avgDelta<0?'var(--danger)':'var(--success)'}">${pct(avgActual)}</div></div>
      <div class="card kpi"><h3>متوسط الانحراف</h3><div class="value" style="color:${avgDelta<0?'var(--danger)':'var(--success)'}">${pct(avgDelta)}</div></div>
      <div class="card kpi"><h3>مدة المشروع (يوم)</h3><div class="value">${pd ? pd.totalDays : '—'}</div></div>
      <div class="card kpi"><h3>الأيام المنقضية</h3><div class="value">${pd ? pd.elapsed : '—'}</div></div>
      <div class="card kpi"><h3>الأيام المتبقية</h3><div class="value">${pd ? pd.remaining : '—'}</div></div>
    `;
  }

  // ======== تجميع ملخص من التفاصيل (اختياري) ========
  function aggregateSummaryFromDetails(filtered = false) {
    const source = filtered ? state.filtered.detailed : state.raw.detailed;
    const map = {};
    source.forEach(r => {
      const site = r['الموقع'] || r['SiteKey'] || 'غير محدد';
      map[site] = map[site] || { site, plan: [], actual: [], lat: r['Latitude'] || r['Lat'] || 0, lng: r['Longitude'] || r['Lng'] || 0 };
      map[site].plan.push(normalizePercent(r['النسبة المخططة (%)'] || r['النسبة المخططة'] || 0));
      map[site].actual.push(normalizePercent(r['النسبة الفعلية (%)'] || r['النسبة الفعلية'] || 0));
    });
    return Object.values(map).map(v => ({
      'الموقع': v.site,
      'متوسط النسبة المخططة': avg(v.plan),
      'متوسط النسبة الفعلية': avg(v.actual),
      'Latitude': v.lat,
      'Longitude': v.lng
    }));
  }

  // ======== رندر المخطط الرئيسي (Chart.js) ========
  function renderCharts() {
    if (typeof Chart === 'undefined') return;
    const summary = state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true);
    const labels = summary.map(s => s['الموقع'] || '');
    const plan = summary.map(s => normalizePercent(s['متوسط النسبة المخططة'] || 0) * 100);
    const actual = summary.map(s => normalizePercent(s['متوسط النسبة الفعلية'] || 0) * 100);

    try { state.charts.main?.destroy(); } catch (e) { /* ignore */ }

    const ctx = document.getElementById('chartPlanActual').getContext('2d');
    state.charts.main = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'مخطط %', data: plan, backgroundColor: 'rgba(79,140,255,0.95)' },
          { label: 'فعلي %', data: actual, backgroundColor: 'rgba(34,197,94,0.95)' }
        ]
      },
      options: {
        responsive: true,
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          const site = labels[idx];
          state.selectedSite = site;
          state.selectedStage = null;
          const sel = document.getElementById('siteFilter');
          if (sel) sel.value = site;
          applyFilters();
          renderAll();
          // zoom map to site if lat/lng available
          const summaryRow = (state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true)).find(x => x['الموقع'] === site);
          if (summaryRow && summaryRow.Latitude && summaryRow.Longitude) {
            try { 
              state.map.instance.setView([Number(summaryRow.Latitude), Number(summaryRow.Longitude)], 12, { animate: true });
            } catch (e) {}
          }
        },
        scales: { y: { beginAtZero: true, max: 100 } }
      }
    });
  }

  // ======== رندر Gauge Chart للموقع الواحد أو Donuts للكل ========
  function renderPerformanceCharts() {
    if (typeof Chart === 'undefined') return;
    
    const donutArea = document.getElementById('donutArea');
    const gaugeArea = document.getElementById('gaugeArea');
    const title = document.getElementById('performanceTitle');
    
    // مسح المراجع القديمة
    state.charts.donuts.forEach(c => { try { c.destroy(); } catch (e) {} });
    state.charts.donuts = [];
    if (state.charts.gauge) {
      try { state.charts.gauge.destroy(); } catch (e) {}
      state.charts.gauge = null;
    }

    const summary = state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true);
    
    // إذا كان موقع واحد مختار، اعرض Gauge
    if (state.selectedSite && summary.length === 1) {
      donutArea.style.display = 'none';
      gaugeArea.style.display = 'block';
      title.textContent = `أداء موقع: ${state.selectedSite}`;
      
      const s = summary[0];
      const planVal = normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0) * 100;
      const actVal = normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0) * 100;
      
      gaugeArea.innerHTML = `
        <div style="max-width:400px;margin:0 auto">
          <canvas id="gaugeChart" style="max-height:300px"></canvas>
          <div style="margin-top:10px;display:flex;justify-content:space-around;font-size:14px">
            <div>مخطط: <strong>${planVal.toFixed(1)}%</strong></div>
            <div>فعلي: <strong style="color:${actVal >= planVal ? 'var(--success)' : 'var(--danger)'}">${actVal.toFixed(1)}%</strong></div>
          </div>
        </div>
      `;
      
      const ctx = document.getElementById('gaugeChart').getContext('2d');
      state.charts.gauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['فعلي', 'متبقي'],
          datasets: [{
            data: [actVal, Math.max(0, 100 - actVal)],
            backgroundColor: [
              actVal >= planVal ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
              'rgba(255,255,255,0.1)'
            ],
            borderWidth: 0,
            circumference: 180,
            rotation: 270,
            cutout: '75%'
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          }
        }
      });
      
    } else {
      // اعرض Donuts للجميع
      donutArea.style.display = 'grid';
      gaugeArea.style.display = 'none';
      title.textContent = 'أداء المواقع';
      donutArea.innerHTML = '';

      summary.forEach(s => {
        const el = document.createElement('div');
        el.className = 'card donut-card';
        el.innerHTML = `<h4 style="margin:4px 0">${s['الموقع']}</h4><canvas></canvas>`;
        donutArea.appendChild(el);
        const ctx = el.querySelector('canvas').getContext('2d');

        const planVal = normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0) * 100;
        const actVal = normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0) * 100;

        const chart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['مخطط', 'فعلي'],
            datasets: [{ data: [planVal, actVal], backgroundColor: ['rgba(79,140,255,0.95)', 'rgba(34,197,94,0.95)'] }]
          },
          options: {
            responsive: true,
            plugins: { legend: { display: false } },
            onClick: () => {
              state.selectedSite = s['الموقع'];
              state.selectedStage = null;
              const sel = document.getElementById('siteFilter');
              if (sel) sel.value = s['الموقع'];
              applyFilters();
              renderAll();
              // zoom if possible
              const lat = Number(s['Latitude'] || s['Lat'] || 0);
              const lng = Number(s['Longitude'] || s['Lng'] || 0);
              if (lat && lng && state.map.instance) {
                try { state.map.instance.setView([lat, lng], 12, { animate: true }); } catch (e) {}
              }
            }
          }
        });

        state.charts.donuts.push(chart);
      });
    }
  }

  // ======== رندر الخريطة (Leaflet) مع حل مشكلة الثبات ========
  function renderMap() {
    const el = document.getElementById('map');
    if (!el) return;
    
    // إنشاء الخريطة مرة واحدة
    if (!state.map.instance) {
      try {
        state.map.instance = L.map(el).setView([23.8859, 45.0792], 5);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map.instance);
        // حفظ العرض الأصلي
        state.map.originalView = { lat: 23.8859, lng: 45.0792, zoom: 5 };
      } catch (e) {
        console.warn('Leaflet failed to initialize', e);
        return;
      }
    }

    // إزالة الماركيرات القديمة
    state.map.markers.forEach(m => { try { m.remove(); } catch (e) {} });
    state.map.markers = [];

    const summary = state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true);
    
    // إذا لم يكن هناك فلتر، ارجع للعرض الأصلي
    if (!state.selectedSite && summary.length > 1) {
      try {
        state.map.instance.setView([state.map.originalView.lat, state.map.originalView.lng], state.map.originalView.zoom, { animate: true });
      } catch (e) {}
    }

    summary.forEach(s => {
      const lat = Number(s['Latitude'] || s['Lat'] || 0);
      const lng = Number(s['Longitude'] || s['Lng'] || 0);
      if (!lat || !lng) return;
      try {
        const marker = L.marker([lat, lng]).addTo(state.map.instance);
        const plan = normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0);
        const actual = normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0);
        const delta = actual - plan;
        marker.bindPopup(`<strong>${s['الموقع']}</strong><br>مخطط: ${pct(plan)}<br>فعلي: ${pct(actual)}<br>انحراف: ${pct(delta)}`);
        marker.on('click', () => {
          state.selectedSite = s['الموقع'];
          state.selectedStage = null;
          const sel = document.getElementById('siteFilter');
          if (sel) sel.value = s['الموقع'];
          applyFilters();
          renderAll();
          try { state.map.instance.setView([lat, lng], 12, { animate: true }); } catch (e) {}
        });
        state.map.markers.push(marker);
      } catch (e) {
        console.warn('Marker add failed', e);
      }
    });
  }
  
  // ======== رندر مخطط Sunburst ========
  function renderSunburstChart() {
    if (typeof Chart === 'undefined' || typeof Chart.controllers.sunburst === 'undefined') {
      const el = document.getElementById('sunburstChartContainer');
      if (el) el.innerHTML = `
        <div style="text-align:center;color:var(--muted);font-weight:600">
          مخطط Sunburst غير متوفر.
        </div>
      `;
      return;
    }

    try { state.charts.sunburst?.destroy(); } catch (e) {}
    
    const detailedData = state.raw.detailed;
    
    // تجميع البيانات للمخطط
    const dataBySite = detailedData.reduce((acc, row) => {
      const site = row['الموقع'];
      const stage = row['المرحلة'];
      if (!site || !stage) return acc;

      if (!acc[site]) {
        acc[site] = {};
      }
      if (!acc[site][stage]) {
        acc[site][stage] = 0;
      }
      acc[site][stage] += 1;
      return acc;
    }, {});
    
    // تحويل البيانات إلى تنسيق Sunburst
    const sunburstData = Object.keys(dataBySite).map(site => {
      const children = Object.keys(dataBySite[site]).map(stage => ({
        label: stage,
        value: dataBySite[site][stage]
      }));
      return {
        label: site,
        children: children
      };
    });
    
    const ctx = document.getElementById('sunburstChartCanvas').getContext('2d');
    state.charts.sunburst = new Chart(ctx, {
      type: 'sunburst',
      data: {
        labels: sunburstData.map(d => d.label),
        datasets: [{
          data: sunburstData,
          backgroundColor: Chart.get
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        onClick: (event, elements) => {
          if (!elements.length) return;
          const element = elements[0];
          const segment = element.element;
          
          let siteLabel;
          let stageLabel;
          
          if (segment.innerRadius === 0) { // النقر على الحلقة الداخلية (المراحل)
            const parentIndex = element._index;
            siteLabel = sunburstData[parentIndex].label;
            stageLabel = sunburstData[parentIndex].children[element._index].label;
          } else { // النقر على الحلقة الخارجية (المواقع)
            siteLabel = sunburstData[element._index].label;
            stageLabel = null;
          }
          
          state.selectedSite = siteLabel;
          state.selectedStage = stageLabel;
          
          const sel = document.getElementById('siteFilter');
          if (sel) sel.value = siteLabel;
          
          applyFilters();
          renderAll();
        }
      }
    });
  }

  // ======== جدول التفاصيل ========
  let sort = { key: null, asc: true };
  function renderTable() {
    const cols = ['الموقع', 'المرحلة', 'البند الرئيسي', 'تاريخ البداية', 'المدة الكلية (يوم)', 'تاريخ النهاية', 'النسبة المخططة (%)', 'النسبة الفعلية (%)', 'الانحراف (%)'];
    const head = document.getElementById('tableHead');
    if (!head) return; // حماية في حالة عدم وجود العنصر
    head.innerHTML = '<tr>' + cols.map(c => `<th data-key="${c}">${c}</th>`).join('') + '</tr>';
    head.querySelectorAll('th').forEach(th => th.addEventListener('click', () => {
      const k = th.dataset.key;
      if (sort.key === k) sort.asc = !sort.asc; else { sort.key = k; sort.asc = true; }
      renderTable();
    }));

    let rows = state.filtered.detailed.map(r => ({ ...r }));
    const term = (document.getElementById('searchInput')?.value || '').toLowerCase();
    if (term) {
      rows = rows.filter(r => Object.values(r).some(v => String(v || '').toLowerCase().includes(term)));
    }

    if (sort.key) {
      rows.sort((a, b) => {
        const va = a[sort.key] || '';
        const vb = b[sort.key] || '';
        if (!isNaN(Number(va)) && !isNaN(Number(vb))) return sort.asc ? va - vb : vb - va;
        return sort.asc ? String(va).localeCompare(String(vb), 'ar') : String(vb).localeCompare(String(va), 'ar');
      });
    }

    const body = document.getElementById('tableBody');
    if (!body) return; // حماية
    body.innerHTML = rows.map(r => {
      const plan = r['النسبة المخططة (%)'] || r['النسبة المخططة'] || '';
      const act = r['النسبة الفعلية (%)'] || r['النسبة الفعلية'] || '';
      const delta = (() => {
        const p = normalizePercent(plan), a = normalizePercent(act);
        return pct(a - p);
      })();
      return `<tr>
        <td>${r['الموقع'] || ''}</td>
        <td>${r['المرحلة'] || ''}</td>
        <td>${r['البند الرئيسي'] || ''}</td>
        <td>${r['تاريخ البداية'] || ''}</td>
        <td>${r['المدة الكلية (يوم)'] || ''}</td>
        <td>${r['تاريخ النهاية'] || ''}</td>
        <td>${plan}</td>
        <td>${act}</td>
        <td>${delta}</td>
      </tr>`;
    }).join('');
    const footer = document.getElementById('tableFooter');
    if (footer) footer.textContent = `عدد الصفوف: ${rows.length}`;
  }

  // ======== تجميع كل الرندرات ========
  function renderAll() {
    renderKPIs();
    renderCharts();
    renderMap();
    renderPerformanceCharts();
    renderSunburstChart();
    renderTable();
  }

  // ======== Events ========
  document.getElementById('siteFilter').addEventListener('change', () => {
    state.selectedSite = document.getElementById('siteFilter').value || null;
    state.selectedStage = null;
    applyFilters();
    renderAll();
  });

  // زر إزالة الفلتر
  document.getElementById('clearFilter').addEventListener('click', () => {
    state.selectedSite = null;
    state.selectedStage = null;
    const sel = document.getElementById('siteFilter');
    if (sel) sel.value = '';
    applyFilters();
    renderAll();
    // إرجاع الخريطة للعرض الأصلي
    if (state.map.instance && state.map.originalView) {
      try {
        state.map.instance.setView([state.map.originalView.lat, state.map.originalView.lng], state.map.originalView.zoom, { animate: true });
      } catch (e) {}
    }
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.addEventListener('input', () => renderTable());
  
  // إعادة تفعيل أحداث التبويبات للتحكم في العرض
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    document.getElementById('viewSummary').style.display = tab === 'summary' ? 'block' : 'none';
    document.getElementById('viewDetails').style.display = tab === 'details' ? 'block' : 'none';
    
    // عند التبديل إلى جدول التفاصيل، أعد رندر الجدول لضمان عرض المحتوى
    if(tab === 'details') {
      renderTable();
    }
  }));

  // ======== تحميل وجدولة التحديث كل 60 ثانية ========
  async function loadAndSchedule() {
    showLoader();
    const data = await fetchSheetsOnce();
    if (data) {
      hydrate(data);
      state.lastUpdated = new Date();
      const lastEl = document.getElementById('lastUpdate');
      if (lastEl) {
        const today = new Date();
        // التاريخ الهجري الديناميكي
        const hijriDate = getHijriDate();
        // التاريخ الميلادي
        const gDay = today.getDate().toString().padStart(2, '0');
        const gMonth = (today.getMonth()+1).toString().padStart(2, '0');
        const gYear = today.getFullYear();
        const gregorianDate = toArabicNumbers(`${gDay}/${gMonth}/${gYear}م`);
        // الوقت
        let hours = today.getHours();
        const minutes = today.getMinutes().toString().padStart(2, '0');
        const seconds = today.getSeconds().toString().padStart(2, '0');
        const ampm = today.getHours() >= 12 ? 'م' : 'ص';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 => 12
        const formattedTime = toArabicNumbers(hours.toString().padStart(2, '0') + ':' + minutes + ':' + seconds) + ' ' + ampm;
        lastEl.textContent = `آخر تحديث: ${gregorianDate} | ${hijriDate} - ${formattedTime}`;
      }
    }
    hideLoader();
  }

  // بداية التحميل
  loadAndSchedule();

  // جدولة التحديث كل 60 ثانية
  if (state.refreshIntervalId) clearInterval(state.refreshIntervalId);
  state.refreshIntervalId = setInterval(async () => {
    const data = await fetchSheetsOnce();
    if (data) {
      hydrate(data);
      state.lastUpdated = new Date();
      const lastEl = document.getElementById('lastUpdate');
      if (lastEl) {
        const today = new Date();
        const hijriDate = getHijriDate();
        const gDay = today.getDate().toString().padStart(2, '0');
        const gMonth = (today.getMonth()+1).toString().padStart(2, '0');
        const gYear = today.getFullYear();
        const gregorianDate = toArabicNumbers(`${gDay}/${gMonth}/${gYear}م`);
        let hours = today.getHours();
        const minutes = today.getMinutes().toString().padStart(2, '0');
        const seconds = today.getSeconds().toString().padStart(2, '0');
        const ampm = today.getHours() >= 12 ? 'م' : 'ص';
        hours = hours % 12;
        hours = hours ? hours : 12;
        const formattedTime = toArabicNumbers(hours.toString().padStart(2, '0') + ':' + minutes + ':' + seconds) + ' ' + ampm;
        lastEl.textContent = `آخر تحديث: ${gregorianDate} | ${hijriDate} - ${formattedTime}`;
      }
    }
  }, 60_000);

  // ======== نهاية الوحدة ========
})();
