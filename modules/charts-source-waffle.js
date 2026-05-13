import { el } from './dom.js';
import { parseNumber } from './chart-utils.js';

const SOURCE_STYLE = {
  'Public sector': { key: 'public_sector', sectorLabel: 'Public sector', color: '#2f67be' },
  'Government hospital': { key: 'government_hospital', sectorKey: 'public_sector', sectorLabel: 'Public sector', color: '#2f67be' },
  'Rural health center/ urban health center/ lying-in clinic': { key: 'rural_health_center', sectorKey: 'public_sector', sectorLabel: 'Public sector', color: '#5684d2' },
  'Barangay health station': { key: 'barangay_health_station', sectorKey: 'public_sector', sectorLabel: 'Public sector', color: '#79a5e6' },
  'Barangay supply/ service point officer/ BHW': { key: 'bhw', sectorKey: 'public_sector', sectorLabel: 'Public sector', color: '#9dc2f3' },
  'Other public sector': { key: 'other_public_sector', sectorKey: 'public_sector', sectorLabel: 'Public sector', color: '#c2dbfb' },
  'Private medical sector': { key: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#c96f2d' },
  'Private hospital/ clinic/ lying-in clinic': { key: 'private_hospital', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#c96f2d' },
  Pharmacy: { key: 'pharmacy', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#dc8f3f' },
  'Private doctor': { key: 'private_doctor', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#ebb46f' },
  'Private nurse/ midwife': { key: 'private_nurse_midwife', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#f2cea0' },
  'Industry-based clinic': { key: 'industry_based_clinic', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#f8e5cb' },
  'Industry based clinic': { key: 'industry_based_clinic', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#f8e5cb' },
  'Other private medical sector': { key: 'other_private_medical_sector', sectorKey: 'private_medical_sector', sectorLabel: 'Private medical sector', color: '#f8e5cb' },
  'Other source': { key: 'other_source', sectorLabel: 'Other source', color: '#3d8d63' },
  'Shop/ store': { key: 'shop_store', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#3d8d63' },
  'Shop/store': { key: 'shop_store', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#3d8d63' },
  Church: { key: 'church', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#63a983' },
  'Friend/ relative': { key: 'friend_relative', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#87c39f' },
  'Friend/relative': { key: 'friend_relative', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#87c39f' },
  Other: { key: 'other_source_detail', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#add8bc' },
  "Don't know": { key: 'dont_know', sectorKey: 'other_source', sectorLabel: 'Other source', color: '#d4ecd7' },
};

function cleanKey(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item';
}

function tableRows(table) {
  return table?.rows || [];
}

function tableMethods(table, year) {
  const groupIndex = year === '2022' ? 1 : 0;
  const group = table?.colGroups?.[groupIndex];
  return (group?.cols || []).map((col, index) => ({
    key: cleanKey(col.label),
    label: col.label || '',
    index: groupIndex * (table.colGroups?.[0]?.cols?.length || 0) + index,
  }));
}

function cellValue(row, index) {
  const raw = row?.values?.[index];
  const value = parseNumber(raw);
  return { value, display: raw == null ? 'NA' : String(raw) };
}

function sourceRows(table) {
  return tableRows(table).filter(row => {
    const label = row.label || '';
    return label
      && !/^total number/i.test(label)
      && !['Public sector', 'Private medical sector', 'Other source'].includes(label);
  });
}

function totalUsers(table, method) {
  const row = tableRows(table).find(item => /^total number/i.test(item.label || ''));
  return cellValue(row, method.index);
}

function buildBlocks(pageData) {
  const table = (pageData?.dataTables?.tables || []).find(item => item.id === 'source');
  if (!table) return [];
  return ['2025', '2022'].map(year => {
    const sourceMethods = tableMethods(table, year).sort((a, b) => {
      const at = /^total$/i.test(a.label);
      const bt = /^total$/i.test(b.label);
      if (at && !bt) return -1;
      if (!at && bt) return 1;
      return 0;
    });
    const allUsers = totalUsers(table, sourceMethods.find(method => /^total$/i.test(method.label)) || sourceMethods[0]).value || 0;
    const methods = sourceMethods.map(method => {
      const users = totalUsers(table, method);
      const isTotal = /^total$/i.test(method.label);
      const totalShare = isTotal ? 100 : (allUsers > 0 && users.value != null ? users.value / allUsers * 100 : 0);
      return {
        ...method,
        label: isTotal ? 'All methods' : method.label,
        totalUsers: users.value,
        totalUsersLabel: users.display,
        totalShare,
        totalShareLabel: isTotal ? '100' : totalShare.toFixed(1),
        sources: sourceRows(table).map(row => {
          const style = SOURCE_STYLE[row.label] || {};
          const value = cellValue(row, method.index);
          return {
            key: style.key || cleanKey(row.label),
            label: row.label,
            noteRef: row.noteRef || '',
            sectorKey: style.sectorKey || style.key || cleanKey(row.label),
            sectorLabel: style.sectorLabel || row.label,
            color: style.color || '#999999',
            pct: value.value,
            pctLabel: value.display,
          };
        }).filter(source => source.pct != null && source.pct > 0),
      };
    });
    return { year, methods };
  });
}

function buildCells(method) {
  const n = Math.round((method.totalShare || 0) * 10);
  const cells = [];
  let cumulative = 0;
  method.sources.forEach(source => {
    cumulative += source.pct;
    const target = Math.round(cumulative * n / 100);
    while (cells.length < target) cells.push(source);
  });
  while (cells.length < n) cells.push({ color: 'rgba(0,0,0,0.06)', label: '', pct: null });
  return cells.slice(0, n);
}

function renderMethod(container, method) {
  const row = el('div', method.key === 'total' ? 'waffle-inner-row waffle-row--all' : 'waffle-inner-row');
  const label = el('div');
  label.appendChild(el('div', 'waffle-cat-label', method.label));
  if (method.totalShareLabel) label.appendChild(el('div', 'waffle-pct-text', method.totalShareLabel + '%'));
  row.appendChild(label);
  const bar = el('div', 'waffle-hbar');
  buildCells(method).forEach(cell => {
    const node = el('div', 'waffle-cell');
    node.style.background = cell.color;
    if (cell.label && cell.pct != null) node.title = cell.label + ': ' + cell.pctLabel + '%';
    bar.appendChild(node);
  });
  row.appendChild(bar);
  container.appendChild(row);
}

function renderLegend(container, methods) {
  const legend = el('div', 'waffle-legend');
  legend.appendChild(el('div', 'waffle-legend-title', 'Source'));
  const sectors = el('div', 'waffle-legend-sectors');
  const sectorMap = new Map();
  methods.flatMap(method => method.sources).forEach(source => {
    if (!sectorMap.has(source.sectorKey)) sectorMap.set(source.sectorKey, { label: source.sectorLabel, items: new Map() });
    const sector = sectorMap.get(source.sectorKey);
    if (!sector.items.has(source.key)) sector.items.set(source.key, source);
  });
  sectorMap.forEach(sector => {
    const col = el('div');
    col.appendChild(el('div', 'waffle-legend-sector-label', sector.label));
    const items = el('div', 'waffle-legend-items');
    sector.items.forEach(source => {
      const item = el('div', 'waffle-legend-item');
      const swatch = el('span', 'waffle-legend-swatch');
      swatch.style.background = source.color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(source.label + (source.noteRef || '')));
      items.appendChild(item);
    });
    col.appendChild(items);
    sectors.appendChild(col);
  });
  legend.appendChild(sectors);
  container.appendChild(legend);
}

export function canRenderSourceWaffleCharts(pageData, manifestEntry = null) {
  return manifestEntry?.chartType === 'source-waffle' && buildBlocks(pageData).length > 0;
}

export function renderSourceWaffleCharts(container, pageData, manifestEntry = null) {
  container.innerHTML = '';
  const header = el('div');
  header.appendChild(el('div', 'chart-page-title', pageData.dataTables?.title || pageData.title || ''));
  const subtitle = manifestEntry?.chartSubtitle || '';
  if (subtitle) header.appendChild(el('div', 'chart-page-subtitle', subtitle));
  container.appendChild(header);
  const grid = el('div', 'chart-grid waffle-chart-grid');
  container.appendChild(grid);
  buildBlocks(pageData).forEach(block => {
    const card = el('section', 'chart-block');
    card.appendChild(el('div', 'chart-block-title', block.year));
    const stack = el('div', 'waffle-stack');
    block.methods.forEach(method => renderMethod(stack, method));
    card.appendChild(stack);
    renderLegend(card, block.methods);
    grid.appendChild(card);
  });
  const notes = [...(pageData.dataTables?.footnotes || []), ...(pageData.dataTables?.notes || [])].filter(Boolean);
  if (notes.length) {
    const foot = el('div', 'chart-footnotes');
    notes.forEach(note => foot.appendChild(el('div', 'chart-note', note)));
    container.appendChild(foot);
  }
  if (pageData.dataTables?.source || pageData.source) {
    container.appendChild(el('div', 'source-line', 'Source: ' + (pageData.dataTables?.source || pageData.source)));
  }
}
