import { el } from './dom.js';
import { isPercentagePage } from './data-kind.js';
import { chartLabel, chartStep, formatDisplay, tableById, tableRows, withNoteRef } from './chart-utils.js';
import { LOLLIPOP_COLORS_2022, LOLLIPOP_COLORS_2025 } from './chart-colors.js';
import { buildGroupedIndicatorBlocks, groupedMetrics, renderGroupedIndicatorBlock } from './charts-grouped-indicators.js';
import { canRenderSourceWaffleCharts, renderSourceWaffleCharts } from './charts-source-waffle.js';
import { canRenderWaffleCharts, renderWaffleCharts } from './charts-waffle.js';
import { buildYearComparisonBlock, chartNotes, hasSimpleYearPairs, renderYearComparisonBlock } from './charts-year-comparison.js';

function recordCell(record, year, category = null) {
  return (record?.cells || []).find(cell => {
    const yearMatches = String(cell.year) === String(year);
    const categoryMatches = category == null ? !cell.category : cell.category === category;
    return yearMatches && categoryMatches;
  });
}

function cellValue(cell) {
  return {
    value: cell?.value ?? null,
    display: cell?.display ?? 'NA',
  };
}

function hasCategoryPair(table, leftCategory, rightCategory) {
  return tableRows(table).some(row =>
    recordCell(row, 2025, leftCategory) &&
    recordCell(row, 2025, rightCategory)
  );
}

function mirrorRowsFromCategories(table, leftCategory, rightCategory) {
  return rowsForCharts(table).map(record => {
    const left2025 = cellValue(recordCell(record, 2025, leftCategory));
    const left2022 = cellValue(recordCell(record, 2022, leftCategory));
    const right2025 = cellValue(recordCell(record, 2025, rightCategory));
    const right2022 = cellValue(recordCell(record, 2022, rightCategory));
    return {
      label: chartLabel(table, record),
      noteRef: record.noteRef,
      left2025: left2025.value,
      left2025Display: left2025.display,
      right2025: right2025.value,
      right2025Display: right2025.display,
      left2022: left2022.value,
      left2022Display: left2022.display,
      right2022: right2022.value,
      right2022Display: right2022.display,
    };
  });
}

function rowsForCharts(table) {
  const rows = tableRows(table).filter(row => !row.excludeFromCharts);
  if (table?.id !== 'total-live-births') return rows;
  const combined = rows.filter(row => String(row.label || '').trim() === 'Live births and stillbirths');
  return combined.length ? combined : rows;
}

function buildChartBlocks(pageData, manifestEntry = null) {
  const groupedBlocks = buildGroupedIndicatorBlocks(pageData, manifestEntry);
  if (groupedBlocks.length) return withSharedPercentageAxis(groupedBlocks);

  const blocks = [];
  const asfr = tableById(pageData, 'asfr');
  const asfrMirrored = asfr && hasCategoryPair(asfr, 'Urban', 'Rural');

  (pageData?.dataTables?.tables || []).forEach(table => {
    if (table.id === 'asfr' && asfrMirrored) return;
    if (groupedMetrics(table).length) return;
    if (!hasSimpleYearPairs(table)) return;
    blocks.push(buildYearComparisonBlock(table));
  });

  if (asfrMirrored) {
    blocks.push({
      id: 'asfr',
      type: 'mirrored-comparison',
      layout: 'wide',
      label: asfr.title,
      subtitle: asfr.subtitle,
      leftLabel: 'Urban',
      rightLabel: 'Rural',
      rows: mirrorRowsFromCategories(asfr, 'Urban', 'Rural'),
      notes: chartNotes(asfr),
    });
  }
  return withSequentialYearColors(withSharedPercentageAxis(blocks));
}

function blockValues(block) {
  if (block.type === 'grouped-metric-lanes') {
    return (block.rows || []).flatMap(row =>
      (block.series || []).map(item => row[item.baseKey]).filter(value => value != null)
    );
  }
  if (block.type === 'vertical-comparison') {
    return (block.rows || []).flatMap(row => [row.y2025, row.y2022].filter(value => value != null));
  }
  return [];
}

function isPercentageBlock(block) {
  if (!['grouped-metric-lanes', 'vertical-comparison'].includes(block.type)) return false;
  const text = `${block.label || ''} ${block.subtitle || ''}`.toLowerCase();
  if (/\b(rate|number|children ever born|births per|total fertility)\b/.test(text)) return false;
  if (/\b(percent|percentage|share)\b/.test(text)) return true;
  const values = blockValues(block);
  return values.length > 0 && values.every(value => value >= 0 && value <= 100);
}

function sharedPercentageAxisMax(blocks) {
  const comparable = blocks.filter(block => ['grouped-metric-lanes', 'vertical-comparison'].includes(block.type));
  if (!comparable.length || comparable.length !== blocks.length) return null;
  if (!comparable.every(isPercentageBlock)) return null;
  const values = comparable.flatMap(blockValues);
  if (!values.length) return null;
  const maxValue = Math.max(...values);
  const step = chartStep(maxValue);
  return Math.max(step, Math.ceil((maxValue * 1.12) / step) * step);
}

function withSharedPercentageAxis(blocks) {
  const axisMax = sharedPercentageAxisMax(blocks);
  if (!axisMax) return blocks;
  blocks.forEach(block => { block.axisMax = axisMax; });
  return blocks;
}

function withSequentialYearColors(blocks) {
  let index = 0;
  blocks.forEach(block => {
    if (!['vertical-comparison', 'mirrored-comparison'].includes(block.type)) return;
    block.color2025 = LOLLIPOP_COLORS_2025[index % LOLLIPOP_COLORS_2025.length];
    block.color2022 = LOLLIPOP_COLORS_2022[index % LOLLIPOP_COLORS_2022.length];
    index += 1;
  });
  return blocks;
}

function drawMirroredLane(svg, anchorX, y, value, display, scale, invert, fill, textFill, stroked) {
  const laneY = y + 6;
  if (value == null) {
    svg.append('text').attr('x', invert ? anchorX - 6 : anchorX + 6).attr('y', laneY).attr('text-anchor', invert ? 'end' : 'start').attr('dominant-baseline', 'middle').attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--no-data-color)').text(display || 'NA');
    return;
  }
  const width = scale(value);
  const endX = invert ? anchorX - width : anchorX + width;
  svg.append('line').attr('x1', anchorX).attr('y1', laneY).attr('x2', endX).attr('y2', laneY).attr('stroke', fill).attr('stroke-width', 2);
  svg.append('circle').attr('cx', endX).attr('cy', laneY).attr('r', 4).attr('fill', fill).attr('stroke', stroked ? 'rgba(0,0,0,0.22)' : 'none');
  svg.append('text').attr('x', invert ? endX - 6 : endX + 6).attr('y', laneY).attr('text-anchor', invert ? 'end' : 'start').attr('dominant-baseline', 'middle').attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', textFill).text(display);
}

function drawMirroredComparison(container, block) {
  const rows = block.rows || [];
  const color2025 = block.color2025 || LOLLIPOP_COLORS_2025[0];
  const color2022 = block.color2022 || LOLLIPOP_COLORS_2022[0];
  const small = window.matchMedia('(max-width: 760px)').matches;
  const wide = block.layout === 'wide' && !small;
  const viewWidth = wide ? 920 : (small ? 430 : 660);
  const midWidth = wide ? 58 : 64;
  const outerMargin = small ? 8 : 12;
  const sideGap = 4;
  const sideWidth = (viewWidth - outerMargin * 2 - midWidth - sideGap * 2) / 2;
  const leftAnchor = outerMargin + sideWidth;
  const rightAnchor = leftAnchor + midWidth;
  const laneGap = 10;
  const groupGap = wide ? 18 : 22;
  const topMargin = 4;
  const rowHeight = laneGap + 18;
  const plotHeight = rows.length * rowHeight + Math.max(0, rows.length - 1) * groupGap;
  const axisY = topMargin + plotHeight + 12;
  const viewHeight = axisY + 34;
  const values = rows.flatMap(row => [row.left2025, row.right2025, row.left2022, row.right2022].filter(value => value != null));
  const maxValue = values.length ? d3.max(values) : 1;
  const step = chartStep(maxValue);
  const xMax = Math.max(step, Math.ceil((maxValue * 1.12) / step) * step);
  const x = d3.scaleLinear().domain([0, xMax]).range([0, sideWidth - 8]);

  const wrap = el('div', 'chart-svg-wrap');
  container.appendChild(wrap);
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMinYMid meet');
  wrap.appendChild(svgEl);
  const svg = d3.select(svgEl);

  svg.append('line').attr('x1', leftAnchor).attr('x2', leftAnchor).attr('y1', 0).attr('y2', axisY).attr('stroke', 'var(--chart-axis)');
  svg.append('line').attr('x1', rightAnchor).attr('x2', rightAnchor).attr('y1', 0).attr('y2', axisY).attr('stroke', 'var(--chart-axis)');

  rows.forEach((row, index) => {
    const yBase = topMargin + index * (rowHeight + groupGap);
    const centerY = yBase + laneGap;
    const label = withNoteRef(row.label, row);
    svg.append('text').attr('x', leftAnchor + midWidth / 2).attr('y', centerY).attr('text-anchor', 'middle').attr('dominant-baseline', 'middle').attr('font-size', label.length > 10 ? 9 : 12).attr('font-family', 'Inter, sans-serif').attr('fill', 'var(--text-color)').text(label);
    drawMirroredLane(svg, leftAnchor - sideGap, yBase, row.left2022, formatDisplay(row.left2022Display, row.left2022), x, true, color2022, 'var(--data-label-color)', true);
    drawMirroredLane(svg, rightAnchor + sideGap, yBase, row.right2022, formatDisplay(row.right2022Display, row.right2022), x, false, color2022, 'var(--data-label-color)', true);
    drawMirroredLane(svg, leftAnchor - sideGap, yBase + laneGap, row.left2025, formatDisplay(row.left2025Display, row.left2025), x, true, color2025, 'var(--data-value-color)', false);
    drawMirroredLane(svg, rightAnchor + sideGap, yBase + laneGap, row.right2025, formatDisplay(row.right2025Display, row.right2025), x, false, color2025, 'var(--data-value-color)', false);
  });

  d3.range(0, xMax + step / 2, step).forEach(tick => {
    const offset = x(tick);
    [leftAnchor - offset, rightAnchor + offset].forEach(xx => {
      svg.append('line').attr('x1', xx).attr('y1', topMargin).attr('x2', xx).attr('y2', topMargin + plotHeight).attr('stroke', 'var(--chart-axis)').attr('stroke-dasharray', tick === 0 ? null : '2,3').attr('opacity', tick === 0 ? 0.75 : 0.45);
      svg.append('line').attr('x1', xx).attr('y1', axisY).attr('x2', xx).attr('y2', axisY + 5).attr('stroke', 'var(--chart-axis)');
      svg.append('text').attr('x', xx).attr('y', axisY + 17).attr('text-anchor', 'middle').attr('font-size', 10).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--data-label-color)').text(tick.toFixed(step >= 1 ? 0 : 1).replace(/\.0$/, ''));
    });
  });
}

export function canRenderCharts(pageData, manifestEntry = null) {
  if (canRenderSourceWaffleCharts(pageData, manifestEntry)) return true;
  if (canRenderWaffleCharts(pageData, manifestEntry)) return true;
  return buildChartBlocks(pageData).length > 0;
}

export function renderCharts(container, pageData, manifestEntry = null) {
  if (canRenderSourceWaffleCharts(pageData, manifestEntry)) {
    renderSourceWaffleCharts(container, pageData, manifestEntry);
    return;
  }
  if (canRenderWaffleCharts(pageData, manifestEntry)) {
    renderWaffleCharts(container, pageData, manifestEntry);
    return;
  }
  container.innerHTML = '';
  const blocks = buildChartBlocks(pageData, manifestEntry);
  const hideBlockSubtitles = isPercentagePage(pageData, manifestEntry);
  const header = el('div');
  header.appendChild(el('div', 'chart-page-title', pageData.dataTables?.title || pageData.title || ''));
  const subtitle = manifestEntry?.chartSubtitle || '';
  if (subtitle) header.appendChild(el('div', 'chart-page-subtitle', subtitle));
  container.appendChild(header);
  const grid = el('div', 'chart-grid');
  container.appendChild(grid);

  blocks.forEach(block => {
    const blockEl = el('section', 'chart-block');
    const title = block.type === 'grouped-metric-lanes'
      ? `${block.label || ''}${block.label ? ' - ' : ''}${block.year}`
      : block.label || '';
    blockEl.appendChild(el('div', 'chart-block-title', title));
    if (block.subtitle && !hideBlockSubtitles) blockEl.appendChild(el('div', 'chart-block-subtitle', block.subtitle));
    if (block.type === 'grouped-metric-lanes') {
      renderGroupedIndicatorBlock(blockEl, block);
    } else if (block.type === 'mirrored-comparison') {
      const sides = el('div', 'mirror-side-labels');
      sides.appendChild(el('span', null, block.leftLabel || ''));
      sides.appendChild(el('span', null, block.rightLabel || ''));
      blockEl.appendChild(sides);
      drawMirroredComparison(blockEl, block);
      const legend = el('div', 'chart-legend');
      const color2025 = block.color2025 || LOLLIPOP_COLORS_2025[0];
      const color2022 = block.color2022 || LOLLIPOP_COLORS_2022[0];
      legend.innerHTML = `<span><span class="legend-swatch s2022" style="background:${color2022}"></span>2022</span><span><span class="legend-swatch" style="background:${color2025}"></span>2025</span>`;
      blockEl.appendChild(legend);
    } else {
      renderYearComparisonBlock(blockEl, block);
    }
    if (block.notes?.length) {
      const notesWrap = el('div', 'chart-block-notes');
      block.notes.forEach(note => notesWrap.appendChild(el('div', 'chart-block-note', note)));
      blockEl.appendChild(notesWrap);
    }
    grid.appendChild(blockEl);
  });
  if (blocks.groupedNotes?.length) {
    const notesWrap = el('div', 'chart-block-notes');
    blocks.groupedNotes.forEach(note => notesWrap.appendChild(el('div', 'chart-block-note', note)));
    container.appendChild(notesWrap);
  }
  if (pageData.dataTables?.source || pageData.source) {
    container.appendChild(el('div', 'source-line', 'Source: ' + (pageData.dataTables?.source || pageData.source)));
  }
}
