// Thin wrappers around Chart.js (loaded globally from the CDN in index.html).
// Colours are read from the CSS variables, so charts follow the theme;
// call restyleCharts() after the theme changes.

const charts = new Set();

function tokens() {
  const css = getComputedStyle(document.documentElement);
  const get = (name) => css.getPropertyValue(name).trim();
  return {
    series: get('--series-1'),
    seriesSoft: get('--series-1-soft'),
    surface: get('--surface'),
    text: get('--text'),
    muted: get('--text-muted'),
    grid: get('--grid'),
    font: get('--font-sans'),
  };
}

// Vertical guide line under the tooltip on line charts.
const crosshair = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const active = chart.tooltip?.getActiveElements?.() ?? [];
    if (!active.length || chart.config.type !== 'line') return;
    const { ctx, chartArea } = chart;
    const x = active[0].element.x;
    ctx.save();
    ctx.strokeStyle = tokens().muted;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

function baseOptions(t) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.text,
        titleColor: t.surface,
        bodyColor: t.surface,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        titleFont: { family: t.font, weight: '600' },
        bodyFont: { family: t.font },
      },
    },
  };
}

function axis(t, extra = {}) {
  return {
    border: { display: false },
    grid: { color: t.grid, drawTicks: false },
    ticks: { color: t.muted, font: { family: t.font, size: 12 }, padding: 8 },
    ...extra,
  };
}

/**
 * Horizontal bar chart with one series.
 * `format` formats values for ticks and tooltips; `onSelect(label)` runs on bar click.
 */
export function createBarChart(canvas, { format, tooltipExtra, onSelect }) {
  const t = tokens();
  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: [], datasets: [{ data: [], borderRadius: 4, borderSkipped: 'start', barPercentage: 0.7, categoryPercentage: 0.9 }] },
    options: {
      ...baseOptions(t),
      indexAxis: 'y',
      onClick: (event, elements) => {
        if (onSelect && elements.length) onSelect(chart.data.labels[elements[0].index]);
      },
      onHover: (event, elements) => {
        event.native.target.style.cursor = onSelect && elements.length ? 'pointer' : 'default';
      },
      scales: {
        x: axis(t, { beginAtZero: true, ticks: { ...axis(t).ticks, callback: (v) => format(v, true), maxTicksLimit: 5 } }),
        y: axis(t, { grid: { display: false } }),
      },
      plugins: {
        ...baseOptions(t).plugins,
        tooltip: {
          ...baseOptions(t).plugins.tooltip,
          callbacks: {
            label: (ctx) => [format(ctx.parsed.x), ...(tooltipExtra ? tooltipExtra(ctx.dataIndex) : [])],
          },
        },
      },
    },
  });
  chart.$kind = 'bar';
  charts.add(chart);
  applyColors(chart, t);
  return chart;
}

/** Line chart for a time series. Points flagged in `partial` are drawn dashed. */
export function createLineChart(canvas) {
  const t = tokens();
  const chart = new Chart(canvas, {
    type: 'line',
    data: { labels: [], datasets: [{ data: [], borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, cubicInterpolationMode: 'monotone', fill: true }] },
    options: {
      ...baseOptions(t),
      interaction: { mode: 'index', intersect: false },
      scales: {
        x: axis(t, { grid: { display: false }, ticks: { ...axis(t).ticks, maxRotation: 0, autoSkipPadding: 16 } }),
        y: axis(t, { beginAtZero: true, ticks: { ...axis(t).ticks, maxTicksLimit: 5 } }),
      },
    },
    plugins: [crosshair],
  });
  chart.$kind = 'line';
  charts.add(chart);
  applyColors(chart, t);
  return chart;
}

/** Replaces a line chart's series. */
export function setLineData(chart, { labels, values, partial, format, note }) {
  const dataset = chart.data.datasets[0];
  chart.data.labels = labels;
  dataset.data = values;
  dataset.segment = {
    borderDash: (ctx) => (partial[ctx.p0DataIndex] || partial[ctx.p1DataIndex] ? [5, 4] : undefined),
  };
  dataset.pointStyle = values.map(() => 'circle');
  dataset.pointBackgroundColor = (ctx) => (partial[ctx.dataIndex] ? tokens().surface : tokens().series);
  chart.options.scales.y.ticks.callback = (v) => format(v, true);
  chart.options.plugins.tooltip.callbacks = {
    label: (ctx) => format(ctx.parsed.y),
    afterLabel: (ctx) => (partial[ctx.dataIndex] ? note : ''),
  };
  chart.update();
}

export function setBarData(chart, labels, values) {
  chart.data.labels = labels;
  chart.data.datasets[0].data = values;
  chart.update();
}

function applyColors(chart, t) {
  const dataset = chart.data.datasets[0];
  dataset.backgroundColor = chart.$kind === 'line' ? t.seriesSoft : t.series;
  dataset.borderColor = t.series;
  dataset.pointBorderColor = t.series;
  dataset.hoverBackgroundColor = t.series;
  for (const scale of Object.values(chart.options.scales)) {
    scale.grid.color = t.grid;
    scale.ticks.color = t.muted;
  }
  const tooltip = chart.options.plugins.tooltip;
  tooltip.backgroundColor = t.text;
  tooltip.titleColor = t.surface;
  tooltip.bodyColor = t.surface;
}

/** Re-reads the CSS colour variables after a theme change. */
export function restyleCharts() {
  const t = tokens();
  for (const chart of charts) {
    applyColors(chart, t);
    chart.update('none');
  }
}
