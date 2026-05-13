import { text } from './dom.js';

export function tableById(pageData, id) {
  return (pageData?.dataTables?.tables || []).find(table => table.id === id);
}

export function parseNumber(value) {
  if (value == null || value === 'NA' || value === 'N/A' || value === '-') return null;
  const raw = typeof value === 'object' ? (value.display ?? value.value) : value;
  if (raw == null || raw === 'NA' || raw === 'N/A' || raw === '-') return null;
  const num = Number(String(raw).replace(/,/g, '').replace(/[()[\]]/g, ''));
  return Number.isFinite(num) ? num : null;
}

export function displayValue(value) {
  if (value && typeof value === 'object') return value.display ?? value.value ?? 'NA';
  return value ?? 'NA';
}

export function flatColumns(table) {
  if (!Array.isArray(table?.colGroups)) return [];
  return table.colGroups.flatMap(group => (group.cols || []).map(col => ({
    ...col,
    year: String(group.label || ''),
  })));
}

export function tableRows(table) {
  if (Array.isArray(table?.records) && table.records.length) return table.records;
  return (table?.rows || []).map(row => ({
    ...row,
    label: row.label,
    noteRef: row.noteRef,
    values: row.values || [],
  }));
}

export function shortRegionName(label) {
  const raw = text(label);
  const match = raw.match(/\(([^)]+)\)/);
  if (match) return match[1];
  return raw
    .replace(/^I - /, 'I ')
    .replace(/^II - /, 'II ')
    .replace(/^III - /, 'III ')
    .replace(/^IV-A - /, 'IV-A ')
    .replace(/^IVA - /, 'IV-A ')
    .replace(/^V - /, 'V ')
    .replace(/^VI - /, 'VI ')
    .replace(/^VII - /, 'VII ')
    .replace(/^VIII - /, 'VIII ')
    .replace(/^IX - /, 'IX ')
    .replace(/^X - /, 'X ')
    .replace(/^XI - /, 'XI ')
    .replace(/^XII - /, 'XII ')
    .replace(/^XIII - /, 'XIII ');
}

export function chartLabel(table, record) {
  if (record.chartLabel) return record.chartLabel;
  if (table?.id === 'total-live-births' && String(record?.label || '').trim() === 'Live births and stillbirths') return 'Total';
  return table?.id === 'region' ? shortRegionName(record.label) : record.label;
}

export function chartRows(table) {
  const rows = tableRows(table).filter(row => !row.excludeFromCharts);
  if (table?.id !== 'total-live-births') return rows;
  const combined = rows.filter(row => String(row.label || '').trim() === 'Live births and stillbirths');
  return combined.length ? combined : rows;
}

export function formatDisplay(display, fallback) {
  if (display != null && display !== '') return String(display);
  if (fallback == null) return 'NA';
  return String(fallback);
}

export function withNoteRef(label, row) {
  return text(label) + (row?.noteRef ? row.noteRef : '');
}

export function chartStep(rawMax) {
  if (rawMax > 100) return 20;
  if (rawMax > 40) return 10;
  if (rawMax > 10) return 5;
  return 0.5;
}
