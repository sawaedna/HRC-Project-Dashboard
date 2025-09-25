// src/component/RadarChart.js

import React, { useEffect, useRef, useCallback } from 'react';

function RadarChart({ data, filters }) {
  const chartRef = useRef(null);
  const radarChartRef = useRef(null);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;

  useEffect(() => {
    if (Chart) {
      try { 
        Chart.register(Chart.RadarController, Chart.RadialLinearScale, Chart.PointElement, Chart.LineElement);
      } catch (e) { /* Already registered */ }
    }
  }, [Chart]);

  const createRadarChart = useCallback(() => {
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx || !isClient || !Chart || !data?.length) return;
    
    if (radarChartRef.current) {
      radarChartRef.current.destroy();
    }

    // Process data for radar chart
    const filteredData = data.filter(r => {
      const siteMatch = !filters.site || String(r["الموقع"] || "") === String(filters.site);
      const phaseMatch = !filters.phase || String(r["المرحلة"] || "") === String(filters.phase);
      const itemMatch = !filters.item || String(r["البند الرئيسي"] || "") === String(filters.item);
      return siteMatch && phaseMatch && itemMatch;
    });

    // Group by phases and calculate averages
    const phaseData = {};
    filteredData.forEach(item => {
      const phase = item['المرحلة'] || 'غير محدد';
      if (!phaseData[phase]) {
        phaseData[phase] = { planned: [], actual: [] };
      }
      const planned = parseFloat(String(item['النسبة المخططة (%)']).replace('%', '')) || 0;
      const actual = parseFloat(String(item['النسبة الفعلية (%)']).replace('%', '')) || 0;
      phaseData[phase].planned.push(planned);
      phaseData[phase].actual.push(actual);
    });

    const labels = Object.keys(phaseData);
    const plannedData = labels.map(phase => {
      const arr = phaseData[phase].planned;
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });
    const actualData = labels.map(phase => {
      const arr = phaseData[phase].actual;
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });

    const chartConfig = {
      type: 'radar',
      data: {
        labels,
        datasets: [
          {
            label: 'المخطط %',
            data: plannedData,
            borderColor: 'rgba(37, 99, 235, 0.8)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(37, 99, 235, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'الفعلي %',
            data: actualData,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(34, 197, 94, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          }
        ]
      },
      options: {
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              font: { size: 11, family: 'Cairo' },
              usePointStyle: true,
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1f2937',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              title: function(tooltipItems) {
                return `المرحلة: ${tooltipItems[0].label}`;
              },
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.r.toFixed(1)}%`;
              }
            }
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              font: { size: 9, family: 'Cairo' },
              callback: function(value) {
                return value + '%';
              },
              stepSize: 20
            },
            grid: {
              color: 'rgba(156, 163, 175, 0.3)'
            },
            angleLines: {
              color: 'rgba(156, 163, 175, 0.2)'
            },
            pointLabels: {
              font: { size: 10, family: 'Cairo' }
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 6
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    };

    radarChartRef.current = new Chart(ctx, chartConfig);
  }, [data, filters, Chart, isClient]);

  useEffect(() => {
    if (Chart) {
      createRadarChart();
    }
    
    return () => {
      if (radarChartRef.current) {
        radarChartRef.current.destroy();
      }
    };
  }, [Chart, createRadarChart]);

  return (
    <div className="radar-panel">
      <div className="dashboard-panel-header">
        <h3>مقارنة الأداء حسب المراحل</h3>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
        <canvas ref={chartRef} className="radar-canvas"></canvas>
      </div>
    </div>
  );
}

export default RadarChart;