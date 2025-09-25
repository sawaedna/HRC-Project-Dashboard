// src/component/ProgressRings.js

import React, { useEffect, useRef, useCallback } from 'react';

function ProgressRings({ data, filters }) {
  const containerRef = useRef(null);
  const chartsRef = useRef([]);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;

  const createProgressRings = useCallback(() => {
    if (!Chart || !data?.length || !containerRef.current) return;
    
    // Destroy existing charts
    chartsRef.current.forEach(chart => chart.destroy());
    chartsRef.current = [];
    containerRef.current.innerHTML = '';

    // Process data to get summary by site
    const siteData = {};
    data.filter(r => {
      const siteMatch = !filters.site || String(r["الموقع"] || "") === String(filters.site);
      const phaseMatch = !filters.phase || String(r["المرحلة"] || "") === String(filters.phase);
      const itemMatch = !filters.item || String(r["البند الرئيسي"] || "") === String(filters.item);
      return siteMatch && phaseMatch && itemMatch;
    }).forEach(item => {
      const site = item['الموقع'] || 'غير محدد';
      if (!siteData[site]) {
        siteData[site] = { planned: [], actual: [] };
      }
      const planned = parseFloat(String(item['النسبة المخططة (%)']).replace('%', '')) || 0;
      const actual = parseFloat(String(item['النسبة الفعلية (%)']).replace('%', '')) || 0;
      siteData[site].planned.push(planned);
      siteData[site].actual.push(actual);
    });

    const sites = Object.keys(siteData).slice(0, 6); // Limit to 6 sites for space

    sites.forEach((site, index) => {
      const planned = siteData[site].planned;
      const actual = siteData[site].actual;
      const avgPlanned = planned.length > 0 ? planned.reduce((a, b) => a + b, 0) / planned.length : 0;
      const avgActual = actual.length > 0 ? actual.reduce((a, b) => a + b, 0) / actual.length : 0;
      const efficiency = avgPlanned > 0 ? (avgActual / avgPlanned * 100) : 0;

      // Create ring element
      const ringEl = document.createElement('div');
      ringEl.className = 'progress-ring-item';
      ringEl.innerHTML = `
        <div class="ring-header">
          <h4>${site}</h4>
        </div>
        <div class="ring-chart-container">
          <canvas id="progressRing-${index}"></canvas>
        </div>
        <div class="ring-stats">
          <div class="ring-stat">
            <span class="ring-label">الفعلي</span>
            <span class="ring-value" style="color: var(--success)">${avgActual.toFixed(1)}%</span>
          </div>
          <div class="ring-stat">
            <span class="ring-label">المخطط</span>
            <span class="ring-value" style="color: var(--chart-planned)">${avgPlanned.toFixed(1)}%</span>
          </div>
          <div class="ring-stat">
            <span class="ring-label">الكفاءة</span>
            <span class="ring-value" style="color: ${efficiency >= 100 ? 'var(--success)' : efficiency >= 80 ? '#f59e0b' : 'var(--danger)'}">${efficiency.toFixed(0)}%</span>
          </div>
        </div>
      `;
      containerRef.current.appendChild(ringEl);

      // Create chart
      const ctx = document.getElementById(`progressRing-${index}`)?.getContext('2d');
      if (!ctx) return;

      const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              label: 'التقدم',
              data: [avgActual, Math.max(0, 100 - avgActual)],
              backgroundColor: [
                efficiency >= 100 ? 'rgba(34, 197, 94, 0.8)' : 
                efficiency >= 80 ? 'rgba(245, 158, 11, 0.8)' : 
                'rgba(239, 68, 68, 0.8)',
                'rgba(229, 231, 235, 0.3)'
              ],
              borderWidth: 0,
              cutout: '75%',
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function(context) {
                  if (context.dataIndex === 0) {
                    return `التقدم الفعلي: ${context.parsed}%`;
                  }
                  return '';
                }
              }
            }
          },
          animation: {
            animateRotate: true,
            duration: 1500,
            easing: 'easeInOutQuart'
          }
        },
        plugins: [{
          afterDraw: function(chart) {
            const ctx = chart.ctx;
            const centerX = chart.width / 2;
            const centerY = chart.height / 2;
            
            ctx.save();
            ctx.font = 'bold 16px Cairo, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = efficiency >= 100 ? '#22c55e' : efficiency >= 80 ? '#f59e0b' : '#ef4444';
            ctx.fillText(`${avgActual.toFixed(0)}%`, centerX, centerY);
            ctx.restore();
          }
        }]
      });

      chartsRef.current.push(chart);
    });
  }, [data, filters, Chart]);

  useEffect(() => {
    if (Chart) {
      createProgressRings();
    }
    
    return () => {
      chartsRef.current.forEach(chart => chart.destroy());
    };
  }, [Chart, createProgressRings]);

  return (
    <div className="progress-rings-panel">
      <div className="dashboard-panel-header">
        <h3>حلقات التقدم للمواقع</h3>
      </div>
      <div ref={containerRef} className="progress-rings-container"></div>
    </div>
  );
}

export default ProgressRings;