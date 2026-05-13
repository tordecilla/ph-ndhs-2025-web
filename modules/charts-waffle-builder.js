import { chartLabel, displayValue, flatColumns, parseNumber, tableRows, withNoteRef } from './chart-utils.js';

export const DEFAULT_WAFFLE_PALETTE = [
  '#4e79a7',
  '#f28e2b',
  '#e15759',
  '#76b7b2',
  '#59a14f',
  '#edc948',
  '#b07aa1',
  '#ff9da7',
  '#9c755f',
  '#bab0ac',
];

function metricKey(col) {
  return col.key || col.field || '';
}

function manifestWaffleLabel(key, fallback, manifestEntry = null) {
  return manifestEntry?.waffleLabels?.[key] || fallback || key;
}

export function waffleMetrics(table, manifestEntry = null) {
  const include = manifestEntry?.waffleMetrics;
  const exclude = new Set(manifestEntry?.waffleExclude || ['any_method_pct', 'total_pct', 'total_n']);
  const sourceMetrics = flatColumns(table)
    .filter(col => col.year === '2025')
    .filter(col => {
      const key = metricKey(col);
      if (!key || col.isCount) return false;
      if (Array.isArray(include) && include.length) return include.includes(key);
      return !exclude.has(key) && !/^total(?:_number|_n|_pct)?$/i.test(key);
    })
    .map((col, index) => ({
      key: metricKey(col),
      label: manifestWaffleLabel(metricKey(col), col.label || metricKey(col), manifestEntry),
      noteRef: col.noteRef || null,
      color: manifestEntry?.waffleColors?.[metricKey(col)] || DEFAULT_WAFFLE_PALETTE[index % DEFAULT_WAFFLE_PALETTE.length],
    }));
  const existing = new Set(sourceMetrics.map(metric => metric.key));
  const derived = Object.keys(manifestEntry?.waffleDerivedMetrics || {})
    .filter(key => Array.isArray(include) && include.includes(key) && !existing.has(key))
    .map((key, index) => ({
      key,
      label: manifestWaffleLabel(key, key, manifestEntry),
      noteRef: null,
      color: manifestEntry?.waffleColors?.[key] || DEFAULT_WAFFLE_PALETTE[(sourceMetrics.length + index) % DEFAULT_WAFFLE_PALETTE.length],
      derived: true,
    }));
  return [...sourceMetrics, ...derived].sort((a, b) => {
    if (!Array.isArray(include)) return 0;
    return include.indexOf(a.key) - include.indexOf(b.key);
  });
}

function columnIndex(table, year, key) {
  return flatColumns(table).findIndex(col => col.year === String(year) && metricKey(col) === key);
}

function rowValue(row, table, year, key) {
  const derived = table?._waffleDerivedMetrics?.[key];
  if (derived) {
    const start = Number.isFinite(Number(derived.subtractFrom)) ? Number(derived.subtractFrom) : 0;
    const value = (derived.subtract || []).reduce((total, sourceKey) => {
      const source = rowValue(row, table, year, sourceKey).value;
      return total - (source || 0);
    }, start || rowValue(row, table, year, derived.base || '').value || 0);
    const rounded = Number(value.toFixed(1));
    return { value: rounded < 0 ? 0 : rounded, display: (rounded < 0 ? 0 : rounded).toFixed(1) };
  }
  const lookupKey = year === 2022 && !key.endsWith('_2022') ? `${key}_2022` : key;
  const index = columnIndex(table, year, lookupKey);
  if (index < 0) return { value: null, display: 'NA' };
  const raw = row.values?.[index];
  return { value: parseNumber(raw), display: displayValue(raw) };
}

function totalCount(row, table, year) {
  const key = year === 2022 ? 'total_n_2022' : 'total_n';
  return rowValue(row, table, year, key).value || 0;
}

function overallCount(pageData, year) {
  const totalTable = (pageData?.dataTables?.tables || []).find(table => table.id === 'total');
  const totalRow = tableRows(totalTable)[0];
  return totalRow ? totalCount(totalRow, totalTable, year) : 0;
}

function waffleTotalKey(manifestEntry = null) {
  return manifestEntry?.waffleTotalKey || null;
}

function waffleRows(table, pageData, metrics, year, manifestEntry = null) {
  const overall = overallCount(pageData, year);
  const totalKey = waffleTotalKey(manifestEntry);
  return tableRows(table).map(row => {
    const count = totalCount(row, table, year);
    const total = totalKey ? rowValue(row, table, year, totalKey).value || 0 : null;
    const share = totalKey ? total : (overall > 0 ? count / overall * 100 : 0);
    const values = metrics.map(metric => ({
      ...metric,
      value: rowValue(row, table, year, metric.key).value || 0,
      display: rowValue(row, table, year, metric.key).display,
    }));
    return {
      label: withNoteRef(chartLabel(table, row), row),
      share,
      shareDisplay: totalKey
        ? rowValue(row, table, year, totalKey).display + '%'
        : (overall > 0 ? share.toFixed(1) + '%' : ''),
      cellCount: Math.max(0, Math.round(share * 10)),
      totalPct: totalKey ? share : values.reduce((sum, value) => sum + (value.value || 0), 0),
      values,
    };
  });
}

export function buildWaffleChartBlocks(pageData, manifestEntry = null) {
  if (manifestEntry?.chartType !== 'waffle') return [];
  const blocks = [];
  const excludedTables = new Set(manifestEntry?.chartExcludeTables || []);
  (pageData?.dataTables?.tables || []).forEach(table => {
    if (excludedTables.has(table.id)) return;
    table._waffleDerivedMetrics = manifestEntry?.waffleDerivedMetrics || {};
    const metrics = waffleMetrics(table, manifestEntry);
    if (!metrics.length || !tableRows(table).length) return;
    [2025, 2022].forEach(year => {
      blocks.push({
        id: `${table.id}-${year}`,
        tableId: table.id,
        groupTitle: table.groupTitle || null,
        label: manifestEntry?.chartTableLabels?.[table.id] || table.title || '',
        year,
        subtitle: manifestEntry?.chartBlockSubtitle || table.subtitle || '',
        metrics,
        rows: waffleRows(table, pageData, metrics, year, manifestEntry),
      });
    });
  });
  return blocks;
}
