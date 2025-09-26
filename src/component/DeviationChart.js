import React, { useEffect, useRef, useCallback } from 'react';
import { normalizePercent } from '../utils/data';

function DeviationChart({ summary = [], setFilter }) {
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);
  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;

  const createChart = useCallback(() => {
    const ctx = chartRef.current?.getContext('2d');
    if (!ctx || !Chart || !summary?.length) return;

    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const sortedSummary = [...summary].sort((a, b) => {
        const devA = normalizePercent(a['متوسط النسبة الفعلية']) - normalizePercent(a['متوسط النسبة المخططة']);
        const devB = normalizePercent(b['متوسط النسبة الفعلية']) - normalizePercent(b['متوسط النسبة المخططة']);
        return devB - devA;
    });

    const labels = sortedSummary.map(s => s['الموقع']);
    const deviationData = sortedSummary.map(s => {
      const actual = normalizePercent(s['متوسط النسبة الفعلية']);
      const planned = normalizePercent(s['متوسط النسبة المخططة']);
      return (actual - planned) * 100;
    });

    const backgroundColors = deviationData.map(d => d >= 0 ? 'rgba(34, 197, 94, 0.85)' : 'rgba(239, 68, 68, 0.85)');
    const borderColors = deviationData.map(d => d >= 0 ? 'rgba(34, 197, 94, 1)' : 'rgba(239, 68, 68, 1)');


    chartInstanceRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'الانحراف',
          data: deviationData,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 1,
        }]
      },
      options: {
        indexAxis: 'y', // This makes the bar chart horizontal
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.x !== null) {
                  label += context.parsed.x.toFixed(2) + '%';
                }
                return label;
              }
            }
          },
           datalabels: {
             display: false,
           }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'نسبة الانحراف (%)'
            },
            ticks: {
              font: { size: 9 }
            }
          },
          y: {
            ticks: {
              font: { size: 9 }
            }
          }
        },
        onClick: (evt, elements) => {
          if (!elements.length) return;
          const idx = elements[0].index;
          const site = labels[idx];
          setFilter('site', site);
        },
      }
    });

  }, [summary, Chart, setFilter]);

  useEffect(() => {
    if (Chart) {
      createChart();
    }

    const debounce = (func, delay) => {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
      };
    };

    const handleResize = debounce(createChart, 200);

    window.addEventListener('resize', handleResize);

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
      window.removeEventListener('resize', handleResize);
    };
  }, [Chart, createChart]);

  return (
    <div className="chart-canvas-wrapper">
      <canvas ref={chartRef}></canvas>
    </div>
  );
}

export default DeviationChart;