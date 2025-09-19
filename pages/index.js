import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';

const Script = dynamic(() => import('next/script'), {
  ssr: false
});

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState('—');
  
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/sheets`);
      const json = await res.json();
      
      if (json.error) {
        setError(json.error);
        console.error('API Error:', json.error);
        return;
      }
      
      // Update the data in the window object for the app.js to use
      window.dashboardData = json.data;
      
      // Trigger the update function if it exists
      if (window.updateDashboard) {
        window.updateDashboard();
      }

      setLastUpdate(new Date().toLocaleString('ar-SA'));
    } catch (e) {
      setError(e.message);
      console.error('Failed to fetch data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchData();
  }, []);
  return (
    <>
      <Head>
        <title>تنفيذ الهوية على مباني الهيئة</title>
        <link rel="icon" href="/images/icon.ico" />
        <link rel="shortcut icon" href="/images/icon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js" strategy="beforeInteractive" />
      <Script src="/js/app.js" strategy="afterInteractive" />

      <div className="container dashboard-container">
        <div className="topbar dashboard-topbar">
          <img src="/images/HRC_logo.png" alt="HRC Logo" className="logo logo-right" />
          <div className="header-titles dashboard-header-titles">
            <h1 className="main-title">تنفيذ الهوية على مباني الهيئة</h1>
            <div className="subtitle dashboard-subtitle">تَغَيَّرَتْ هُوِّيَتُنَا وَقِيَمُنَا ثَابِتَةٌ</div>
          </div>
          <img src="/images/Sawaedna_Logo.png" alt="Sawaedna Logo" className="logo logo-left" />
        </div>

        <div className="nav-bar dashboard-navbar">
          <div className="tabs dashboard-tabs">
            <div className="tab dashboard-tab active" data-tab="summary">الملخص</div>
            <div className="tab dashboard-tab" data-tab="details">التفاصيل</div>
          </div>
          <div className="nav-controls dashboard-nav-controls">
            <div id="lastUpdate" className="lastUpdate dashboard-last-update">آخر تحديث: {lastUpdate}</div>
            <button
              id="refreshBtn"
              onClick={fetchData}
              className="btn refresh-btn"
              disabled={loading}
            >
              <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
              {loading ? 'جاري التحديث...' : 'تحديث الآن'}
            </button>
            <button id="themeBtn" className="btn">🌓</button>
          </div>
        </div>
        {error && (
          <div className="dashboard-error-message">{error}</div>
        )}
      </div>

      <div className="right-aligned-content dashboard-content">
        <div id="viewSummary" className="dashboard-summary-view">
          <div className="filters dashboard-filters">
            <div className="filter-group dashboard-filter-group">
              <select id="siteFilter" className="select"><option value="">كل المواقع</option></select>
              <select id="phaseFilter" className="select"><option value="">كل المراحل</option></select>
              <select id="itemFilter" className="select"><option value="">كل البنود الرئيسية</option></select>
              <button id="clearFilter" className="btn clear-btn dashboard-clear-button">🔄 إزالة الفلتر</button>
              <div id="kpiArea" className="grid dashboard-kpi-area"></div>
            </div>
          </div>

          <div className="paneeel dashboard-panel-layout">
            <div className="panel card dashboard-plan-actual-panel">
              <div className="panel-header dashboard-panel-header">
                <h3>مخطط/فعلي</h3>
                <div className="chart-filter dashboard-chart-filter">
                  <select id="chartSiteFilter" className="select dashboard-chart-site-filter"><option value="">كل المواقع</option></select>
                </div>
              </div>
              <canvas id="chartPlanActual" className="dashboard-plan-actual-canvas"></canvas>
            </div>
            <div className="panel mapo dashboard-map-panel">
              <div className="panel-header dashboard-panel-header">
                <h3>المواقع</h3>
                <div className="map-filter dashboard-map-filter">
                  <select id="mapSiteFilter" className="select dashboard-map-site-filter"><option value="">كل المواقع</option></select>
                </div>
              </div>
              <div id="map" className="dashboard-map"></div>
            </div>
          </div>

          <div className="card full dashboard-performance-card">
            <div className="chart-header dashboard-performance-header">
              <h3 id="performanceTitle">أداء المواقع</h3>
              <button id="performanceClearFilter" className="btn clear-btn dashboard-clear-button">🔄 إزالة الفلتر</button>
            </div>
            <div id="donutArea" className="donuts dashboard-donut-area"></div>
            <div id="gaugeArea" className="dashboard-gauge-area"></div>
          </div>

        </div>

        <div id="viewDetails" className="dashboard-details-view">
          <div className="table-wrap card dashboard-table-card">
            <div className="table-controls dashboard-table-controls">
              <strong>التفاصيل</strong>
              <div className="table-filters dashboard-table-filters">
                <select id="tableSiteFilter" className="select dashboard-table-select"><option value="">كل المواقع</option></select>
                <select id="tablePhaseFilter" className="select dashboard-table-select"><option value="">كل المراحل</option></select>
                <select id="tableItemFilter" className="select dashboard-table-select"><option value="">كل البنود</option></select>
                <button id="tableDetailsClearFilter" className="btn clear-btn dashboard-clear-button">🔄 إزالة الفلتر</button>
                <input id="searchInput" className="dashboard-search-input" placeholder="ابحث..." />
              </div>
            </div>
            <div className="dashboard-table-scroll">
              <table id="dataTable">
                <thead id="tableHead"></thead>
                <tbody id="tableBody"></tbody>
              </table>
            </div>
            <div id="tableFooter" className="table-footer dashboard-table-footer"></div>
          </div>
        </div>
      </div>
      <div id="loader" className="loader dashboard-loader"><div className="spinner dashboard-spinner"></div></div>
    </>
  );
}