import { el } from './dom.js';
import { chartLabel, chartStep, displayValue, formatDisplay, parseNumber, tableRows, withNoteRef } from './chart-utils.js';
import { LOLLIPOP_COLORS_2022, LOLLIPOP_COLORS_2025 } from './chart-colors.js';

function yearIndex(table, year) {
  return (table?.columns || []).findIndex(column => String(column).trim() === String(year));
}

function recordCell(record, year, category = null, table = null) {
  const cell = (record?.cells || []).find(cell => {
    const yearMatches = String(cell.year) === String(year);
    const categoryMatches = category == null ? !cell.category : cell.category === category;
    return yearMatches && categoryMatches;
  });
  if (cell) return cell;
  if (category != null) return null;
  const index = yearIndex(table, year);
  if (index <= 0 || !record?.values) return null;
  const raw = record.values[index - 1];
  return { value: parseNumber(raw), display: displayValue(raw) };
}

function cellValue(cell) {
  return {
    value: cell?.value ?? null,
    display: cell?.display ?? 'NA',
  };
}

function comparisonRows(table) {
  return rowsForCharts(table).map(record => {
    const c2025 = cellValue(recordCell(record, 2025, null, table));
    const c2022 = cellValue(recordCell(record, 2022, null, table));
    return {
      label: chartLabel(table, record),
      noteRef: record.noteRef,
      y2025: c2025.value,
      y2025Display: c2025.display,
      y2022: c2022.value,
      y2022Display: c2022.display,
    };
  });
}

export function hasSimpleYearPairs(table) {
  const rows = rowsForCharts(table);
  if (!rows.length) return false;
  return rows.some(row => recordCell(row, 2025, null, table)?.value != null || recordCell(row, 2022, null, table)?.value != null);
}

function rowsForCharts(table) {
  const rows = tableRows(table).filter(row => !row.excludeFromCharts);
  if (table?.id !== 'total-live-births') return rows;
  const combined = rows.filter(row => String(row.label || '').trim() === 'Live births and stillbirths');
  return combined.length ? combined : rows;
}

export function chartNotes(table) {
  return [...(table?.footnotes || []), ...(table?.notes || [])].filter(Boolean);
}

export function buildYearComparisonBlock(table) {
  return {
    id: table.id,
    type: 'vertical-comparison',
    label: table.title,
    subtitle: table.subtitle,
    rows: comparisonRows(table),
    notes: chartNotes(table),
  };
}

export function renderYearComparisonBlock(blockEl, block) {
  drawHorizontalComparison(blockEl, block);
  const color2025 = block.color2025 || LOLLIPOP_COLORS_2025[0];
  const color2022 = block.color2022 || LOLLIPOP_COLORS_2022[0];
  const legend = el('div', 'chart-legend');
  legend.innerHTML = `<span><span class="legend-swatch s2022" style="background:${color2022}"></span>2022</span><span><span class="legend-swatch" style="background:${color2025}"></span>2025</span>`;
  blockEl.appendChild(legend);
}

function drawHorizontalLane(group, y, value, display, scale, fill, textFill, stroked) {
  const laneY = y + 6;
  if (value == null) {
    group.append('text').attr('x', 5).attr('y', laneY).attr('dominant-baseline', 'middle').attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--no-data-color)').text(display || 'NA');
    return;
  }
  const endX = scale(value);
  group.append('line').attr('x1', 0).attr('y1', laneY).attr('x2', endX).attr('y2', laneY).attr('stroke', fill).attr('stroke-width', 2);
  group.append('circle').attr('cx', endX).attr('cy', laneY).attr('r', 4).attr('fill', fill).attr('stroke', stroked ? 'rgba(0,0,0,0.22)' : 'none');
  group.append('text').attr('x', endX + 6).attr('y', laneY).attr('dominant-baseline', 'middle').attr('font-size', 11).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', textFill).text(display);
}

function drawHorizontalComparison(container, block) {
  const rows = block.rows || [];
  const color2025 = block.color2025 || LOLLIPOP_COLORS_2025[0];
  const color2022 = block.color2022 || LOLLIPOP_COLORS_2022[0];
  const small = window.matchMedia('(max-width: 760px)').matches;
  const wide = block.layout === 'wide' && !small;
  const viewWidth = wide ? 900 : (small ? 430 : 660);
  const maxLabelLen = d3.max(rows, row => withNoteRef(row.label, row).length) || 0;
  const leftMargin = Math.max(small ? 86 : 110, Math.min(small ? 138 : 170, 36 + maxLabelLen * (small ? 4.4 : 5.1)));
  const rightMargin = small ? 48 : 82;
  const innerWidth = viewWidth - leftMargin - rightMargin;
  const laneGap = 10;
  const groupGap = 24;
  const topMargin = 4;
  const rowHeight = laneGap + 18;
  const plotHeight = rows.length * rowHeight + Math.max(0, rows.length - 1) * groupGap;
  const viewHeight = topMargin + plotHeight + 46;
  const values = rows.flatMap(row => [row.y2025, row.y2022].filter(value => value != null));
  const maxValue = values.length ? d3.max(values) : 1;
  const step = chartStep(block.axisMax || maxValue);
  const xMax = block.axisMax || Math.max(step, Math.ceil((maxValue * 1.12) / step) * step);
  const x = d3.scaleLinear().domain([0, xMax]).range([0, innerWidth]);

  const wrap = el('div', 'chart-svg-wrap');
  container.appendChild(wrap);
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMinYMid meet');
  wrap.appendChild(svgEl);
  const svg = d3.select(svgEl);
  const g = svg.append('g').attr('transform', `translate(${leftMargin},${topMargin})`);

  rows.forEach((row, index) => {
    const yBase = index * (rowHeight + groupGap);
    svg.append('text').attr('x', leftMargin - 10).attr('y', topMargin + yBase + laneGap).attr('text-anchor', 'end').attr('dominant-baseline', 'middle').attr('font-size', small ? 12 : 12.5).attr('font-family', 'Inter, sans-serif').attr('fill', 'var(--text-color)').text(withNoteRef(row.label, row));
    drawHorizontalLane(g, yBase, row.y2022, formatDisplay(row.y2022Display, row.y2022), x, color2022, 'var(--data-label-color)', true);
    drawHorizontalLane(g, yBase + laneGap, row.y2025, formatDisplay(row.y2025Display, row.y2025), x, color2025, 'var(--data-value-color)', false);
  });

  d3.range(0, xMax + step / 2, step).forEach(tick => {
    const xx = x(tick);
    g.append('line').attr('x1', xx).attr('y1', 0).attr('x2', xx).attr('y2', plotHeight).attr('stroke', 'var(--chart-axis)').attr('stroke-dasharray', tick === 0 ? null : '2,3').attr('opacity', tick === 0 ? 0.75 : 0.45);
    g.append('line').attr('x1', xx).attr('y1', plotHeight + 12).attr('x2', xx).attr('y2', plotHeight + 17).attr('stroke', 'var(--chart-axis)');
    g.append('text').attr('x', xx).attr('y', plotHeight + 29).attr('text-anchor', 'middle').attr('font-size', 10).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--data-label-color)').text(tick.toFixed(step >= 1 ? 0 : 1).replace(/\.0$/, ''));
  });
  g.append('line').attr('x1', 0).attr('y1', plotHeight + 12).attr('x2', innerWidth).attr('y2', plotHeight + 12).attr('stroke', 'var(--chart-axis)');
}
