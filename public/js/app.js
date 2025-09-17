(function () {
  console.log("app.js script loaded and executing.");
  if (typeof window === "undefined") return;

  // Import and register ChartDataLabels plugin
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels === 'undefined') {
    // Assuming ChartDataLabels is loaded globally by a script tag, if not, it needs to be imported.
    // For now, we'll assume it's available or will be loaded.
    // If not, a script tag for 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0' might be needed in _document.js
    console.warn("ChartDataLabels plugin not found. Please ensure it's loaded.");
  }
  if (typeof Chart !== 'undefined' && typeof ChartDataLabels !== 'undefined') {
    Chart.register(ChartDataLabels);
  }

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

      <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-bottom: 12px;">
        <div id="kpiArea" class="card kpi" style="grid-column: span 2;"></div>
        
        <div class="panel card" style="grid-column: span 2;">
          <h3>مخطط/فعلي</h3>
          <canvas id="chartPlanActual"></canvas>
        </div>
        
        <div class="panel card" style="grid-column: span 2;">
          <h3>المواقع</h3>
          <div id="map" style="height:250px;border-radius:8px"></div>
        </div>

        <div class="panel card" style="grid-column: span 2;">
            <h3>مراحل / مواقع</h3>
            <div id="sunburstChartContainer" style="height:250px; text-align: center; display: flex; align-items: center; justify-content: center;">
                <canvas id="sunburstChartCanvas"></canvas>
            </div>
        </div>
        
        <div class="panel card" style="grid-column: span 2;">
            <h3>إنجاز فعلي لكل المواقع</h3>
            <canvas id="chartOverallActual"></canvas>
        </div>
        
        <div class="card kpi">
            <h3>الإنجاز الفعلي</h3>
            <div id="gaugeActual" class="gauge-container" style="height: 150px; display: flex; align-items: center; justify-content: center; position: relative;">
                <canvas></canvas>
            </div>
        </div>
        <div class="card kpi">
            <h3>الإنجاز المخطط</h3>
            <div id="gaugePlanned" class="gauge-container" style="height: 150px; display: flex; align-items: center; justify-content: center; position: relative;">
                <canvas></canvas>
            </div>
        </div>

        <div class="card full" style="grid-column: span 4;">
          <h3 id="performanceTitle">أداء المواقع</h3>
          <div id="donutArea" class="donuts"></div>
          <div id="gaugeArea" style="display:none;text-align:center;padding:20px"></div>
        </div>
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
    charts: { main: null, donuts: [], gauge: null, sunburst: null, overallActual: null },
    gauges: { planned: null, actual: null },
    map: { instance: null, markers: [], originalView: null },
    selectedSite: null,

    selectedPhase: null,
    selectedItem: null,
=======

    selectedPhase: null,
    selectedItem: null,
=======
    selectedStage: null,

    lastUpdated: null,
    refreshIntervalId: null,
  };

  // ======== دوال مساعدة ========
  function normalizePercent(value) {
    if (value == null) return 0;
    if (typeof value === "number") return value > 1 ? value / 100 : value;
    let s = String(value).trim();
    if (s === "") return 0;
    s = s.replace("%", "").replace(",", ".");
    const n = parseFloat(s);
    if (isNaN(n)) return 0;
    return n > 1 ? n / 100 : n;
  }
  function avg(arr) {
    const a = arr.filter((n) => typeof n === "number" && !isNaN(n));
    if (!a.length) return 0;
    return a.reduce((s, v) => s + v, 0) / a.length;
  }
  const pct = (v) => `${(v * 100).toFixed(1)}%`;
  function formatDateTime(d) {
    try {
      return new Date(d).toLocaleString("ar-SA");
    } catch (e) {
      return String(d);
    }
  }

  function toArabicNumbers(str) {
    return str.replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
  }

  function getHijriDate() {
    const today = new Date();
    const gYear = today.getFullYear();
    const gMonth = (today.getMonth() + 1).toString().padStart(2, "0");
    const gDay = today.getDate().toString().padStart(2, "0");
    const gregorianDate = `${gYear}-${gMonth}-${gDay}م`;

    try {
      const hijriFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const hijriParts = hijriFormatter.formatToParts(today);
      const hijriYear = hijriParts.find((p) => p.type === "year").value;
      const hijriMonth = hijriParts.find((p) => p.type === "month").value;
      const hijriDay = hijriParts.find((p) => p.type === "day").value;
      const hijriDate = `${hijriYear}-${hijriMonth}-${hijriDay}هـ`;
      return toArabicNumbers(`${hijriDate} / ${gregorianDate}`);
    } catch (e) {
      return toArabicNumbers(gregorianDate);
    }
  }

  // ======== Theme ========
  const themeBtn = document.getElementById("themeBtn");
  function applyTheme() {
    const t = localStorage.getItem("theme") || "dark";
    if (t === "light") document.body.classList.add("light");
    else document.body.classList.remove("light");
  }
  themeBtn.addEventListener("click", () => {
    const now = document.body.classList.toggle("light") ? "light" : "dark";
    localStorage.setItem("theme", now);
    // Re-render the gauge chart to update its colors
    renderPerformanceCharts();
  });
  applyTheme();

  // ======== Loader ========
  const loader = document.getElementById("loader");
  function showLoader() {
    loader.style.display = "flex";
  }
  function hideLoader() {
    loader.style.display = "none";
  }

  // ======== جلب البيانات من الـ API ========
  async function fetchSheetsOnce() {
    console.log("Fetching sheets data...");
    try {
      // إضافة timestamp لمنع التخزين المؤقت للمتصفح
      const res = await fetch(`/api/sheets?t=${Date.now()}`);
      const j = await res.json();
      if (j.error) {
        console.error("API Sheets error:", j.error);
        return null;
      }
      return j.data || j;
    } catch (e) {
      console.error("Fetch sheets failed:", e);
      return null;
    }
  }

  // ======== تهيئة البيانات داخل الواجهة ========
  function hydrate(data) {
    if (!data) {
      console.error("No data received for hydration");
      return;
    }

    console.log("Hydrating data:", data);
    
    // Clear existing state
    state.raw = { detailed: [], summary: [], geo: [] };
    state.filtered = { detailed: [], summary: [], geo: [] };
    
    // Reset filters
    state.selectedSite = null;
    state.selectedPhase = null;
    state.selectedItem = null;

    // Update data
    const detailed = (data.detailed || data.data?.detailed || [])
      .filter(row => {
        // تجاهل الصفوف التي لا تحتوي على موقع
        return row["الموقع"] && String(row["الموقع"]).trim() !== "";
      })
      .map((r) => ({ ...r }));

    const summary = (data.summary || data.data?.summary || [])
      .filter(row => {
        // تجاهل الصفوف التي لا تحتوي على موقع
        return row["الموقع"] && String(row["الموقع"]).trim() !== "";
      })
      .map((r) => ({ ...r }));

    const geo = (data.geo || data.data?.geo || [])
      .filter(row => {
        // تجاهل الصفوف التي لا تحتوي على موقع
        return row["الموقع"] && String(row["الموقع"]).trim() !== "";
      })
      .map((r) => ({ ...r }));

    state.raw = { detailed, summary, geo };
    
    console.log("Filtered Data:", {
      detailedCount: detailed.length,
      summaryCount: summary.length,
      geoCount: geo.length
    });

    buildFilters();
    applyFilters();
    renderAll();


    // تحديث آخر تحديث للبيانات
    const lastUpdateText = document.getElementById("lastUpdate");
    if (lastUpdateText) {
      lastUpdateText.textContent = "آخر تحديث: " + formatDateTime(new Date());

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

  function buildFilters() {
    const sites = [
      ...new Set(state.raw.detailed.map((r) => r["الموقع"] || "").filter(Boolean)),
    ].sort();
    const phases = [
      ...new Set(
        state.raw.detailed.map((r) => r["المرحلة"] || "").filter(Boolean)
      ),
    ].sort();
    const items = [
      ...new Set(
        state.raw.detailed.map((r) => r["البند الرئيسي"] || "").filter(Boolean)
      ),
    ].sort();

    const siteFilter = document.getElementById("siteFilter");
    siteFilter.innerHTML =
      '<option value="">كل المواقع</option>' +
      sites.map((s) => `<option value="${s}">${s}</option>`).join("");

    const phaseFilter = document.getElementById("phaseFilter");
    phaseFilter.innerHTML =
      '<option value="">كل المراحل</option>' +
      phases.map((p) => `<option value="${p}">${p}</option>`).join("");

    const itemFilter = document.getElementById("itemFilter");
    itemFilter.innerHTML =
      '<option value="">كل البنود الرئيسية</option>' +
      items.map((i) => `<option value="${i}">${i}</option>`).join("");

    const chartSiteFilter = document.getElementById("chartSiteFilter");
    chartSiteFilter.innerHTML =
      '<option value="">كل المواقع</option>' +
      sites.map((s) => `<option value="${s}">${s}</option>`).join("");

    const mapSiteFilter = document.getElementById("mapSiteFilter");
    mapSiteFilter.innerHTML =
      '<option value="">كل المواقع</option>' +
      sites.map((s) => `<option value="${s}">${s}</option>`).join("");

    const tableSiteFilter = document.getElementById("tableSiteFilter");
    tableSiteFilter.innerHTML =
      '<option value="">كل المواقع</option>' +
      sites.map((s) => `<option value="${s}">${s}</option>`).join("");

    const tablePhaseFilter = document.getElementById("tablePhaseFilter");
    tablePhaseFilter.innerHTML =
      '<option value="">كل المراحل</option>' +
      phases.map((p) => `<option value="${p}">${p}</option>`).join("");

    const tableItemFilter = document.getElementById("tableItemFilter");
    tableItemFilter.innerHTML =
      '<option value="">كل البنود</option>' +
      items.map((i) => `<option value="${i}">${i}</option>`).join("");
  }

  // ======== فلترة مترابطة ========
  function applyFilters(source = null) {
    // Get values from all filter groups
    const mainFilters = {
      site: document.getElementById("siteFilter")?.value ?? "",
      phase: document.getElementById("phaseFilter")?.value ?? "",
      item: document.getElementById("itemFilter")?.value ?? ""
    };
    
    const tableFilters = {
      site: document.getElementById("tableSiteFilter")?.value ?? "",
      phase: document.getElementById("tablePhaseFilter")?.value ?? "",
      item: document.getElementById("tableItemFilter")?.value ?? ""
    };
    
    // Update state based on the source of the filter change
    if (source === 'table') {
      state.selectedSite = tableFilters.site || null;
      state.selectedPhase = tableFilters.phase || null;
      state.selectedItem = tableFilters.item || null;
    } else if (source === 'main') {
      state.selectedSite = mainFilters.site || null;
      state.selectedPhase = mainFilters.phase || null;
      state.selectedItem = mainFilters.item || null;
    }
    
    // Filter the data
    state.filtered.detailed = state.raw.detailed.filter((r) => {
      const siteMatch = !state.selectedSite || String(r["الموقع"] || "") === String(state.selectedSite);
      const phaseMatch = !state.selectedPhase || String(r["المرحلة"] || "") === String(state.selectedPhase);
      const itemMatch = !state.selectedItem || String(r["البند الرئيسي"] || "") === String(state.selectedItem);
      return siteMatch && phaseMatch && itemMatch;
    });

    state.filtered.summary = aggregateSummaryFromDetails(true);
    state.filtered.geo = state.filtered.summary;

    // Update clear buttons visibility
    const mainClearBtn = document.getElementById("clearFilter");
    const tableClearBtn = document.getElementById("tableDetailsClearFilter");
    
    const performanceClearBtn = document.getElementById("performanceClearFilter");

    if (state.selectedSite || state.selectedPhase || state.selectedItem) {
      mainClearBtn.style.display = "inline-block";
      tableClearBtn.style.display = "inline-block";
      performanceClearBtn.style.display = "inline-block";
    } else {
      mainClearBtn.style.display = "none";
      tableClearBtn.style.display = "none";
      performanceClearBtn.style.display = "none";
    }

    // Sync all filter dropdowns
    syncFilters();
  }

  function syncFilters() {
    // Create arrays of filter elements to sync
    const siteFilters = ["siteFilter", "chartSiteFilter", "mapSiteFilter", "tableSiteFilter"];
    const phaseFilters = ["phaseFilter", "tablePhaseFilter"];
    const itemFilters = ["itemFilter", "tableItemFilter"];

    // Sync site filters
    siteFilters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.value = state.selectedSite ?? "";
      }
    });

    // Sync phase filters
    phaseFilters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.value = state.selectedPhase ?? "";
      }
    });

    // Sync item filters
    itemFilters.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.value = state.selectedItem ?? "";
      }
    });
  }

  // ======== حساب تواريخ المشروع مع إصلاح حساب الأيام المتبقية ========
  function computeProjectDates() {
    if (state.projectDates) {
      return state.projectDates;
    }
    const rows = state.filtered.detailed;
    const parsed = rows
      .map((r) => {
        const s = r["تاريخ البداية"] || r["start"] || r["تarih_start"] || null;
        const e = r["تاريخ النهاية"] || r["end"] || r["تarih_end"] || null;
        const start = s ? new Date(s) : null;
        const end = e ? new Date(e) : null;
        return start && end ? { start, end } : start ? { start, end: start } : null;
      })
      .filter(Boolean);
    if (!parsed.length) return null;
    const starts = parsed.map((x) => x.start.getTime());
    const ends = parsed.map((x) => x.end.getTime());
    const min = new Date(Math.min(...starts));
    const max = new Date(Math.max(...ends));
    const today = new Date();
    const totalDays =
      Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24))) + 1;
    const elapsed = Math.max(0, Math.ceil((today - min) / (1000 * 60 * 60 * 24)));
    const remaining = Math.max(
      0,
      Math.ceil((max - today) / (1000 * 60 * 60 * 24))
    );
    return { min, max, totalDays, elapsed, remaining };
  }

  // ======== رندر KPIs ========
  function renderKPIs() {

    const container = document.getElementById("kpiArea");
    const summary = state.filtered.summary.length
      ? state.filtered.summary
      : aggregateSummaryFromDetails(true);
    const sitesCount = new Set(
      state.filtered.detailed
        .filter(r => r["الموقع"] && String(r["الموقع"]).trim() !== "")
        .map((r) => String(r["الموقع"]).trim())
    ).size;
    const avgPlan = avg(
      summary.map(
        (s) =>
          normalizePercent(s["متوسط النسبة المخططة"] || s["النسبة المخططة (%)"] || 0)
      )
    );
    const avgActual = avg(
      summary.map(
        (s) =>
          normalizePercent(s["متوسط النسبة الفعلية"] || s["النسبة الفعلية (%)"] || 0)
      )
    );
<<<<<<< HEAD
=======
=======
    const container = document.getElementById('kpiArea');
    if (!container) return;
    const summary = state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true);
    const sitesCount = new Set(state.filtered.detailed.map(r => r['الموقع'] || r['SiteKey'])).size;
    const avgPlan = avg(summary.map(s => normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0)));
    const avgActual = avg(summary.map(s => normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0)));

    const avgDelta = avgActual - avgPlan;
    const pd = computeProjectDates();
    const itemsCount = state.filtered.detailed.length;

    container.innerHTML = `
      <div class="card kpi"><h3>عدد المواقع</h3><div class="value">${sitesCount}</div></div>

      <div class="card kpi"><h3>متوسط المخطط</h3><div class="value">${pct(
        avgPlan
      )}</div></div>
      <div class="card kpi"><h3>متوسط الفعلي</h3><div class="value">${pct(
        avgActual
      )}</div></div>
      <div class="card kpi"><h3>متوسط الانحراف</h3><div class="value" style="color:${
        avgDelta < 0 ? "var(--danger)" : "var(--success)"
      }">${pct(avgDelta)}</div></div>
      <div class="card kpi"><h3>مدة المشروع (يوم)</h3><div class="value">${
        pd ? pd.totalDays : "—"
      }</div></div>
      <div class="card kpi"><h3>الأيام المنقضية</h3><div class="value">${
        pd ? pd.elapsed : "—"
      }</div></div>
      <div class="card kpi"><h3>الأيام المتبقية</h3><div class="value">${
        pd ? pd.remaining : "—"
      }</div></div>
<<<<<<< HEAD
=======
=======
      <div class="card kpi"><h3>متوسط المخطط</h3><div class="value">${pct(avgPlan)}</div></div>
      <div class="card kpi"><h3>متوسط الفعلي</h3><div class="value" style="color:${avgDelta<0?'var(--danger)':'var(--success)'}">${pct(avgActual)}</div></div>
      <div class="card kpi"><h3>متوسط الانحراف</h3><div class="value" style="color:${avgDelta<0?'var(--danger)':'var(--success)'}">${pct(avgDelta)}</div></div>
      <div class="card kpi"><h3>مدة المشروع (يوم)</h3><div class="value">${pd ? pd.totalDays : '—'}</div></div>
      <div class="card kpi"><h3>الأيام المنقضية</h3><div class="value">${pd ? pd.elapsed : '—'}</div></div>
      <div class="card kpi"><h3>الأيام المتبقية</h3><div class="value">${pd ? pd.remaining : '—'}</div></div>
      <div class="card kpi"><h3>عدد البنود</h3><div class="value">${itemsCount}</div></div>
    `;
  }

  // ======== تجميع ملخص من التفاصيل (اختياري) ========
  function aggregateSummaryFromDetails(filtered = false) {
    const source = filtered ? state.filtered.detailed : state.raw.detailed;
    const map = {};
    source.forEach((r) => {
      const site = r["الموقع"] || r["SiteKey"] || "غير محدد";
      map[site] = map[site] || {
        site,
        plan: [],
        actual: [],
        lat: r["Latitude"] || r["Lat"] || 0,
        lng: r["Longitude"] || r["Lng"] || 0,
      };
      map[site].plan.push(
        normalizePercent(r["النسبة المخططة (%)"] || r["النسبة المخططة"] || 0)
      );
      map[site].actual.push(
        normalizePercent(r["النسبة الفعلية (%)"] || r["النسبة الفعلية"] || 0)
      );
    });
    return Object.values(map).map((v) => ({
      "الموقع": v.site,
      "متوسط النسبة المخططة": avg(v.plan),
      "متوسط النسبة الفعلية": avg(v.actual),
      "Latitude": v.lat,
      "Longitude": v.lng,
    }));
  }

  // ======== رندر المخطط الرئيسي (Chart.js) ========
  function renderCharts() {
    if (typeof Chart === "undefined") return;
    const summary = state.filtered.summary.length
      ? state.filtered.summary
      : aggregateSummaryFromDetails(true);
    const labels = summary.map((s) => s["الموقع"] || "");
    const plan = summary.map(
      (s) => normalizePercent(s["متوسط النسبة المخططة"] || 0) * 100
    );
    const actual = summary.map(
      (s) => normalizePercent(s["متوسط النسبة الفعلية"] || 0) * 100
    );

    try {
      state.charts.main?.destroy();
    } catch (e) {
      /* ignore */
    }

    const ctx = document.getElementById("chartPlanActual").getContext("2d");
    state.charts.main = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { 
            label: "مخطط %", 
            data: plan, 
            backgroundColor: "rgba(79,140,255,0.95)",
          },
          {
            label: "فعلي %",
            data: actual,
            backgroundColor: "rgba(34,197,94,0.95)",
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          datalabels: {
            display: false // Remove fixed labels
          }
        },
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
          const summaryRow = summary.find((x) => x["الموقع"] === site);
          if (summaryRow && summaryRow.Latitude && summaryRow.Longitude) {
            try {
              state.map.instance.setView(
                [Number(summaryRow.Latitude), Number(summaryRow.Longitude)],
                6,
                { animate: true }
              );
            } catch (e) {}
          }
        },
        scales: { y: { beginAtZero: true, max: 100 } },
      },
    });

    // مخطط الإنجاز الفعلي لكل المواقع
    try { state.charts.overallActual?.destroy(); } catch (e) {}

    const overallActualCtx = document.getElementById('chartOverallActual').getContext('2d');
    state.charts.overallActual = new Chart(overallActualCtx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'إنجاز فعلي %',
                    data: actual,
                    borderColor: 'rgba(34,197,94,0.95)',
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true, max: 100 }
            },
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
                const summaryRow = (state.filtered.summary.length ? state.filtered.summary : aggregateSummaryFromDetails(true)).find(x => x['الموقع'] === site);
                if (summaryRow && summaryRow.Latitude && summaryRow.Longitude) {
                    try { 
                        state.map.instance.setView([Number(summaryRow.Latitude), Number(summaryRow.Longitude)], 12, { animate: true });
                    } catch (e) {}
                }
            }
        }
    });
  }

  // ======== رندر Gauge Chart للموقع الواحد أو Donuts للكل ========
  function renderPerformanceCharts() {
    if (typeof Chart === "undefined") return;

    const donutArea = document.getElementById("donutArea");
    const gaugeArea = document.getElementById("gaugeArea");
    const title = document.getElementById("performanceTitle");

    state.charts.donuts.forEach((c) => {
      try {
        c.destroy();
      } catch (e) {}
    });
    state.charts.donuts = [];
    if (state.charts.gauge) {
      try {
        state.charts.gauge.destroy();
      } catch (e) {}
      state.charts.gauge = null;
    }

    const summary = state.filtered.summary.length
      ? state.filtered.summary
      : aggregateSummaryFromDetails(true);

    if (state.selectedSite && summary.length === 1) {
      donutArea.style.display = "none";
      gaugeArea.style.display = "block";
      title.textContent = `أداء موقع: ${state.selectedSite}`;

      const s = summary[0];
      const planVal =
        normalizePercent(s["متوسط النسبة المخططة"] || s["النسبة المخططة (%)"] || 0) *
        100;
      const actVal =
        normalizePercent(
          s["متوسط النسبة الفعلية"] || s["النسبة الفعلية (%)"] || 0
        ) * 100;
      const targetVal = 100;
      const deviation = (actVal - planVal).toFixed(1);
      const deviationColor = deviation >= 0 ? "var(--success)" : "var(--danger)";

      gaugeArea.innerHTML = `
        <div class="gauge-container">
          <canvas id="gaugeChart"></canvas>
          <div class="gauge-info">
            <div class="gauge-item">
              <span class="gauge-label">القيمة الحالية</span>
              <div class="gauge-value" style="color:${
                actVal >= planVal ? "var(--success)" : "var(--danger)"
              }">${actVal.toFixed(1)}%</div>
            </div>
            <div class="gauge-item">
              <span class="gauge-label">القيمة المخططة</span>
              <div class="gauge-value" style="color:var(--chart-planned)">${planVal.toFixed(1)}%</div>
            </div>
            <div class="gauge-item">
              <span class="gauge-label">معدل الانحراف</span>
              <div class="gauge-value" style="color:${deviationColor}">${deviation}%</div>
            </div>
            <div class="gauge-item">
              <span class="gauge-label">الهدف</span>
              <div class="gauge-value" style="color:var(--text)">${targetVal}%</div>
            </div>
          </div>
        </div>
      `;

      const ctx = document.getElementById("gaugeChart").getContext("2d");
      state.charts.gauge = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["فعلي", "متبقي"],
          datasets: [
            {
              data: [actVal, Math.max(0, 100 - actVal)],
              backgroundColor: [
                actVal >= planVal
                  ? "rgba(34,197,94,0.95)"
                  : "rgba(239,68,68,0.95)",
                document.body.classList.contains('light') 
                  ? "rgba(200,200,200,0.2)"
                  : "rgba(255,255,255,0.1)",
              ],
              borderWidth: 0,
              circumference: 180,
              rotation: 270,
              cutout: "75%",
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
            datalabels: {
              display: true,
              color: (context) => {
                const isDark = !document.body.classList.contains('light');
                return isDark ? '#fff' : '#000';
              },
              formatter: (value, context) => {
                if (context.dataIndex === 0) {
                  return value.toFixed(1) + '%';
                }
                return '';
              },
              font: {
                weight: 'bold',
                size: 16,
              },
              align: 'end',
              anchor: 'end',
              offset: -30,
            },
          },
        },
        plugins: [ChartDataLabels],
      });
    } else {
      donutArea.style.display = "grid";
      gaugeArea.style.display = "none";
      title.textContent = "أداء المواقع";
      donutArea.innerHTML = "";

      summary.forEach((s) => {
        const planVal =
          normalizePercent(
            s["متوسط النسبة المخططة"] || s["النسبة المخططة (%)"] || 0
          ) * 100;
        const actVal =
          normalizePercent(
            s["متوسط النسبة الفعلية"] || s["النسبة الفعلية (%)"] || 0
          ) * 100;
        const deviation = (actVal - planVal).toFixed(1);
        const deviationColor = deviation >= 0 ? "var(--success)" : "var(--danger)";

        const el = document.createElement("div");
        el.className = "card donut-card";
        el.innerHTML = `
          <h4 style="margin:4px 0">${s["الموقع"]}</h4>
          <div style="position:relative">
            <canvas></canvas>
            <div class="donut-info">
              <div style="color:var(--chart-planned)">مخطط: ${planVal.toFixed(1)}%</div>
              <div style="color:rgba(34,197,94,0.95)">فعلي: ${actVal.toFixed(1)}%</div>
              <div style="color:${deviationColor}">الانحراف: ${deviation}%</div>
            </div>
          </div>
        `;
        donutArea.appendChild(el);
        const ctx = el.querySelector("canvas").getContext("2d");

        const chart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["مخطط", "فعلي"],
            datasets: [
              {
                data: [planVal, actVal],
                backgroundColor: [
                  "rgba(79,140,255,0.95)",
                  "rgba(34,197,94,0.95)",
                ],
              },
            ],
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true },
              datalabels: {
                display: true,
                color: '#fff',
                formatter: (value, context) => {
                  return value.toFixed(1) + '%';
                },
                font: {
                  weight: 'bold',
                  size: 12,
                },
                align: 'center',
                anchor: 'center',
                offset: 0,
                textAlign: 'center',
              },
            },
            onClick: () => {
              state.selectedSite = s["الموقع"];
              state.selectedSite = s["الموقع"];

              state.selectedSite = s['الموقع'];
              state.selectedStage = null;
              const sel = document.getElementById('siteFilter');
              if (sel) sel.value = s['الموقع'];
              applyFilters();
              renderAll();
            },
          },
          plugins: [ChartDataLabels],
        });
        state.charts.donuts.push(chart);
      });
    }
  }

  // ======== رندر الخريطة ========
  function renderMap() {
    if (typeof L === "undefined") return;
    const geoData = state.filtered.geo;

    try {
      state.map.instance?.remove();
    } catch (e) {
      /* ignore */
    }

  // ======== رندر الخريطة ========
  // ======== رندر المقاييس (Gauges) للنسب المئوية ========
  function renderGauges() {
    if (typeof Chart === 'undefined') return;

    const detailedData = state.filtered.detailed;
    const totalActual = avg(detailedData.map(r => normalizePercent(r['النسبة الفعلية (%)'] || 0)));
    const totalPlanned = avg(detailedData.map(r => normalizePercent(r['النسبة المخططة (%)'] || 0)));

    // Gauge للإنجاز الفعلي
    const actualCanvas = document.getElementById('gaugeActual').querySelector('canvas');
    if (actualCanvas) {
      if (state.gauges.actual) { state.gauges.actual.destroy(); }
      const ctx = actualCanvas.getContext('2d');
      state.gauges.actual = new Chart(ctx, {
          type: 'doughnut',
          data: {
              labels: ['الإنجاز الفعلي', 'المتبقي'],
              datasets: [{
                  data: [totalActual * 100, 100 - (totalActual * 100)],
                  backgroundColor: ['var(--success)', 'rgba(255,255,255,0.1)'],
                  borderWidth: 0,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '80%',
              rotation: 270,
              circumference: 180,
              plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false }
              }
          }
      });
      const valueSpan = document.createElement('span');
      valueSpan.textContent = `${(totalActual * 100).toFixed(1)}%`;
      valueSpan.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -10%);
        font-size: 20px;
        font-weight: bold;
        color: var(--success);
        direction: ltr;
      `;
      document.getElementById('gaugeActual').appendChild(valueSpan);
    }

    // Gauge للإنجاز المخطط
    const plannedCanvas = document.getElementById('gaugePlanned').querySelector('canvas');
    if (plannedCanvas) {
      if (state.gauges.planned) { state.gauges.planned.destroy(); }
      const ctx = plannedCanvas.getContext('2d');
      state.gauges.planned = new Chart(ctx, {
          type: 'doughnut',
          data: {
              labels: ['الإنجاز المخطط', 'المتبقي'],
              datasets: [{
                  data: [totalPlanned * 100, 100 - (totalPlanned * 100)],
                  backgroundColor: ['var(--accent1)', 'rgba(255,255,255,0.1)'],
                  borderWidth: 0,
              }]
          },
          options: {
              responsive: true,
              maintainAspectRatio: false,
              cutout: '80%',
              rotation: 270,
              circumference: 180,
              plugins: {
                  legend: { display: false },
                  tooltip: { enabled: false }
              }
          }
      });
      const valueSpan = document.createElement('span');
      valueSpan.textContent = `${(totalPlanned * 100).toFixed(1)}%`;
      valueSpan.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -10%);
        font-size: 20px;
        font-weight: bold;
        color: var(--accent1);
        direction: ltr;
      `;
      document.getElementById('gaugePlanned').appendChild(valueSpan);
    }
  }


  // ======== رندر الخريطة (Leaflet) مع حل مشكلة الثبات ========
  function renderMap() {
    if (typeof L === "undefined") return;
    const geoData = state.filtered.geo;

    try {
      state.map.instance?.remove();
    } catch (e) {
      /* ignore */
    }

    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    state.map.instance = L.map("map").setView([24.7136, 46.6753], 6);
    state.map.originalView = {
      center: state.map.instance.getCenter(),
      zoom: state.map.instance.getZoom(),
    };

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(state.map.instance);

    state.map.markers.forEach((m) => {
      try {
        m.remove();
      } catch (e) {}
    });
    state.map.markers = [];
    geoData.forEach((g) => {
      if (g.Latitude && g.Longitude) {
        const marker = L.marker([g.Latitude, g.Longitude])
          .addTo(state.map.instance)
          .bindPopup(
            `<b>${g["الموقع"]}</b><br>مخطط: ${pct(
              normalizePercent(g["متوسط النسبة المخططة"])
            )}<br>فعلي: ${pct(normalizePercent(g["متوسط النسبة الفعلية"]))}`
          )
          .on("click", () => {
            state.selectedSite = g["الموقع"];
            applyFilters();
            renderAll();
          });
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
      }
    });

    if (state.map.markers.length > 0) {
      const group = new L.featureGroup(state.map.markers);
      state.map.instance.fitBounds(group.getBounds(), { 
        padding: [50, 50],
        maxZoom: 8 // Limit maximum zoom level
      });
    }
    
    // Make map container responsive
    const resizeMap = () => {
      state.map.instance.invalidateSize();
    };
    window.addEventListener('resize', resizeMap);
  }

  // ======== رندر الجدول ========
  function renderTable() {
    const tableHead = document.getElementById("tableHead");
    const tableBody = document.getElementById("tableBody");
    const tableFooter = document.getElementById("tableFooter");
    const searchInput = document.getElementById("searchInput");

    const detailedData = state.filtered.detailed;
    const headers = Object.keys(detailedData[0] || {});

    tableHead.innerHTML = `<tr>${headers
      .map((h) => `<th data-sort="${h}">${h}</th>`)
      .join("")}</tr>`;
    tableBody.innerHTML = detailedData
      .map((row) => `<tr>${headers.map((h) => `<td>${row[h]}</td>`).join("")}</tr>`)
      .join("");
    tableFooter.textContent = `عرض ${detailedData.length} من ${state.raw.detailed.length} سجل`;

    tableHead.querySelectorAll("th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        const isAsc = th.classList.contains("asc");

        tableHead.querySelectorAll("th").forEach((otherTh) => {
          if (otherTh !== th) {
            otherTh.classList.remove("asc", "desc");
          }
        });

        state.filtered.detailed.sort((a, b) => {
          const valA = a[key];
          const valB = b[key];

          if (typeof valA === "string" && typeof valB === "string") {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          if (typeof valA === "number" && typeof valB === "number") {
            return isAsc ? valA - valB : valB - valA;
          }
          return 0;
        });

        th.classList.toggle("asc", !isAsc);
        th.classList.toggle("desc", isAsc);
        renderTable();
      });
    });

    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase();
      state.filtered.detailed = state.raw.detailed.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm)
        )
      );
      renderTable();
    });
  }

  // ======== رندر الكل ========


  // ======== رندر الجدول ========
  function renderTable() {
    const tableHead = document.getElementById("tableHead");
    const tableBody = document.getElementById("tableBody");
    const tableFooter = document.getElementById("tableFooter");
    const searchInput = document.getElementById("searchInput");

    const detailedData = state.filtered.detailed;
    const headers = Object.keys(detailedData[0] || {});

    tableHead.innerHTML = `<tr>${headers
      .map((h) => `<th data-sort="${h}">${h}</th>`)
      .join("")}</tr>`;
    tableBody.innerHTML = detailedData
      .map((row) => `<tr>${headers.map((h) => `<td>${row[h]}</td>`).join("")}</tr>`)
      .join("");
    tableFooter.textContent = `عرض ${detailedData.length} من ${state.raw.detailed.length} سجل`;

    tableHead.querySelectorAll("th").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        const isAsc = th.classList.contains("asc");

        tableHead.querySelectorAll("th").forEach((otherTh) => {
          if (otherTh !== th) {
            otherTh.classList.remove("asc", "desc");
          }
        });

        state.filtered.detailed.sort((a, b) => {
          const valA = a[key];
          const valB = b[key];

          if (typeof valA === "string" && typeof valB === "string") {
            return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          if (typeof valA === "number" && typeof valB === "number") {
            return isAsc ? valA - valB : valB - valA;
          }
          return 0;
        });

        th.classList.toggle("asc", !isAsc);
        th.classList.toggle("desc", isAsc);
        renderTable();
      });
    });

    searchInput.addEventListener("input", () => {
      const searchTerm = searchInput.value.toLowerCase();
      state.filtered.detailed = state.raw.detailed.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(searchTerm)
        )
      );
      renderTable();
    });
  }
  
  // ======== رندر مخطط Sunburst ========
  function renderSunburstChart() {
    if (typeof sunburst === 'undefined') {
      const el = document.getElementById('sunburstChartContainer');
      if (el) el.innerHTML = `
        <div style="text-align:center;color:var(--muted);font-weight:600">
          مخطط Sunburst غير متوفر.
        </div>
      `;
      return;
    }

    const container = document.getElementById('sunburstChartContainer');
    if (!container) return;
    
    // Clear previous sunburst
    container.innerHTML = `<canvas id="sunburstChartCanvas"></canvas>`;
    
    const detailedData = state.raw.detailed;
    
    const dataByStage = detailedData.reduce((acc, row) => {
      const site = row['الموقع'];
      const stage = row['المرحلة'];
      if (!site || !stage) return acc;
      
      if (!acc[stage]) {
        acc[stage] = { name: stage, children: [] };
      }
      acc[stage].children.push({ name: site, value: 1 });
      return acc;
    }, {});
    
    const sunburstData = {
        name: 'التفاصيل',
        children: Object.values(dataByStage)
    };
    
    state.charts.sunburst = sunburst()
        .data(sunburstData)
        .size('value')
        .label('name')
        .width(container.clientWidth)
        .height(container.clientHeight)
        (document.getElementById('sunburstChartCanvas'));
  }

 
  // ======== رندر الكل ========

  // ======== جدول التفاصيل ========
  let sort = { key: null, asc: true };
  function renderTable() {
    const cols = ['الموقع', 'المرحلة', 'البند الرئيسي', 'تاريخ البداية', 'المدة الكلية (يوم)', 'تاريخ النهاية', 'النسبة المخططة (%)', 'النسبة الفعلية (%)', 'الانحراف (%)'];
    const head = document.getElementById('tableHead');
    if (!head) return;
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
    if (!body) return;
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
    renderPerformanceCharts();
    renderMap();
    renderTable();
  }
  // ======== جلب وتهيئة البيانات ========
  async function fetchDataAndHydrate() {
    renderMap();
    renderTable();
  }

  // ======== جلب وتهيئة البيانات ========
  async function fetchDataAndHydrate() {

    renderSunburstChart();
    renderGauges();
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
      const lastUpdateText = document.getElementById("lastUpdate");
      if (lastUpdateText) {
        lastUpdateText.textContent = "آخر تحديث: " + formatDateTime(new Date());
      }
    }
    return data;
  }

  // ======== الأحداث ========
  function initializeDashboard() {
    console.log("Initializing dashboard...");
    showLoader();
    fetchDataAndHydrate().then(() => {
      hideLoader();
    });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        const view = this.dataset.tab;
        document.getElementById("viewSummary").style.display =
          view === "summary" ? "block" : "none";
        document.getElementById("viewDetails").style.display =
          view === "details" ? "block" : "none";
        if (view === "summary") {
          renderCharts();
          renderPerformanceCharts();
          renderMap();
        }
      });
    });

    document.getElementById("siteFilter").addEventListener("change", (e) => {
      state.selectedSite = e.target.value;
      state.selectedPhase = null;
      state.selectedItem = null;
      applyFilters();
      renderAll();
    });
    document.getElementById("phaseFilter").addEventListener("change", (e) => {
      state.selectedPhase = e.target.value;
      applyFilters();
      renderAll();
    });
    document.getElementById("itemFilter").addEventListener("change", (e) => {
      state.selectedItem = e.target.value;
      applyFilters();
      renderAll();
    });
    function clearAllFilters() {
      // Clear all state filters
      state.selectedSite = null;
      state.selectedPhase = null;
      state.selectedItem = null;
      
      // Clear all filter dropdowns
      ["siteFilter", "phaseFilter", "itemFilter", 
       "chartSiteFilter", "mapSiteFilter",
       "tableSiteFilter", "tablePhaseFilter", "tableItemFilter"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
      });
      
      // Reset filters and render
      applyFilters();
      renderAll();
      
      // Reset map view
      if (state.map.instance && state.map.originalView) {
        state.map.instance.setView(state.map.originalView.center, state.map.originalView.zoom);
      }
    }


    document.getElementById("clearFilter").addEventListener("click", clearAllFilters);
    document.getElementById("tableDetailsClearFilter").addEventListener("click", clearAllFilters);
    document.getElementById("performanceClearFilter").addEventListener("click", clearAllFilters);

    document.getElementById("chartSiteFilter").addEventListener("change", (e) => {
      state.selectedSite = e.target.value;
      applyFilters();
      renderAll();
    });

    document.getElementById("mapSiteFilter").addEventListener("change", (e) => {
      state.selectedSite = e.target.value;
      applyFilters();
      renderAll();
    });

    document.getElementById("tableSiteFilter").addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });
    document.getElementById("tablePhaseFilter").addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });
    document.getElementById("tableItemFilter").addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });

    // Table clear filter button
    document.getElementById("tableDetailsClearFilter").addEventListener("click", () => {
      state.selectedSite = null;
      state.selectedPhase = null;
      state.selectedItem = null;
      
      ["siteFilter", "phaseFilter", "itemFilter", 
       "chartSiteFilter", "mapSiteFilter",
       "tableSiteFilter", "tablePhaseFilter", "tableItemFilter"].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = "";
      });
      
      applyFilters();
      renderAll();
      
      if (state.map.instance && state.map.originalView) {
        state.map.instance.setView(state.map.originalView.center, state.map.originalView.zoom);
      }
    });



    document.getElementById("refreshBtn").addEventListener("click", async () => {
      showLoader();
      await fetchDataAndHydrate();
      hideLoader();
    });

    state.refreshIntervalId = setInterval(async () => {
      console.log("Auto-refreshing data...");
      await fetchDataAndHydrate();
    }, 10800000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
  } else {
    initializeDashboard();
  }

  async function fetchDataAndHydrate() {
    const data = await fetchSheetsOnce();
    if (data) {
      state.projectDates = data.projectDates;
      hydrate(data);
      state.lastUpdated = new Date();
      document.getElementById(
        "lastUpdate"
      ).textContent = `آخر تحديث: ${formatDateTime(state.lastUpdated)}`;
    }
  }
// ======== نهاية الوحدة ========
})();
