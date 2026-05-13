import { el } from './dom.js';
import { chartLabel, chartStep, displayValue, flatColumns, parseNumber, tableRows, withNoteRef } from './chart-utils.js';
import { LOLLIPOP_COLORS_2022, LOLLIPOP_COLORS_2025 } from './chart-colors.js';

function metricKey(col) {
  return col.key || col.field || '';
}

function baseKey(value) {
  return String(value || '').replace(/_pct$/, '');
}

function isChartMetric(col) {
  const key = metricKey(col);
  const label = String(col.label || '').trim().toLowerCase();
  if (!key || col.isCount) return false;
  if (/^total(?: number)?\b/.test(label)) return false;
  if (/^total(?:_n)?$/.test(key) || /^total_number\b/.test(key)) return false;
  if (/_total_pct$/.test(key)) return false;
  return true;
}

export function groupedMetrics(table) {
  const cols = flatColumns(table);
  if (!cols.length) return [];
  return cols
    .filter(col => col.year === '2025' && isChartMetric(col))
    .map(col => ({ key: metricKey(col), baseKey: baseKey(metricKey(col)), label: col.label || metricKey(col), noteRef: col.noteRef || null }));
}

function groupedYearRows(table, metrics, year, manifestEntry = null) {
  const cols = flatColumns(table).map((col, index) => ({ ...col, index }));
  return rowsForCharts(table).map(record => {
    const row = { label: chartLabel(table, record), noteRef: record.noteRef };
    metrics.forEach(metric => {
      const col = cols.find(item => item.year === String(year) && (metricKey(item) === metric.key || metricKey(item) === `${metric.key}_2022` || item.label === metric.label));
      const raw = record.values?.[col?.index];
      row[metric.baseKey] = parseNumber(raw);
      row[`${metric.baseKey}Display`] = displayValue(raw);
    });
    return row;
  });
}

function groupedSubtitle(pageData, table, manifestEntry = null) {
  if (manifestEntry?.chartBlockSubtitle) return manifestEntry.chartBlockSubtitle;
  if (/teenage pregnancy/i.test(pageData?.title || '')) {
    return `Women aged 15-19 years, by ${String(table.title || '').toLowerCase()} and childbearing indicator.`;
  }
  return table.subtitle || '';
}

function transposedMetrics(table) {
  return rowsForCharts(table)
    .filter(row => {
      const label = String(row.label || '').trim().toLowerCase();
      return label && label !== 'total' && !/^number of\b/.test(label);
    })
    .map(row => ({
      key: baseKey(row.label),
      baseKey: baseKey(row.label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
      label: row.label,
      noteRef: row.noteRef || null,
      sourceRow: row,
    }));
}

function rowsForCharts(table) {
  const rows = tableRows(table).filter(row => !row.excludeFromCharts);
  if (table?.id !== 'total-live-births') return rows;
  const combined = rows.filter(row => String(row.label || '').trim() === 'Live births and stillbirths');
  return combined.length ? combined : rows;
}

function transposedYearRows(table, metrics, year) {
  const cols = flatColumns(table).map((col, index) => ({ ...col, index }));
  return cols
    .filter(col => col.year === String(year) && String(col.label || '').trim().toLowerCase() !== 'total' && !col.isCount)
    .map(col => {
      const row = { label: col.label, noteRef: col.noteRef || null };
      metrics.forEach(metric => {
        const raw = metric.sourceRow.values?.[col.index];
        row[metric.baseKey] = parseNumber(raw);
        row[`${metric.baseKey}Display`] = displayValue(raw);
      });
      return row;
    });
}

function uniqueNotes(notes) {
  const seen = new Set();
  return notes.filter(note => {
    if (!note) return false;
    const key = String(note).trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupedChartNotes(pageData, blocks, manifestEntry = null) {
  if (Array.isArray(pageData?.chartNotes)) return pageData.chartNotes.filter(Boolean);

  const tableIds = new Set((blocks || []).map(block => block.tableId).filter(Boolean));
  const sourceTableNotes = (pageData?.dataTables?.tables || [])
    .filter(table => tableIds.has(table.id))
    .flatMap(table => [
      ...(table.footnotes || []),
      ...(table.notes || []),
    ]);

  return uniqueNotes([
    ...(pageData?.dataTables?.footnotes || []),
    ...(pageData?.dataTables?.notes || []),
    ...sourceTableNotes,
  ]);
}

export function buildGroupedIndicatorBlocks(pageData, manifestEntry = null) {
  const blocks = [];
  const transposeTables = manifestEntry?.chartTransposeTables;
  (pageData?.dataTables?.tables || []).forEach(table => {
    if (table.id === 'region') return;
    if (table.id === 'region-total' && !manifestEntry?.chartIncludeTotal) return;
    if (table.id === 'total' && !manifestEntry?.chartIncludeTotal) return;
    const metrics = groupedMetrics(table);
    const shouldTranspose = transposeTables === true || (Array.isArray(transposeTables) && transposeTables.includes(table.id)) || (!metrics.length && table.id === 'living-children');
    if (shouldTranspose) {
      const transposed = transposedMetrics(table);
      if (!transposed.length) return;
      [2025, 2022].forEach(year => {
        blocks.push({
          id: `${table.id}-${year}`,
          tableId: table.id,
          type: 'grouped-metric-lanes',
          label: table.title,
          year,
          subtitle: groupedSubtitle(pageData, table, manifestEntry),
          wrapLabels: manifestEntry?.chartWrapLabels === true,
          series: transposed,
          rows: transposedYearRows(table, transposed, year),
        });
      });
      return;
    }
    if (!metrics.length) return;
    [2025, 2022].forEach(year => {
      blocks.push({
        id: `${table.id}-${year}`,
        tableId: table.id,
        type: 'grouped-metric-lanes',
        label: table.title,
        year,
        subtitle: groupedSubtitle(pageData, table, manifestEntry),
        wrapLabels: manifestEntry?.chartWrapLabels === true || (manifestEntry?.chartWrapLabelTables || []).includes(table.id),
        series: metrics,
        rows: groupedYearRows(table, metrics, year, manifestEntry),
      });
    });
  });
  const excludedNoteFragments = manifestEntry?.chartExcludeNotesContaining || [];
  blocks.groupedNotes = blocks.length ? groupedChartNotes(pageData, blocks, manifestEntry).filter(note => {
    if (!note) return false;
    return !excludedNoteFragments.some(fragment => String(note).includes(fragment));
  }) : [];
  return blocks;
}

function groupedSeriesPalette(series, year) {
  const palette = String(year) === '2022' ? LOLLIPOP_COLORS_2022 : LOLLIPOP_COLORS_2025;
  return series.map((item, index) => {
    return {
      ...item,
      displayColor: palette[index % palette.length],
    };
  });
}

function groupedDisplay(row, key) {
  const display = row[`${key}Display`];
  if (display != null && display !== '') return String(display);
  if (row[key] == null) return 'NA';
  return String(row[key]);
}

function groupedSuppressed(row, key) {
  return row[key] == null && row[`${key}Display`] === '*';
}

function wrapText(textValue, maxChars) {
  const words = String(textValue || '')
    .replace(/\//g, '/ ')
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let current = '';
  words.forEach(word => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function appendWrappedLabel(svg, label, x, y, fontSize, maxChars) {
  const lines = wrapText(label, maxChars);
  const lineHeight = fontSize + 1;
  const textNode = svg.append('text')
    .attr('x', x)
    .attr('y', y - ((lines.length - 1) * lineHeight) / 2)
    .attr('text-anchor', 'end')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', fontSize)
    .attr('font-family', 'Inter, sans-serif')
    .attr('fill', 'var(--text-color)');
  lines.forEach((line, index) => {
    textNode.append('tspan')
      .attr('x', x)
      .attr('dy', index === 0 ? 0 : lineHeight)
      .text(line);
  });
}

export function renderGroupedIndicatorBlock(blockEl, block) {
  drawGroupedMetricLanes(blockEl, block);
  const legend = el('div', 'chart-legend');
  groupedSeriesPalette(block.series || [], block.year).forEach(item => {
    const entry = el('span');
    const swatch = el('span', 'legend-swatch');
    swatch.style.background = item.displayColor;
    entry.appendChild(swatch);
    entry.appendChild(document.createTextNode(item.label || ''));
    if (item.noteRef) entry.appendChild(el('sup', '', item.noteRef));
    legend.appendChild(entry);
  });
  blockEl.appendChild(legend);
}

function drawGroupedMetricLanes(container, block) {
  const rows = block.rows || [];
  const series = groupedSeriesPalette(block.series || [], block.year);
  const small = window.matchMedia('(max-width: 760px)').matches;
  const viewWidth = small ? 380 : 620;
  const maxLabelLen = d3.max(rows, row => withNoteRef(row.label, row).length) || 0;
  const leftMargin = small
    ? 96
    : Math.max(86, Math.min(124, 34 + maxLabelLen * 5));
  const rightMargin = 14;
  const mobileScale = small ? 2.4 : 1;
  const topMargin = 10 * mobileScale;
  const bottomMargin = 40 * mobileScale;
  const innerWidth = viewWidth - leftMargin - rightMargin;
  const values = rows.flatMap(row => series.map(item => row[item.baseKey]).filter(value => value != null));
  const maxValue = values.length ? d3.max(values) : 1;
  const step = chartStep(block.axisMax || maxValue);
  const yMax = block.axisMax || Math.max(step, Math.ceil((maxValue * 1.12) / step) * step);
  const tickStep = step;
  const laneGap = 10 * mobileScale;
  const groupGap = 24 * mobileScale;
  const markerScale = mobileScale > 1 ? 1.7 : 1;
  const groupHeight = Math.max(series.length - 1, 0) * laneGap + 1;
  const innerHeight = rows.length ? rows.length * groupHeight + Math.max(rows.length - 1, 0) * groupGap : 40;
  const axisGap = mobileScale > 1 ? 22 : 12;
  const axisY = innerHeight + axisGap;
  const viewHeight = topMargin + innerHeight + bottomMargin;
  const x = d3.scaleLinear().domain([0, yMax]).range([0, innerWidth - 8]);

  const wrap = el('div', 'chart-svg-wrap');
  container.appendChild(wrap);
  const svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${viewWidth} ${viewHeight}`);
  svgEl.setAttribute('preserveAspectRatio', 'xMinYMid meet');
  wrap.appendChild(svgEl);

  const svg = d3.select(svgEl);
  const chart = svg.append('g').attr('transform', `translate(${leftMargin},${topMargin})`);

  chart.append('line').attr('x1', 0).attr('y1', axisY).attr('x2', innerWidth).attr('y2', axisY).attr('stroke', 'var(--panel-divider)');
  d3.range(0, yMax + 0.01, tickStep).forEach(tick => {
    const xx = x(tick);
    chart.append('line').attr('x1', xx).attr('y1', 0).attr('x2', xx).attr('y2', innerHeight).attr('stroke', 'var(--panel-divider)').attr('stroke-dasharray', tick === 0 ? null : '2,3');
    chart.append('text').attr('x', xx).attr('y', axisY + 15).attr('text-anchor', 'middle').attr('font-size', mobileScale > 1 ? 13 : 11).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--data-label-color)').text(tick);
  });

  rows.forEach((row, rowIndex) => {
    const top = rowIndex * (groupHeight + groupGap);
    const midY = top + groupHeight / 2;
    const labelText = withNoteRef(row.label, row);
    const labelFontSize = mobileScale > 1 ? 13 : 12;
    if (block.wrapLabels) {
      appendWrappedLabel(svg, labelText, leftMargin - 10, topMargin + midY, labelFontSize, small ? 12 : 16);
    } else {
      svg.append('text').attr('x', leftMargin - 10).attr('y', topMargin + midY).attr('text-anchor', 'end').attr('dominant-baseline', 'middle').attr('font-size', labelFontSize).attr('font-family', 'Inter, sans-serif').attr('fill', 'var(--text-color)').text(labelText);
    }

    const suppressed = series.filter(item => groupedSuppressed(row, item.baseKey));
    if (suppressed.length > 0 && suppressed.length === series.length) {
      chart.append('text').attr('x', 6).attr('y', midY).attr('dominant-baseline', 'middle').attr('font-size', mobileScale > 1 ? 12 : 9).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--data-label-color)').text('Fewer than 25 cases (*)');
    }

    series.forEach((item, seriesIndex) => {
      const laneY = top + seriesIndex * laneGap;
      const value = row[item.baseKey];
      if (groupedSuppressed(row, item.baseKey) || value == null) return;
      const endX = x(value);
      chart.append('line').attr('x1', 0).attr('y1', laneY).attr('x2', endX).attr('y2', laneY).attr('stroke', item.displayColor).attr('stroke-width', 2.2);
      chart.append('circle').attr('cx', endX).attr('cy', laneY).attr('r', 3.6 * markerScale).attr('fill', item.displayColor);
      chart.append('text').attr('x', endX + (mobileScale > 1 ? 10 : 4)).attr('y', laneY).attr('dominant-baseline', 'middle').attr('font-size', mobileScale > 1 ? 13 : 9.5).attr('font-family', 'IBM Plex Mono, monospace').attr('fill', 'var(--data-label-color)').text(groupedDisplay(row, item.baseKey));
    });
  });

  svg.append('text').attr('x', leftMargin + innerWidth / 2).attr('y', topMargin + axisY + (mobileScale > 1 ? 34 : 28)).attr('text-anchor', 'middle').attr('font-size', mobileScale > 1 ? 13 : 12).attr('font-family', 'Inter, sans-serif').attr('fill', 'var(--data-label-color)').text('Percentage');
}
