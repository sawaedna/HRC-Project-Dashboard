(function () {
  console.log("app.js script loaded and executing.");
  if (typeof window === "undefined") return;

  // Import and register ChartDataLabels plugin (loaded globally from CDN in _app.js)
  if (typeof Chart !== 'undefined') {
    if (typeof ChartDataLabels === 'undefined') {
      console.warn(
        "ChartDataLabels plugin (expected v2.2.0) not found. Please ensure it's loaded before /js/app.js."
      );
    } else if (!window.__chartDataLabelsRegistered) {
      Chart.register(ChartDataLabels);
      window.__chartDataLabelsRegistered = true;
    }
  }

  // ======== الحالة العامة ========
  const state = {
    raw: { detailed: [], summary: [], geo: [] },
    filtered: { detailed: [], summary: [], geo: [] },
    charts: { main: null, donuts: [], gauge: null },
    map: { instance: null, markers: [], originalView: null },
    selectedSite: null,
    selectedPhase: null,
    selectedItem: null,
    projectDates: null,
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

  }

  // ======== جلب وتهيئة البيانات ========
  async function fetchDataAndHydrate() {
    const data = await fetchSheetsOnce();
    if (!data) {
      return null;
    }

    state.projectDates = data.projectDates ?? null;

    hydrate(data);

    state.lastUpdated = new Date();
    const lastUpdateText = document.getElementById("lastUpdate");
    if (lastUpdateText) {
      lastUpdateText.textContent = `آخر تحديث: ${formatDateTime(state.lastUpdated)}`;
    }

    return data;
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
    const avgDelta = avgActual - avgPlan;
    const pd = computeProjectDates();

    container.innerHTML = `
      <div class="card kpi kpi-sites"><h3>عدد المواقع</h3><div class="value">${sitesCount}</div></div>
      <div class="card kpi kpi-plan"><h3>متوسط المخطط</h3><div class="value">${pct(
        avgPlan
      )}</div></div>
      <div class="card kpi kpi-actual"><h3>متوسط الفعلي</h3><div class="value">${pct(
        avgActual
      )}</div></div>
      <div class="card kpi kpi-delta"><h3>متوسط الانحراف</h3><div class="value" style="color:${
        avgDelta < 0 ? "var(--danger)" : "var(--success)"
      }">${pct(avgDelta)}</div></div>
      <div class="card kpi kpi-duration"><h3>مدة المشروع (يوم)</h3><div class="value">${
        pd ? pd.totalDays : "—"
      }</div></div>
      <div class="card kpi kpi-elapsed"><h3>الأيام المنقضية</h3><div class="value">${
        pd ? pd.elapsed : "—"
      }</div></div>
      <div class="card kpi kpi-remaining"><h3>الأيام المتبقية</h3><div class="value">${
        pd ? pd.remaining : "—"
      }</div></div>
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

    const mapElement = document.getElementById("map");
    if (!mapElement) return;

    state.map.instance = L.map("map", {
      // تحسين إعدادات الخريطة لتقليل طلبات tiles غير الضرورية
      preferCanvas: true,
      zoomControl: true,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      maxBoundsViscosity: 0.5,
      // تحديد حدود الخريطة للمملكة العربية السعودية
      maxBounds: [[15, 30], [35, 60]],
      // تحسين الأداء
      renderer: L.canvas({ padding: 0.5 })
    }).setView([24.7136, 46.6753], 6);
    state.map.originalView = {
      center: state.map.instance.getCenter(),
      zoom: state.map.instance.getZoom(),
    };

    // إضافة معالجة أخطاء وتحسينات لتحميل tiles الخريطة
    const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
      minZoom: 3,
      errorTileUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgZmlsbD0iI2Y1ZjVmNSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPtiu2LHZitio2Kkg2LrZitixINmF2KrYp9it2Kk8L3RleHQ+PC9zdmc+',
      retryDelay: 1000,
      retryLimit: 3,
      timeout: 10000
    });

    // إضافة معالج أحداث للأخطاء
    tileLayer.on('tileerror', function(error) {
      console.warn('خطأ في تحميل خريطة:', error);
      // لا نعرض تنبيه للمستخدم لتجنب الإزعاج
    });

    tileLayer.addTo(state.map.instance);

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
  function renderAll() {
    renderKPIs();
    renderCharts();
    renderPerformanceCharts();
    renderMap();
    renderTable();
  }

  // ======== الأحداث ========
  function initializeDashboard() {
    console.log("Initializing dashboard...");
    showLoader();
    fetchDataAndHydrate()
      .then((data) => {
        if (!data) {
          console.warn("لم يتم تحميل البيانات الأولية.");
        }
      })
      .finally(() => {
        hideLoader();
      });

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
        this.classList.add("active");
        const view = this.dataset.tab;
        document.getElementById("viewSummary").style.display =
          view === "summary" ? "grid" : "none";
        document.getElementById("viewDetails").style.display =
          view === "details" ? "grid" : "none";
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

    // Safe DOM bindings: check element exists before attaching listeners
    const elTableSiteFilter = document.getElementById("tableSiteFilter");
    if (elTableSiteFilter) elTableSiteFilter.addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });

    const elTablePhaseFilter = document.getElementById("tablePhaseFilter");
    if (elTablePhaseFilter) elTablePhaseFilter.addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });

    const elTableItemFilter = document.getElementById("tableItemFilter");
    if (elTableItemFilter) elTableItemFilter.addEventListener("change", (e) => {
      applyFilters('table');
      renderAll();
    });

    // Table clear filter button
    const elTableDetailsClear = document.getElementById("tableDetailsClearFilter");
    if (elTableDetailsClear) {
      elTableDetailsClear.addEventListener("click", () => {
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
    }

    const elRefreshBtn = document.getElementById("refreshBtn");
    if (elRefreshBtn) {
      elRefreshBtn.addEventListener("click", async () => {
        showLoader();
        try {
          const data = await fetchDataAndHydrate();
          if (!data) {
            console.warn("تعذر تحديث البيانات عند التحديث اليدوي.");
          }
        } finally {
          hideLoader();
        }
      });
    }

    state.refreshIntervalId = setInterval(async () => {
      console.log("Auto-refreshing data...");
      const data = await fetchDataAndHydrate();
      if (!data) {
        console.warn("فشل التحديث التلقائي للبيانات.");
      }
    }, 10800000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeDashboard);
  } else {
    initializeDashboard();
  }

})();
