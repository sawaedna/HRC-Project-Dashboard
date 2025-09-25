// src/component/TimelineChart.js

import React, { useEffect, useRef, useCallback } from 'react';

function TimelineChart({ data, filters, projectDates }) {
  const chartRef = useRef(null);
  const timelineChartRef = useRef(null);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;
  const ChartDataLabels = isClient ? window.ChartDataLabels : null;

  useEffect(() => {
    if (Chart && ChartDataLabels) {
      try { 
        Chart.register(ChartDataLabels); 
      } catch (e) { /* Already registered */ }
    }
  }, [Chart, ChartDataLabels]);

  const createTimelineChart = useCallback(() => {
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx || !isClient || !Chart || !data?.length) return;
    
    if (timelineChartRef.current) {
      timelineChartRef.current.destroy();
    }

    // Process data to create timeline points
    const processedData = data
      .filter(row => row['تاريخ البداية'] && row['تاريخ النهاية'])
      .map(row => {
        const startDate = new Date(row['تاريخ البداية']);
        const endDate = new Date(row['تاريخ النهاية']);
        const now = new Date();
        
        const totalDuration = endDate - startDate;
        const elapsed = Math.min(now - startDate, totalDuration);
        const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
        
        const plannedPercent = parseFloat(String(row['النسبة المخططة (%)']).replace('%', '')) || 0;
        const actualPercent = parseFloat(String(row['النسبة الفعلية (%)']).replace('%', '')) || 0;
        
        return {
          site: row['الموقع'] || 'غير محدد',
          phase: row['المرحلة'] || 'غير محدد',
          item: row['البند الرئيسي'] || 'غير محدد',
          progress: progress * 100,
          plannedPercent,
          actualPercent,
          startDate,
          endDate,
          daysElapsed: Math.ceil(elapsed / (1000 * 60 * 60 * 24)),
          totalDays: Math.ceil(totalDuration / (1000 * 60 * 60 * 24))
        };
      });

    // Apply filters
    const filteredData = processedData.filter(item => {
      const siteMatch = !filters.site || item.site === filters.site;
      const phaseMatch = !filters.phase || item.phase === filters.phase;
      const itemMatch = !filters.item || item.item === filters.item;
      return siteMatch && phaseMatch && itemMatch;
    });

    // Group by site and calculate averages
    const siteData = {};
    filteredData.forEach(item => {
      if (!siteData[item.site]) {
        siteData[item.site] = {
          progress: [],
          planned: [],
          actual: [],
          totalDays: [],
          daysElapsed: []
        };
      }
      siteData[item.site].progress.push(item.progress);
      siteData[item.site].planned.push(item.plannedPercent);
      siteData[item.site].actual.push(item.actualPercent);
      siteData[item.site].totalDays.push(item.totalDays);
      siteData[item.site].daysElapsed.push(item.daysElapsed);
    });

    const labels = Object.keys(siteData);
    const timeProgress = labels.map(site => {
      const arr = siteData[site].progress;
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });
    const plannedProgress = labels.map(site => {
      const arr = siteData[site].planned;
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });
    const actualProgress = labels.map(site => {
      const arr = siteData[site].actual;
      return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    });

    const chartConfig = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'التقدم الزمني %',
            data: timeProgress,
            borderColor: 'rgba(139, 92, 246, 0.8)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: 'rgba(139, 92, 246, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
          },
          {
            label: 'المخطط %',
            data: plannedProgress,
            borderColor: 'rgba(37, 99, 235, 0.8)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: 'rgba(37, 99, 235, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          },
          {
            label: 'الفعلي %',
            data: actualProgress,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: 'rgba(34, 197, 94, 1)',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 4,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 11,
                family: 'Cairo'
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1f2937',
            bodyColor: '#374151',
            borderColor: '#e5e7eb',
            borderWidth: 1,
            cornerRadius: 8,
            titleFont: {
              size: 12,
              family: 'Cairo'
            },
            bodyFont: {
              size: 11,
              family: 'Cairo'
            },
            callbacks: {
              title: function(tooltipItems) {
                return `الموقع: ${tooltipItems[0].label}`;
              },
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.y.toFixed(1)}%`;
              }
            }
          },
          datalabels: {
            display: false
          }
        },
        scales: {
          x: {
            grid: {
              display: true,
              color: 'rgba(156, 163, 175, 0.2)'
            },
            ticks: {
              font: {
                size: 10,
                family: 'Cairo'
              },
              maxRotation: 45
            }
          },
          y: {
            beginAtZero: true,
            max: 100,
            grid: {
              display: true,
              color: 'rgba(156, 163, 175, 0.2)'
            },
            ticks: {
              font: {
                size: 10,
                family: 'Cairo'
              },
              callback: function(value) {
                return value + '%';
              }
            }
          }
        },
        elements: {
          point: {
            hoverRadius: 8
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    };

    timelineChartRef.current = new Chart(ctx, chartConfig);
  }, [data, filters, Chart, isClient]);

  useEffect(() => {
    if (Chart) {
      createTimelineChart();
    }
    
    return () => {
      if (timelineChartRef.current) {
        timelineChartRef.current.destroy();
      }
    };
  }, [Chart, createTimelineChart]);

  // Update charts when theme changes
  useEffect(() => {
    const updateChart = () => {
      if (timelineChartRef.current) {
        timelineChartRef.current.update('none');
      }
    };

    const observer = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          updateChart();
        }
      }
    });

    observer.observe(document.body, { attributes: true });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div className="timeline-panel">
      <div className="dashboard-panel-header">
        <h3>التقدم الزمني مقابل الإنجاز</h3>
        <div className="timeline-info" style={{ fontSize: '10px', color: 'var(--muted)' }}>
          {projectDates && (
            <span>
              المدة: {projectDates.totalDays} يوم | 
              المنقضي: {projectDates.elapsed} | 
              المتبقي: {projectDates.remaining}
            </span>
          )}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '150px' }}>
        <canvas ref={chartRef} className="timeline-canvas"></canvas>
      </div>
    </div>
  );
}

export default TimelineChart;