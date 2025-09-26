import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState, useEffect, useCallback, useRef } from 'react';
import { toArabicNumbers } from '../src/utils/format';
import { normalizePercent, avg } from '../src/utils/data';
import GlobalGauges from '../src/component/GlobalGauges';

import { clamp } from 'three/src/math/MathUtils.js';

// Dynamic imports to prevent SSR issues
const MapView = dynamic(() => import('../src/component/MapView'), {
  ssr: false,
});

const TimelineChart = dynamic(() => import('../src/component/TimelineChart'), {
  ssr: false,
});

const DeviationChart = dynamic(() => import('../src/component/DeviationChart'), {
  ssr: false,
});

function FilterSelect({ options, value, onChange, label, ...props }) {
  return (
    <select
      className="select"
      value={value || ''}
      onChange={onChange}
      {...props}
    >
      <option value="">{label}</option>
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );
}

function SummaryView({ data, summary, geo, filters, setFilter, projectDates }) {
  const chartRef = useRef(null);
  const donutRefs = useRef([]);
  const gaugeRef = useRef(null);
  const donutAreaRef = useRef(null);
  const gaugeAreaRef = useRef(null);
  const performanceTitleRef = useRef(null);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;
  const ChartDataLabels = isClient ? window.ChartDataLabels : null;

  useEffect(() => {
    if (!Chart) return;

    // نسجّل chartjs-plugin-datalabels لو موجود
    try { if (ChartDataLabels) Chart.register(ChartDataLabels); } catch (_) {}

    // ✅ نسجّل بلجن كتابة النص مماسيًا على القوس مع شرط enabled وحارس منع التكرار
    try {
      Chart.register({
        id: 'tangentArcLabels',
/*         beforeUpdate(chart) { chart.$tangentDrawn = false; },
 */        afterDraw(chart, args, opts = {}) {
          // لا يعمل إلا عند التفعيل صراحة داخل options.plugins.tangentArcLabels.enabled
/*           if (!opts?.enabled || chart.$tangentDrawn) return;*/
              if (!opts?.enabled) return;
          chart.$tangentDrawn = true;

          const ctx = chart.ctx;
          const meta = chart.getDatasetMeta(0);
          const ds   = chart.data?.datasets?.[0];
          if (!meta || !ds) return;

          const font   = opts.font || {};
          const size   = font.size   || 12;
          const family = font.family || 'Cairo';
          const weight = font.weight || 'bold';
          const color  = opts.color  || '#fff';
          const min    = opts.minValue || 0;

          meta.data.forEach((arc, i) => {
            const v = Number(ds.data?.[i] ?? 0);
            const text = typeof opts.formatter === 'function'
              ? (opts.formatter(v, i, chart) || '')
              : (v >= min ? `${v.toFixed(1)}%` : '');
            if (!text) return;

            const { startAngle, endAngle, innerRadius, outerRadius, x, y } = arc.getProps(['startAngle','endAngle','innerRadius','outerRadius','x','y'], true);
            const mid = (startAngle + endAngle) / 2;
            const r   = (innerRadius + outerRadius) / 2;

            const tx = x + Math.cos(mid) * r;
            const ty = y + Math.sin(mid) * r;

            let rot = mid - Math.PI / 2;
            if (rot > Math.PI / 2 && rot < 3 * Math.PI / 2) rot += Math.PI;

            ctx.save();
            ctx.translate(tx, ty);
            ctx.rotate(rot);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.font = `${weight} ${size}px ${family}`;
            if (opts.shadow !== false) {
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(0,0,0,0.35)';
              ctx.strokeText(text, 0, 0);
            }
            ctx.fillStyle = color;
            ctx.fillText(text, 0, 0);
            ctx.restore();
          });
        },
      });
    } catch (_) {}
  }, [Chart, ChartDataLabels]);

  const renderCharts = useCallback(() => {
    if (!Chart || !summary || !summary.length) return;
    if (chartRef.current) {
      chartRef.current.destroy();
    }
    
    const labels = summary.map((s) => s['الموقع'] || '');
    const plan = summary.map((s) => normalizePercent(s['متوسط النسبة المخططة'] || 0) * 100);
    const actual = summary.map((s) => normalizePercent(s['متوسط النسبة الفعلية'] || 0) * 100);

    const ctx = document.getElementById('chartPlanActual')?.getContext('2d');
    if (!ctx) return;

    const newChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'مخطط %',
            data: plan,
            backgroundColor: 'rgba(79,140,255,0.95)',
          },
          {
            label: 'فعلي %',
            data: actual,
            backgroundColor: 'rgba(34,197,94,0.95)',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          datalabels: { display: false },
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 10, family: 'Cairo' },
              usePointStyle: true,
              padding: 10
            }
          }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          const site = labels[idx];
          setFilter('site', site);
        },
        scales: { 
          y: { 
            beginAtZero: true, 
            max: 100,
            ticks: { font: { size: 9 } }
          },
          x: {
            ticks: { 
              font: { size: 9 },
              maxRotation: 45
            }
          }
        },
      },
    });
    chartRef.current = newChart;
  }, [summary, setFilter, Chart]);

  const renderPerformanceCharts = useCallback(() => {
    if (!Chart || !donutAreaRef.current || !gaugeAreaRef.current || !performanceTitleRef.current) return;
  
    donutRefs.current.forEach(c => c.destroy());
    if (gaugeRef.current) gaugeRef.current.destroy();
    donutRefs.current = [];
    gaugeRef.current = null;
  
    if (filters.site && summary.length === 1) {
      donutAreaRef.current.style.display = 'none';
      gaugeAreaRef.current.style.display = 'block';
      performanceTitleRef.current.textContent = `أداء موقع: ${filters.site}`;
  
      const s = summary[0];
      const planVal = normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0) * 100;
      const actVal = normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0) * 100;
      const deviation = (actVal - planVal).toFixed(1);
      const deviationColor = deviation >= 0 ? 'var(--success)' : 'var(--danger)';
  
      gaugeAreaRef.current.innerHTML = `
        <div class="gauge-container">
          <canvas id="gaugeChart"></canvas>
          <div class="gauge-info">
            <div class="gauge-item">
              <span class="gauge-label">القيمة الحالية</span>
              <div class="gauge-value" style="color:${actVal >= planVal ? 'var(--success)' : 'var(--danger)'}">${actVal.toFixed(1)}%</div>
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
              <div class="gauge-value" style="color:var(--text)">100%</div>
            </div>
          </div>
        </div>
      `;
  
      const ctx = document.getElementById("gaugeChart")?.getContext("2d");
      if (!ctx) return;
      
      const newGauge = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["فعلي", "متبقي"],
          datasets: [
            {
              data: [actVal, Math.max(0, 100 - actVal)],
              backgroundColor: [
                actVal >= planVal ? "rgba(34,197,94,0.95)" : "rgba(239,68,68,0.95)",
                "rgba(200,200,200,0.2)",
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
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
            datalabels: { display: false },
            // ✅ نفعل البلجن هنا لكن نرجّع نصًا فارغًا
            tangentArcLabels: {
              enabled: true,
              formatter: () => '',
            },
          },
        },
      });
      gaugeRef.current = newGauge;
    } else {
      donutAreaRef.current.style.display = 'grid';
      gaugeAreaRef.current.style.display = 'none';
      performanceTitleRef.current.textContent = 'أداء المواقع';
      donutAreaRef.current.innerHTML = '';
      
      summary.forEach((s, index) => {
        const planVal = normalizePercent(s['متوسط النسبة المخططة'] || s['النسبة المخططة (%)'] || 0) * 100;
        const actVal = normalizePercent(s['متوسط النسبة الفعلية'] || s['النسبة الفعلية (%)'] || 0) * 100;
        const deviation = (actVal - planVal).toFixed(1);
        const deviationColor = deviation >= 0 ? 'var(--success)' : 'var(--danger)';
  
        const el = document.createElement("div");
        el.className = "panel-card donut-card";
        el.style.height = "180px";
        el.innerHTML = `
          <h4 style="margin: 0;">${s["الموقع"]}</h4>
          <div class="donut-chart-area">
            <canvas id="donutChart-${index}"></canvas>
          </div>
          <div class="donut-info">
            <div style="color:${deviationColor}">الانحراف: ${deviation}%</div>
          </div>
        `;
        donutAreaRef.current.appendChild(el);
        const ctx = document.getElementById(`donutChart-${index}`)?.getContext("2d");
        if (!ctx) return;
        
        const chart = new Chart(ctx, {
          type: "doughnut",
          data: {
            labels: ["مخطط", "فعلي"],
            datasets: [{ 
              data: [planVal, actVal], 
              backgroundColor: ["rgba(79,140,255,0.95)", "rgba(34,197,94,0.95)"] 
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { enabled: true },
              datalabels: { display: false },
              // ✅ نفعل البلجن للمخططات الدائرية الصغيرة لعرض القيم إن أردت
              tangentArcLabels: {
                enabled: true,
                color: '#0c0a0aff',
                font: { weight: 'bold', size: 10, family: 'Cairo' },
                minValue: 0,
                formatter: (value) => (value >= 1 ? value.toFixed(1) + '%' : ''),
              },
            },
            onClick: () => setFilter('site', s['الموقع']),
          },
        });
        donutRefs.current.push(chart);
      });
    }
  }, [summary, filters, setFilter, Chart]);

  useEffect(() => {
    if (Chart) {
      renderCharts();
      renderPerformanceCharts();
    }
    
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
      donutRefs.current.forEach(c => c.destroy());
      if (gaugeRef.current) {
        gaugeRef.current.destroy();
      }
    };
  }, [Chart, renderCharts, renderPerformanceCharts]);

  const sitesCount = new Set(data.filter(r => r["الموقع"] && String(r["الموقع"]).trim() !== "").map(r => String(r["الموقع"]).trim())).size;
  const avgPlan = avg(summary.map(s => normalizePercent(s["متوسط النسبة المخططة"] || s["النسبة المخططة (%)"] || 0)));
  const avgActual = avg(summary.map(s => normalizePercent(s["متوسط النسبة الفعلية"] || s["النسبة الفعلية (%)"] || 0)));
  const avgDelta = avgActual - avgPlan;

  return (
    <section id="viewSummary" className="dashboard-summary-view">
      {/* KPIs Section */}
      <section className="kpi-panel summary-grid__kpis">
        <div id="kpiArea" className="dashboard-kpi-area">
          <div className="kpi-card kpi kpi-sites">
            <h3>عدد المواقع</h3>
            <div className="value">{sitesCount}</div>
          </div>
          <div className="kpi-card kpi kpi-duration">
            <h3>مدة المشروع</h3>
            <div className="value">{projectDates?.totalDays || '—'}</div>
          </div>
          <div className="kpi-card kpi kpi-elapsed">
            <h3>الأيام المنقضية</h3>
            <div className="value">{projectDates?.elapsed || '—'}</div>
          </div>
          <div className="kpi-card kpi kpi-remaining">
            <h3>الأيام المتبقية</h3>
            <div className="value">{projectDates?.remaining || '—'}</div>
          </div>
        </div>
      </section>

      {/* Gauges Section */}
      <section className="gauges-panel summary-grid__gauges">
        <GlobalGauges 
          avgPlan={avgPlan} 
          avgActual={avgActual} 
          avgDeviation={avgDelta} 
        />
      </section>

      {/* Performance Section */}
      <section className="panel-card dashboard-performance-card summary-grid__performance">
        <div className="chart-header dashboard-panel-header">
          <h3 ref={performanceTitleRef}>أداء المواقع</h3>
          <button
            id="performanceClearFilter"
            className="btn clear-btn dashboard-clear-button"
            type="button"
            style={{ display: (filters.site || filters.phase || filters.item) ? 'inline-block' : 'none' }}
            onClick={() => setFilter('clear')}
          >
            إزالة الفلتر
          </button>
        </div>
        <div id="donutArea" ref={donutAreaRef} className="donuts dashboard-donut-area"></div>
        <div id="gaugeArea" ref={gaugeAreaRef} className="dashboard-gauge-area"></div>
      </section>

      {/* Map Section */}
      <div className="summary-grid__map">
        <MapView geo={geo} setFilter={setFilter} />
      </div>

      {/* Chart Bar Section */}
      <section className="panel-card dashboard-plan-actual-panel summary-grid__chart-bar">
        <div className="panel-header dashboard-panel-header">
          <h3>مخطط/فعلي</h3>
          <div className="chart-filter dashboard-chart-filter">
            <select
              id="chartSiteFilter"
              className="select dashboard-chart-site-filter"
              value={filters.site || ''}
              onChange={(e) => setFilter('site', e.target.value)}
            >
              <option value="">كل المواقع</option>
              {[...new Set(data.map(d => d['الموقع']))].sort().map(site => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ flex: 1, position: 'relative', minHeight: '150px' }}>
          <canvas id="chartPlanActual" className="dashboard-plan-actual-canvas"></canvas>
        </div>
      </section>

      {/* Timeline Section */}
      <div className="summary-grid__timeline">
        <TimelineChart 
          data={data}
          filters={filters}
          projectDates={projectDates}
        />
      </div>

      {/* Deviation Chart Section */}
      <div className="summary-grid__pie-dist">
        <section className="panel-card">
           <div className="panel-header dashboard-panel-header">
             <h3>مخطط أداء المواقع (الانحراف)</h3>
           </div>
           <div className="deviation-chart-container">
            <DeviationChart
                summary={summary}
                setFilter={setFilter}
              />
           </div>
        </section>
      </div>
    </section>
  );
}

function DetailsView({ data, filters, setFilter }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  const filteredData = data.filter(row =>
    Object.values(row).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  ).filter(r => {
    const siteMatch = !filters.site || String(r["الموقع"] || "") === String(filters.site);
    const phaseMatch = !filters.phase || String(r["المرحلة"] || "") === String(filters.phase);
    const itemMatch = !filters.item || String(r["البند الرئيسي"] || "") === String(filters.item);
    return siteMatch && phaseMatch && itemMatch;
  });

  if (sortKey) {
    filteredData.sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (typeof valA === "string" && typeof valB === "string") {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (typeof valA === "number" && typeof valB === "number") {
        return sortDir === 'asc' ? valA - valB : valB - valA;
      }
      return 0;
    });
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const headers = data.length > 0 ? Object.keys(data[0]) : [];
  
  const handleTableFilterChange = (filterKey, value) => {
    setFilter(filterKey, value);
  };

  const uniquePhases = [...new Set(data.map(d => d['المرحلة']))].sort();
  const uniqueItems = [...new Set(data.map(d => d['البند الرئيسي']))].sort();
  const uniqueSites = [...new Set(data.map(d => d['الموقع']))].sort();

  return (
    <section id="viewDetails" className="dashboard-details-view">
      <div className="panel-card table-wrap dashboard-table-card">
        <div className="table-controls dashboard-table-controls">
          <strong>التفاصيل</strong>
          <div className="table-filters dashboard-table-filters">
            <FilterSelect
              options={uniqueSites}
              value={filters.site}
              onChange={(e) => handleTableFilterChange('site', e.target.value)}
              label="كل المواقع"
            />
            <FilterSelect
              options={uniquePhases}
              value={filters.phase}
              onChange={(e) => handleTableFilterChange('phase', e.target.value)}
              label="كل المراحل"
            />
            <FilterSelect
              options={uniqueItems}
              value={filters.item}
              onChange={(e) => handleTableFilterChange('item', e.target.value)}
              label="كل البنود"
            />
            <button
              id="tableDetailsClearFilter"
              className="btn clear-btn dashboard-clear-button"
              type="button"
              style={{ display: (filters.site || filters.phase || filters.item) ? 'inline-block' : 'none' }}
              onClick={() => setFilter('clear')}
            >
              إزالة الفلتر
            </button>
            <input
              id="searchInput"
              className="dashboard-search-input"
              placeholder="ابحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="dashboard-table-scroll">
          <table id="dataTable">
            <thead id="tableHead">
              <tr>
                {headers.map(h => (
                  <th key={h} data-sort={h} onClick={() => handleSort(h)} className={sortKey === h ? sortDir : ''}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody id="tableBody">
              {filteredData.map((row, i) => (
                <tr key={i}>
                  {headers.map((h, j) => <td key={j}>{row[h]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div id="tableFooter" className="table-footer dashboard-table-footer">
          عرض {toArabicNumbers(String(filteredData.length))} من {toArabicNumbers(String(data.length))} سجل
        </div>
      </div>
    </section>
  );
}

function Home() {
  const [raw, setRaw] = useState({ detailed: [], summary: [], geo: [] });
  const [filtered, setFiltered] = useState({ detailed: [], summary: [], geo: [] });
  const [projectDates, setProjectDates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [filters, setFilters] = useState({ site: null, phase: null, item: null });
  const [lastUpdate, setLastUpdate] = useState('—');

  const fetchSheetsData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sheets?t=${Date.now()}`);
      if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return null;
      }
      return json.data || json;
    } catch (e) {
      setError(e.message);
      console.error('Fetch sheets failed:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const aggregateSummaryFromDetails = useCallback((detailedData) => {
    const map = detailedData.reduce((acc, r) => {
      const site = r['الموقع'] || r['SiteKey'] || 'غير محدد';
      acc[site] = acc[site] || {
        site,
        plan: [],
        actual: [],
        lat: r['Latitude'] || r['Lat'] || null,
        lng: r['Longitude'] || r['Lng'] || null,
      };
      acc[site].plan.push(normalizePercent(r['النسبة المخططة (%)'] || r['النسبة المخططة'] || 0));
      acc[site].actual.push(normalizePercent(r['النسبة الفعلية (%)'] || r['النسبة الفعلية'] || 0));
      return acc;
    }, {});
    
    return Object.values(map).map(v => ({
      'الموقع': v.site,
      'متوسط النسبة المخططة': avg(v.plan),
      'متوسط النسبة الفعلية': avg(v.actual),
      'Latitude': v.lat,
      'Longitude': v.lng,
    }));
  }, []);

  const applyFilters = useCallback(() => {
    if (!raw.detailed || raw.detailed.length === 0) {
      setFiltered({ detailed: [], summary: [], geo: [] });
      return;
    }
    const newFilteredDetailed = raw.detailed.filter(r => {
      const siteMatch = !filters.site || String(r["الموقع"] || "") === String(filters.site);
      const phaseMatch = !filters.phase || String(r["المرحلة"] || "") === String(filters.phase);
      const itemMatch = !filters.item || String(r["البند الرئيسي"] || "") === String(filters.item);
      return siteMatch && phaseMatch && itemMatch;
    });

    const newFilteredSummary = aggregateSummaryFromDetails(newFilteredDetailed);
    const newFilteredGeo = newFilteredSummary.filter(s => s.Latitude != null && s.Longitude != null);

    setFiltered({
      detailed: newFilteredDetailed,
      summary: newFilteredSummary,
      geo: newFilteredGeo
    });
  }, [raw, filters, aggregateSummaryFromDetails]);

  const setFilter = useCallback((key, value) => {
    if (key === 'clear') {
      setFilters({ site: null, phase: null, item: null });
    } else {
      setFilters(prev => ({ ...prev, [key]: value }));
    }
  }, []);

  const hydrateData = useCallback((data) => {
    if (!data) {
        setRaw({ detailed: [], summary: [], geo: [] });
        return;
    };
    const detailed = (data.detailed || data.data?.detailed || [])
      .filter(row => row && row["الموقع"] && String(row["الموقع"]).trim() !== "");
    const summary = (data.summary || data.data?.summary || [])
      .filter(row => row && row["الموقع"] && String(row["الموقع"]).trim() !== "");
    const geo = (data.geo || data.data?.geo || [])
      .filter(row => row && row["الموقع"] && String(row["الموقع"]).trim() !== "");
    
    setRaw({ detailed, summary, geo });
    setProjectDates(data.projectDates ?? null);
    setLastUpdate(new Date().toLocaleString('ar-SA'));
  }, []);

  const handleRefresh = useCallback(async () => {
    const data = await fetchSheetsData();
    hydrateData(data);
  }, [fetchSheetsData, hydrateData]);

  useEffect(() => {
    handleRefresh();
    const intervalId = setInterval(handleRefresh, 10800000); // 3 hours
    return () => clearInterval(intervalId);
  }, [handleRefresh]);

  useEffect(() => {
    applyFilters();
  }, [raw, filters, applyFilters]);

  useEffect(() => {
    document.body.classList.add("light");
  }, []);
  
  const detailedDataForViews = raw.detailed || [];
  const uniqueSites = [...new Set(detailedDataForViews.map(d => d['الموقع']))].sort();
  const allPhases = [...new Set(detailedDataForViews.map(d => d['المرحلة']))];
  const phaseOrder = [
    "المرحلة الأولى",
    "المرحلة الثانية",
    "المرحلة الثالثة",
    "المرحلة الرابعة",
    "المرحلة الخامسة"
    // يمكنك إضافة المزيد من المراحل هنا بنفس الترتيب الصحيح إذا وجدت
  ];
  const uniquePhases = allPhases.sort((a, b) => {
    const indexA = phaseOrder.indexOf(a);
    const indexB = phaseOrder.indexOf(b);
    if (indexA === -1) return 1; // وضع المراحل غير المعروفة في النهاية
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  const uniqueItems = [...new Set(detailedDataForViews.map(d => d['البند الرئيسي']))].sort();

  return (
    <>
      <Head>
        <title>تنفيذ الهوية على مباني الهيئة</title>
        <link rel="icon" href="/images/icon.ico" />
        <link rel="shortcut icon" href="/images/icon.ico" />
      </Head>

      <div className="dashboard-shell">
        <header className="dashboard-header">
          <img src="/images/HRC_logo.png" alt="شعار الهيئة" className="logo logo-right" />
          <div className="header-titles dashboard-header-titles">
            <h1 className="main-title">تنفيذ الهوية على مباني الهيئة</h1>
            <div className="subtitle dashboard-subtitle">تَغَيَّرَت هُوِيَّتُنَا وَقِيَمُنَا ثَابِتَةٌ</div>
          </div>
          <img src="/images/Sawaedna_Logo.png" alt="شعار سواعدنا" className="logo logo-left" />
        </header>

        <section className="dashboard-controls-bar">
          <div className="tabs dashboard-tabs">
            <div
              className={`tab dashboard-tab ${activeTab === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveTab('summary')}
            >
              الملخص
            </div>
            <div
              className={`tab dashboard-tab ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              التفاصيل
            </div>
          </div>
          <div className="filter-group dashboard-filter-group">
            <FilterSelect
              options={uniqueSites}
              value={filters.site}
              onChange={(e) => setFilter('site', e.target.value)}
              label="كل المواقع"
              id="siteFilter"
            />
            <FilterSelect
              options={uniquePhases}
              value={filters.phase}
              onChange={(e) => setFilter('phase', e.target.value)}
              label="كل المراحل"
              id="phaseFilter"
            />
            <FilterSelect
              options={uniqueItems}
              value={filters.item}
              onChange={(e) => setFilter('item', e.target.value)}
              label="كل البنود الرئيسية"
              id="itemFilter"
            />
            <button
              id="clearFilter"
              className="btn clear-btn dashboard-clear-button"
              type="button"
              style={{ display: (filters.site || filters.phase || filters.item) ? 'inline-block' : 'none' }}
              onClick={() => setFilter('clear')}
            >
              إزالة الفلتر
            </button>
          </div>
          <div className="dashboard-nav-controls">
            <div id="lastUpdate" className="lastUpdate dashboard-last-update">آخر تحديث: {lastUpdate}</div>
            <button
              id="refreshBtn"
              onClick={handleRefresh}
              className="btn refresh-btn"
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              {loading ? 'جاري التحديث...' : 'تحديث الآن'}
            </button>
          </div>
        </section>

        {error && (
          <div className="dashboard-error-message">حدث خطأ: {error}</div>
        )}
        
        <main className="dashboard-main">
          {loading ? (
             <div id="loader" className="loader dashboard-loader" style={{ display: 'flex' }}>
                <div className="spinner dashboard-spinner"></div>
             </div>
          ) : (
            <>
              <div style={{ display: activeTab === 'summary' ? 'grid' : 'none', height: '100%' }}>
                <SummaryView
                  data={detailedDataForViews}
                  summary={filtered.summary}
                  geo={filtered.geo}
                  filters={filters}
                  setFilter={setFilter}
                  projectDates={projectDates}
                />
              </div>
              <div style={{ display: activeTab === 'details' ? 'grid' : 'none', height: '100%' }}>
                {detailedDataForViews.length > 0 ? (
                  <DetailsView
                    data={detailedDataForViews}
                    filters={filters}
                    setFilter={setFilter}
                  />
                ) : (
                  <div className='panel-card'>لا توجد بيانات تفصيلية لعرضها.</div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

export default Home;
