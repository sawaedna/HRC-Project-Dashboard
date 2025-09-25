// src/component/GlobalGauges.js
import React, { useEffect, useRef, useCallback } from 'react';

// بلجن محلي لكتابة نسبة خارج القوس (بين القوس والعنوان)
const externalGaugeLabelPlugin = {
  id: 'externalGaugeLabel',
  afterDraw(chart) {
    const cfg = chart.options?.plugins?.externalGaugeLabel;
    if (!cfg || !cfg.text) return;

    const { ctx, chartArea, canvas } = chart;
    ctx.save();
    ctx.font = cfg.font || 'bold 13px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const color =
      cfg.color ||
      (typeof window !== 'undefined'
        ? getComputedStyle(canvas).color
        : '#111');
    ctx.fillStyle = color;

    const x = (chartArea.left + chartArea.right) / 2;
    const y = chartArea.bottom - (cfg.offsetY ?? 8); // موضع بين القوس والعنوان

    if (cfg.strokeStyle) {
      ctx.strokeStyle = cfg.strokeStyle;
      ctx.lineWidth = cfg.strokeWidth ?? 2;
      ctx.strokeText(cfg.text, x, y);
    }
    ctx.fillText(cfg.text, x, y);
    ctx.restore();
  },
};

function GlobalGauges({ avgPlan, avgActual, avgDeviation }) {
  const gaugePlanRef = useRef(null);
  const gaugeActualRef = useRef(null);
  const gaugeDeviationRef = useRef(null);

  const gaugePlanChartRef = useRef(null);
  const gaugeActualChartRef = useRef(null);
  const gaugeDeviationChartRef = useRef(null);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;
  const ChartDataLabels = isClient ? window.ChartDataLabels : null;

  // تسجيل datalabels فقط (لو متاح)
  useEffect(() => {
    if (!Chart) return;
    try {
      if (ChartDataLabels) Chart.register(ChartDataLabels);
    } catch (_) {}
  }, [Chart, ChartDataLabels]);

  const createGauge = useCallback(
    (canvasRef, chartRef, value, label, colorVar) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx || !Chart) return;

      if (chartRef.current) chartRef.current.destroy();

      const color = getComputedStyle(document.documentElement)
        .getPropertyValue(colorVar)
        .trim();

      const isDeviation = label.includes('الانحراف');
      const total = isDeviation ? 50 : 100;
      const valPct = isDeviation ? Math.abs(value * 100) : value * 100;
      const percentage = Math.max(0, Math.min(total, valPct));
      const chartData = [percentage, total - percentage];

      const displayValue = Math.abs(value * 100).toFixed(1);

      chartRef.current = new Chart(ctx, {
        type: 'doughnut',
        data: {
          datasets: [
            {
              data: chartData,
              backgroundColor: [color, 'var(--chart-background)'],
              borderWidth: 0,
              circumference: 180,
              rotation: 270,
              cutout: '75%',
            },
          ],
        },
        // البلجن المحلي يعمل فقط على هذه الجوجات
        plugins: [externalGaugeLabelPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            datalabels: { display: false },
            // تعطيل أي Tangent Labels على الجوج
            tangentArcLabels: { formatter: () => '' },
            // اللابل الخارجي (النسبة)
            externalGaugeLabel: {
              text: `${displayValue}%`,
              font: 'bold 13px Cairo, sans-serif',
              // color: '#111',        // يمكنك تعيين لون ثابت لو أردت
              // strokeStyle: '#fff',  // حد خارجي اختياري
              // strokeWidth: 2,
              offsetY: 8,
            },
          },
        },
      });
    },
    [Chart, isClient]
  );

  // إنشاء/تحديث الجوجات
  useEffect(() => {
    if (!Chart) return;
    createGauge(gaugePlanRef, gaugePlanChartRef, avgPlan, 'المخطط', '--chart-planned');
    createGauge(gaugeActualRef, gaugeActualChartRef, avgActual, 'الفعلي', '--accent2');
    createGauge(
      gaugeDeviationRef,
      gaugeDeviationChartRef,
      avgDeviation,
      'الانحراف',
      avgDeviation >= 0 ? '--success' : '--danger'
    );
  }, [avgPlan, avgActual, avgDeviation, Chart, createGauge]);

  // تحديث الألوان عند تغيير الثيم
  useEffect(() => {
    const updateAllCharts = () => {
      [gaugePlanChartRef, gaugeActualChartRef, gaugeDeviationChartRef].forEach((ref) => {
        if (ref.current) ref.current.update('none');
      });
    };
    const observer = new MutationObserver((mutationsList) => {
      for (const m of mutationsList) {
        if (m.type === 'attributes' && m.attributeName === 'class') {
          updateAllCharts();
        }
      }
    });
    if (isClient) observer.observe(document.body, { attributes: true });
    return () => observer.disconnect();
  }, [isClient]);

  return (
    <div className="gauges-container">
      <div className="gauge-card">
        <div className="gauge-chart-container">
          <canvas ref={gaugePlanRef} />
        </div>
        <h4>متوسط المخطط</h4>
      </div>
      <div className="gauge-card">
        <div className="gauge-chart-container">
          <canvas ref={gaugeActualRef} />
        </div>
        <h4>متوسط الفعلي</h4>
      </div>
      <div className="gauge-card">
        <div className="gauge-chart-container">
          <canvas ref={gaugeDeviationRef} />
        </div>
        <h4>متوسط الانحراف</h4>
      </div>
    </div>
  );
}

export default GlobalGauges;
