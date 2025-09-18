import Head from 'next/head';
import dynamic from 'next/dynamic';
const Script = dynamic(() => import('next/script'), {
  ssr: false
});

export default function Home() {
  return (
    <>
      <Head>
        <title>تنفيذ الهوية على مباني الهيئة</title>
        <link rel="icon" href="/images/icon.ico" />
        <link rel="shortcut icon" href="/images/icon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Script src="https://cdn.jsdelivr.net/npm/dayjs@1/dayjs.min.js" strategy="beforeInteractive" />
      <Script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.0.0" strategy="beforeInteractive" />
      <Script src="/js/app.js" strategy="afterInteractive" />

      <div className="container">
        <div className="topbar">
          <img src="/images/HRC_logo.png" alt="HRC Logo" className="logo logo-right" />
          <div className="header-titles">
            <h1 className="main-title">تنفيذ الهوية على مباني الهيئة</h1>
            <div className="subtitle">تَغَيَّرَتْ هُوِّيَتُنَا وَقِيَمُنَا ثَابِتَةٌ</div>
          </div>
          <img src="/images/Sawaedna_Logo.png" alt="Sawaedna Logo" className="logo logo-left" />
        </div>

        <div className="nav-bar">
          <div className="tabs">
            <div className="tab active" data-tab="summary">الملخص</div>
            <div className="tab" data-tab="details">التفاصيل</div>
          </div>
          <div className="nav-controls">
            <div id="lastUpdate" className="lastUpdate">آخر تحديث: —</div>
            <button id="refreshBtn" className="btn refresh-btn"><i className="fas fa-sync-alt"></i> تحديث الآن</button>
            <button id="themeBtn" className="btn">🌓</button>
          </div>
        </div>
      </div>

      <div className="right-aligned-content">
        <div id="viewSummary">

          <div className="filters" style={{ marginTop: '12px' }}>
            <div className="filter-group">
              <select id="siteFilter" className="select"><option value="">كل المواقع</option></select>
              <select id="phaseFilter" className="select"><option value="">كل المراحل</option></select>
              <select id="itemFilter" className="select"><option value="">كل البنود الرئيسية</option></select>
              <button id="clearFilter" className="btn clear-btn" style={{ display: 'none', marginRight: '8px', padding: '6px 10px', background: 'var(--danger)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer' }}>🔄 إزالة الفلتر</button>
            </div>
          </div>

          <div id="kpiArea" className="grid" style={{ marginBottom: '12px' }}></div>

          <div className="grid" style={{ marginBottom: '12px' }}>
            <div className="panel card" style={{ position: 'relative' }}>
              <div className="panel-header">
                <h3>مخطط/فعلي</h3>
                <div className="chart-filter">
                  <select id="chartSiteFilter" className="select" style={{ fontSize: '12px', padding: '4px 6px' }}><option value="">كل المواقع</option></select>
                </div>
              </div>
              <canvas id="chartPlanActual" style={{ height: '320px' }}></canvas>
            </div>
            <div className="panel card" style={{ position: 'relative' }}>
              <div className="panel-header">
                <h3>المواقع</h3>
                <div className="map-filter">
                  <select id="mapSiteFilter" className="select" style={{ fontSize: '12px', padding: '4px 6px' }}><option value="">كل المواقع</option></select>
                </div>
              </div>
              <div id="map" style={{ height: '320px', borderRadius: '8px' }}></div>
            </div>
          </div>

          <div className="card full">
            <div className="chart-header">
              <h3 id="performanceTitle">أداء المواقع</h3>
              <button id="performanceClearFilter" className="btn clear-btn" style={{ display: 'none' }}>🔄 إزالة الفلتر</button>
            </div>
            <div id="donutArea" className="donuts"></div>
            <div id="gaugeArea" style={{ display: 'none', textAlign: 'center', padding: '20px' }}></div>
          </div>

        </div>

        <div id="viewDetails" style={{ display: 'none' }}>
          <div className="table-wrap card" style={{ marginTop: '12px' }}>
            <div className="table-controls">
              <strong>التفاصيل</strong>
              <div className="table-filters">
                <select id="tableSiteFilter" className="select" style={{ fontSize: '12px' }}><option value="">كل المواقع</option></select>
                <select id="tablePhaseFilter" className="select" style={{ fontSize: '12px' }}><option value="">كل المراحل</option></select>
                <select id="tableItemFilter" className="select" style={{ fontSize: '12px' }}><option value="">كل البنود</option></select>
                <button id="tableDetailsClearFilter" className="btn clear-btn" style={{ display: 'none', marginRight: '8px', padding: '6px 10px', background: 'var(--danger)', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer' }}>🔄 إزالة الفلتر</button>
                <input id="searchInput" placeholder="ابحث..." style={{ padding: '8px', borderRadius: '8px', background: 'var(--card)', color: 'var(--text)', border: '1px solid var(--glass)' }} />
              </div>
            </div>
            <div style={{ overflow: 'auto' }}>
              <table id="dataTable">
                <thead id="tableHead"></thead>
                <tbody id="tableBody"></tbody>
              </table>
            </div>
            <div id="tableFooter" className="table-footer"></div>
          </div>
        </div>
      </div>
      <div id="loader" className="loader" style={{ display: 'none' }}><div className="spinner"></div></div>
    </>
  );
}