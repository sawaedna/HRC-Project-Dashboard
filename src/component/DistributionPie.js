// src/component/DistributionPie.js
import React, { useEffect, useRef, useCallback } from 'react';
import ChartDataLabels from 'chartjs-plugin-datalabels';

function DistributionPie({ data, filters, type = 'phases' }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  const isClient = typeof window !== 'undefined';
  const Chart = isClient ? window.Chart : null;

  const buildChart = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !isClient || !Chart) return;

    // دمّر القديم
    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    // تسجيل الإضافة (حتى لو معطّلة هنا لا مشكلة)
    try { Chart.register(ChartDataLabels); } catch (_) {}

    // 1) فلترة البيانات بفلاتر الواجهة
    const filtered = (Array.isArray(data) ? data : []).filter((r) => {
      const siteMatch  = !filters?.site  || String(r['الموقع'] || '')         === String(filters.site);
      const phaseMatch = !filters?.phase || String(r['المرحلة'] || '')        === String(filters.phase);
      const itemMatch  = !filters?.item  || String(r['البند الرئيسي'] || '') === String(filters.item);
      return siteMatch && phaseMatch && itemMatch;
    });

    if (type !== 'phases' || filtered.length === 0) {
      // لا نرسم شيء لو مافيش بيانات
      return;
    }

    // 2) تجميع: مرحلة -> مجموعة مواقع فريدة
    const grouped = filtered.reduce((acc, r) => {
      const phase = r['المرحلة'] || 'غير محدد';
      const site  = r['الموقع']  || 'غير محدد';
      if (!acc[phase]) acc[phase] = new Set();
      acc[phase].add(site);
      return acc;
    }, {});

    const phaseOrder = [
      'المرحلة الأولى',
      'المرحلة الثانية',
      'المرحلة الثالثة',
      'المرحلة الرابعة',
      'المرحلة الخامسة',
    ];

    const phases = Object.keys(grouped).sort((a, b) => {
      const ia = phaseOrder.indexOf(a);
      const ib = phaseOrder.indexOf(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });

    // 3) بيانات الحلقتين
    const innerPhaseLabels = [];
    const innerPhaseData   = [];
    const outerSiteLabels  = [];
    const outerSiteData    = [];
    const siteToPhase      = [];

    phases.forEach((p) => {
      const sites = Array.from(grouped[p]).sort();
      innerPhaseLabels.push(p);
      innerPhaseData.push(sites.length || 1);
      sites.forEach((s) => {
        outerSiteLabels.push(s);
        outerSiteData.push(1);
        siteToPhase.push(p);
      });
    });

    // 4) ألوان
    const baseColors = [
      'rgba(79,140,255,1)',   // الأولى
      'rgba(139,92,246,1)',   // الثانية
      'rgba(34,197,94,1)',    // الثالثة
      'rgba(245,158,11,1)',   // الرابعة
      'rgba(239,68,68,1)',    // الخامسة
      'rgba(168,85,247,1)',
      'rgba(6,182,212,1)',
      'rgba(251,113,133,1)',
    ];

    const innerColors = phases.map((p, i) => {
      const idx = phaseOrder.indexOf(p);
      return baseColors[idx !== -1 ? idx : (i % baseColors.length)];
    });

    const rgbaWithAlpha = (rgba, a) => {
      const m = rgba.match(/(\d+)/g);
      if (!m || m.length < 3) return rgba;
      return `rgba(${m[0]}, ${m[1]}, ${m[2]}, ${a})`;
    };

    const outerColors = siteToPhase.map((p) => {
      const idx = phases.indexOf(p);
      const base = innerColors[idx];
      return rgbaWithAlpha(base, 0.7); // ظلّ أخف للمواقع
    });

    // 5) البلجن النهائي: داخلي Tangent / خارجي Radial + Fallback
    const RobustLabels = {
      id: 'robustLabels',
      afterDatasetsDraw(chart) {
        const ctx2 = chart.ctx;

        // --- مماسي (Tangent) على القوس (للمراحل) ---
        const drawTangent = (arc, text, style = {}) => {
          if (!arc || !text) return;
          const { startAngle, endAngle, innerRadius, outerRadius, x, y, circumference } = arc;
          if (circumference <= 0) return;

          const mid = (startAngle + endAngle) / 2;
          const r   = (innerRadius + outerRadius) / 2;

          const tx = x + Math.cos(mid) * r;
          const ty = y + Math.sin(mid) * r;

          let rot = mid - Math.PI / 2;
          if (rot > Math.PI / 2 && rot < (3 * Math.PI) / 2) rot += Math.PI;

          ctx2.save();
          ctx2.translate(tx, ty);
          ctx2.rotate(rot);
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'middle';
          const size   = style.size   || 12;
          const weight = style.weight || 'bold';
          const color  = style.color  || '#fff';
          ctx2.font = `${weight} ${size}px Cairo`;
          ctx2.lineWidth = 3;
          ctx2.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx2.fillStyle = color;
          ctx2.strokeText(text, 0, 0);
          ctx2.fillText(text, 0, 0);
          ctx2.restore();
        };

        // --- شعاعي (Radial) للمواقع + قص + RTL + بديل مماسي ---
        // === استبدل دالة drawRadialRobust بالكامل بهذه النسخة ===
        const drawRadialRobust = (arc, rawText, style = {}) => {
          if (!arc || !rawText) return;
          const { startAngle, endAngle, innerRadius, outerRadius, x, y, circumference } = arc;
          if (circumference <= 0) return;

          // نكتب للجميع من القاعدة (الداخل) -> الرأس (الخارج) بلا منطق يمين/يسار
          const band       = outerRadius - innerRadius;
          const innerInset = Math.max(10, band * 0.40);
          const outerInset = Math.max(2, band * 0.08);
          const fontSize = style.size ?? 9;
          const startPad = Math.max(2, fontSize * 0.2);
          const mid = (startAngle + endAngle) / 2;
          const startR = innerRadius + innerInset + startPad;
          const endR   = outerRadius - outerInset;
          const available = Math.max(6, endR - startR);

          const ctx2 = chart.ctx;
          ctx2.save();

          // قصّ المثلث حتى لا يتداخل النص مع القطاعات المجاورة
          const eps = 1;
          ctx2.beginPath();
          ctx2.moveTo(
            x + Math.cos(startAngle) * (innerRadius + eps),
            y + Math.sin(startAngle) * (innerRadius + eps)
          );
          ctx2.arc(x, y, outerRadius - eps, startAngle, endAngle);
          ctx2.lineTo(
            x + Math.cos(endAngle) * (innerRadius + eps),
            y + Math.sin(endAngle) * (innerRadius + eps)
          );
          ctx2.arc(x, y, innerRadius + eps, endAngle, startAngle, true);
          ctx2.closePath();
          ctx2.clip();

          // اجعل الاتجاه على نصف القطر نفسه
          ctx2.translate(x, y);
          ctx2.rotate(mid);

          // إعداد الخط
          const size   = style.size   ?? 11;
          const weight = style.weight ?? 'normal';
          const color  = style.color  ?? '#fff';
          ctx2.font = `${weight} ${size}px Cairo`;
          ctx2.textAlign = 'left';
          ctx2.textBaseline = 'middle';
          ctx2.fillStyle = color;
          ctx2.strokeStyle = 'rgba(0,0,0,0.35)';
          ctx2.lineWidth = 3;
          ctx2.direction = 'rtl';

          // قصّ ذكي مع "…" لضمان الظهور دائمًا (بدون أي fallback متغير)
          let text = (rawText || '').trim();
          if (!text) { ctx2.restore(); return; }

          // قلّم حتى يلائم الطول المتاح
          while (text.length > 2 && ctx2.measureText(text + '…').width > available) {
            text = text.slice(0, -1);
          }
          if (ctx2.measureText(text).width > available) {
            text = '…';
          } else if (text.length < (rawText || '').trim().length) {
            text += '…';
          }

          // ابدأ من القاعدة واكتب للخارج
          ctx2.translate(startR, 0);
          ctx2.strokeText(text, 0, 0);
          ctx2.fillText(text, 0, 0);

          ctx2.restore();
        };
    
          
        // ارسم: داخلي = Tangent
        const metaInner = chart.getDatasetMeta(0);
        metaInner.data.forEach((arc, i) => {
          const label = (innerPhaseLabels[i] || '').trim();
          if (!label) return;
          drawTangent(arc, label, { size: 13, weight: 'bold', color: '#fff' });
        });

        // ارسم: خارجي = RadialRobust (مع بديل)
        const metaOuter = chart.getDatasetMeta(1);
        metaOuter.data.forEach((arc, i) => {
          const raw = (outerSiteLabels[i] || '').trim();
          if (!raw) return;
          drawRadialRobust(arc, raw, { size: 11, weight: 'normal', color: '#fff' });
        });
      }
    };

    // 6) إعداد التشارت
    const config = {
      type: 'doughnut',
      data: {
        labels: phases,
        datasets: [
          {
            label: 'المراحل',
            data: innerPhaseData,
            backgroundColor: innerColors,
            borderColor: '#ffffff',
            borderWidth: 2,
            weight: 1,
          },
          {
            label: 'المواقع',
            data: outerSiteData,
            backgroundColor: outerColors,
            borderColor: '#fcfcfcff',
            borderWidth: 2,
            weight: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '0%', // حلقة داخلية ممتلئة (two-ring look)
        plugins: {
          legend: {
            position: 'right',
            labels: {
              font: { size: 11, family: 'Cairo' },
              padding: 12,
              // ليجند الحلقة الداخلية فقط (المراحل)
              generateLabels: (chart) => {
                const data = chart.data;
                if (!data.labels.length || !data.datasets.length) return [];
                const { labels: { pointStyle } } = chart.legend.options;
                const meta = chart.getDatasetMeta(0);
                return data.labels.map((lbl, i) => ({
                  text: lbl,
                  fillStyle: meta.controller.getStyle(i).backgroundColor,
                  strokeStyle: meta.controller.getStyle(i).borderColor,
                  lineWidth: meta.controller.getStyle(i).borderWidth,
                  pointStyle,
                  hidden: !chart.isDatasetVisible(0),
                  index: i,
                }));
              },
            },
          },
          tooltip: {
            callbacks: {
              label: (ctxTip) => {
                const ds = ctxTip.datasetIndex;
                const i  = ctxTip.dataIndex;
                if (ds === 0) {
                  return ctxTip.label || '';
                }
                const site  = outerSiteLabels[i];
                const phase = siteToPhase[i];
                return `${phase} - ${site}`;
              },
            },
          },
          datalabels: { display: false }, // نعطّل لأننا نرسم يدويًا
        },
      },
      plugins: [RobustLabels],
    };

    chartRef.current = new Chart(ctx, config);
  }, [Chart, data, filters, isClient, type]);

  useEffect(() => {
    buildChart();
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [buildChart]);

  const title = type === 'phases' ? 'توزيع المراحل والمواقع' : 'توزيع البنود الرئيسية';

  return (
    <div className="distribution-pie-panel">
      <div className="dashboard-panel-header">
        <h3>{title}</h3>
      </div>
      <div style={{ flex: 1, position: 'relative', minHeight: '200px' }}>
        <canvas ref={canvasRef} className="pie-canvas"></canvas>
      </div>
    </div>
  );
}

export default DistributionPie;
