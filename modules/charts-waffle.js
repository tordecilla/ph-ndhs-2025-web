import { el } from './dom.js';
import { isPercentagePage } from './data-kind.js';
import { buildWaffleChartBlocks } from './charts-waffle-builder.js';

function waffleCells(row) {
  const cells = [];
  let cumulative = 0;
  const total = row.totalPct || 0;
  row.values.forEach(item => {
    if (!item.value) return;
    cumulative += item.value;
    const target = total > 0 ? Math.round(cumulative / total * row.cellCount) : 0;
    while (cells.length < target) cells.push(item);
  });
  while (cells.length < row.cellCount) cells.push({ color: 'rgba(0,0,0,0.06)', label: '', value: 0 });
  return cells.slice(0, row.cellCount);
}

function renderWaffleStack(container, rows) {
  const stack = el('div', 'waffle-stack');
  rows.forEach(row => {
    const rowEl = el('div', 'waffle-inner-row');
    const labelCol = el('div');
    labelCol.appendChild(el('div', 'waffle-cat-label', row.label));
    if (row.shareDisplay) labelCol.appendChild(el('div', 'waffle-pct-text', row.shareDisplay));
    rowEl.appendChild(labelCol);

    const bar = el('div', 'waffle-hbar');
    waffleCells(row).forEach(cell => {
      const node = el('div', 'waffle-cell');
      node.style.background = cell.color;
      if (cell.label && cell.value) node.title = cell.label + ': ' + Number(cell.value).toFixed(1) + '%';
      bar.appendChild(node);
    });
    rowEl.appendChild(bar);
    stack.appendChild(rowEl);
  });
  container.appendChild(stack);
}

function renderWaffleLegend(container, metrics) {
  const legend = el('div', 'waffle-legend');
  legend.appendChild(el('div', 'waffle-legend-title', 'Method'));
  const items = el('div', 'waffle-legend-items-row');
  metrics.forEach(metric => {
    const item = el('div', 'waffle-legend-item');
    const swatch = el('span', 'waffle-legend-swatch');
    swatch.style.background = metric.color;
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(metric.label + (metric.noteRef || '')));
    items.appendChild(item);
  });
  legend.appendChild(items);
  container.appendChild(legend);
}

function isRelevantSpecialNote(note, chartBlocks) {
  const labels = [];
  const values = [];
  chartBlocks.forEach(chartBlock => {
    (chartBlock.metrics || []).forEach(metric => labels.push(metric.label || ''));
    (chartBlock.rows || []).forEach(row => {
      labels.push(row.label || '');
      (row.values || []).forEach(value => values.push(String(value.display ?? value.value ?? '')));
    });
  });
  const valueText = values.join(' ');
  const labelText = labels.join(' ').toLowerCase();
  if (/["“]?NA["”]?\s+denotes/i.test(note)) return /\bN\/?A\b/i.test(valueText);
  if (/^"?0\.0"?\s+indicates/i.test(note)) return /(^|\s)0\.0(\s|$)/.test(valueText);
  if (/fewer than 25|suppressed/i.test(note)) return /(^|\s)\*(\s|$)/.test(valueText);
  return true;
}

export function canRenderWaffleCharts(pageData, manifestEntry = null) {
  return buildWaffleChartBlocks(pageData, manifestEntry).length > 0;
}

export function renderWaffleCharts(container, pageData, manifestEntry = null) {
  container.innerHTML = '';
  const chartBlocks = buildWaffleChartBlocks(pageData, manifestEntry);
  const hideBlockSubtitles = isPercentagePage(pageData, manifestEntry);
  const header = el('div');
  header.appendChild(el('div', 'chart-page-title', pageData.dataTables?.title || pageData.title || ''));
  const subtitle = manifestEntry?.chartSubtitle || '';
  if (subtitle) header.appendChild(el('div', 'chart-page-subtitle', subtitle));
  container.appendChild(header);

  const grid = el('div', 'chart-grid waffle-chart-grid');
  container.appendChild(grid);

  let currentGroupTitle = null;
  chartBlocks.forEach(chartBlock => {
    if (chartBlock.groupTitle && chartBlock.groupTitle !== currentGroupTitle) {
      currentGroupTitle = chartBlock.groupTitle;
      grid.appendChild(el('h2', 'chart-group-title', chartBlock.groupTitle));
    }
    const block = el('section', 'chart-block');
    block.appendChild(el('div', 'chart-block-title', (chartBlock.label || '') + ' - ' + chartBlock.year));
    if (chartBlock.subtitle && !hideBlockSubtitles) block.appendChild(el('div', 'chart-block-subtitle', chartBlock.subtitle));
    const yearMetrics = chartBlock.year === 2022
      ? chartBlock.metrics.map(item => ({ ...item, color: d3.color(item.color)?.brighter(0.85).formatHex() || item.color }))
      : chartBlock.metrics;
    const rows = chartBlock.year === 2022
      ? chartBlock.rows.map(row => ({ ...row, values: row.values.map(value => ({ ...value, color: yearMetrics.find(item => item.key === value.key)?.color || value.color })) }))
      : chartBlock.rows;
    renderWaffleStack(block, rows);
    renderWaffleLegend(block, yearMetrics);
    grid.appendChild(block);
  });

  const refs = new Set();
  chartBlocks.forEach(chartBlock => {
    (chartBlock.metrics || []).forEach(metric => { if (metric.noteRef) refs.add(metric.noteRef); });
    (chartBlock.rows || []).forEach(row => {
      const ref = String(row.label || '').match(/([¹²³⁴⁵⁶⁷⁸⁹⁰]+)$/)?.[1];
      if (ref) refs.add(ref);
    });
  });
  const referencedFootnotes = (pageData.dataTables?.footnotes || []).filter(note =>
    Array.from(refs).some(ref => String(note || '').trim().startsWith(ref))
      || isRelevantSpecialNote(String(note || '').trim(), chartBlocks)
  );
  const notes = [
    ...referencedFootnotes,
    ...(pageData.dataTables?.notes || []).filter(note => isRelevantSpecialNote(String(note || '').trim(), chartBlocks)),
  ].filter(Boolean);
  if (notes.length) {
    const foot = el('div', 'chart-footnotes');
    notes.forEach(note => foot.appendChild(el('div', 'chart-note', note)));
    container.appendChild(foot);
  }
  if (pageData.dataTables?.source || pageData.source) {
    container.appendChild(el('div', 'source-line', 'Source: ' + (pageData.dataTables?.source || pageData.source)));
  }
}
