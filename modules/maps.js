import { text } from './dom.js';

const ASSET_BASE = globalThis.NDHS_WEB_ASSET_BASE || new URL('../map-engine', import.meta.url).href.replace(/\/$/, '');
const PERIODS = [
  { key: '2025', label: '2025' },
  { key: '2022', label: '2022' },
  { key: 'change', label: 'Change' },
];
const DEFAULT_MAP_COLOR_STOPS = [
  '#ffffe5',
  '#fff7bc',
  '#ffeda0',
  '#fed976',
  '#feb24c',
  '#fd9a3a',
  '#fc7a32',
  '#f9572a',
  '#ec3023',
  '#d7191c',
  '#bd0026',
  '#97001f',
  '#6f0019',
  '#4a0014',
];

const LON_MIN = 116.93;
const LON_MAX = 126.60;
const LAT_MIN = 4.64;
const LAT_MAX = 20.84;
const PAD = 30;

function normalizeRegionLabel(value) {
  return text(value)
    .toLowerCase()
    .replace(/\bsoccsksargen\b/g, 'soccsksargen')
    .replace(/^i - ilocos region$/, 'region i (ilocos region)')
    .replace(/^ii - cagayan valley$/, 'region ii (cagayan valley)')
    .replace(/^iii - central luzon$/, 'region iii (central luzon)')
    .replace(/^iva - calabarzon$/, 'region iv-a (calabarzon)')
    .replace(/^v - bicol region$/, 'region v (bicol region)')
    .replace(/^vi - western visayas$/, 'region vi (western visayas)')
    .replace(/^vii - central visayas$/, 'region vii (central visayas)')
    .replace(/^viii - eastern visayas$/, 'region viii (eastern visayas)')
    .replace(/^ix - zamboanga peninsula$/, 'region ix (zamboanga peninsula)')
    .replace(/^x - northern mindanao$/, 'region x (northern mindanao)')
    .replace(/^xi - davao region$/, 'region xi (davao region)')
    .replace(/^xii - soccsksargen$/, 'region xii (soccsksargen)')
    .replace(/^xiii - caraga$/, 'region xiii (caraga)')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePsgc(value) {
  if (value == null) return null;
  const digits = text(value).replace(/\D/g, '');
  return digits || null;
}

function parseNumber(value) {
  if (value == null || value === 'NA' || value === 'N/A' || value === '-') return null;
  const raw = typeof value === 'object' ? (value.display ?? value.value) : value;
  if (raw == null || raw === 'NA' || raw === 'N/A' || raw === '-') return null;
  const num = Number(String(raw).replace(/,/g, '').replace(/[()[\]]/g, ''));
  return Number.isFinite(num) ? num : null;
}

function displayValue(value) {
  if (value && typeof value === 'object') return value.display ?? value.value ?? 'NA';
  return value ?? 'NA';
}

function yearIndex(table, year) {
  return (table?.columns || []).findIndex(column => String(column).trim() === String(year));
}

function flatColumns(table) {
  if (Array.isArray(table?.colGroups) && table.colGroups.length) {
    return table.colGroups.flatMap(group => (group.cols || []).map(col => ({
      ...col,
      year: group.label,
    })));
  }
  return (table?.columns || []).slice(1).map((label, index) => ({
    key: String(label).trim(),
    label: String(label).trim(),
    year: String(label).trim(),
    index,
  }));
}

function uniqueNotes(notes) {
  const seen = new Set();
  return (notes || []).filter(note => {
    const clean = text(note).trim();
    if (!clean || seen.has(clean)) return false;
    seen.add(clean);
    return true;
  });
}

function tableFootnotes(pageData, table = null) {
  return uniqueNotes([
    ...(table?.footnotes || []),
    ...(pageData?.dataTables?.footnotes || []),
  ]);
}

function tableNotes(pageData, table = null) {
  return uniqueNotes([
    ...(table?.notes || []),
    ...(pageData?.dataTables?.notes || []),
  ]);
}

function footnoteText(pageData, noteRef, table = null) {
  return tableFootnotes(pageData, table).find(note => noteRef && text(note).startsWith(noteRef)) || '';
}

function metricOptions(table, pageData) {
  const noteFor = noteRef => footnoteText(pageData, noteRef, table);
  if (Array.isArray(table?.colGroups) && table.colGroups.length) {
    const cols = flatColumns(table).map((col, index) => ({ ...col, index }));
    const current = cols.filter(col => (
      col.year === '2025'
      && (col.key || col.field)
      && !col.isCount
      && !/^total number\b/i.test(text(col.label || col.key || col.field))
    ));
    return current.map(col => {
      const key = col.key || col.field || text(col.label).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      const prior = cols.find(item => item.year === '2022' && (
        item.key === col.key + '_2022' ||
        item.field === col.field ||
        item.label === col.label
      ));
      return {
        key,
        label: col.label,
        labelPlain: col.label,
        noteRef: col.noteRef || null,
        note: noteFor(col.noteRef),
        index2025: col.index,
        index2022: prior?.index ?? null,
      };
    });
  }
  return [{
    key: 'value',
    label: pageData.dataTables?.title || pageData.title || table?.title || 'Value',
    labelPlain: pageData.dataTables?.title || pageData.title || table?.title || 'Value',
  }];
}

function orderMetricOptions(options, manifestEntry) {
  const order = manifestEntry?.mapMetricOrder;
  const labels = manifestEntry?.mapMetricLabels || {};
  const ordered = (!Array.isArray(order) || !order.length)
    ? options
    : options.filter(option => order.includes(option.key)).sort((a, b) => {
    const ai = order.indexOf(a.key);
    const bi = order.indexOf(b.key);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  return ordered.map(option => {
    const tabLabel = labels[option.key];
    if (!tabLabel) return option;
    return {
      ...option,
      tabLabel,
    };
  });
}

function tableRows(table) {
  if (Array.isArray(table?.records) && table.records.length) return table.records;
  return (table?.rows || []).map(row => ({
    label: row.label,
    noteRef: row.noteRef,
    note: row.note || row.psa_note || '',
    values: row.values || [],
  }));
}

function cellForYear(record, year, table = null, option = null) {
  if (option && option.key !== 'value' && record?.values) {
    const index = year === 2022 ? option.index2022 : option.index2025;
    if (index == null || index < 0) return { value: null, display: 'NA' };
    const raw = record.values[index];
    return { value: parseNumber(raw), display: displayValue(raw) };
  }
  const cell = (record?.cells || []).find(item => String(item.year) === String(year) && !item.category);
  if (cell) return { value: cell.value ?? parseNumber(cell.display), display: cell.display ?? cell.value ?? 'NA' };
  const index = yearIndex(table, year);
  if (index <= 0 || !record?.values) return { value: null, display: 'NA' };
  const raw = record.values[index - 1];
  return { value: parseNumber(raw), display: displayValue(raw) };
}

function metricForPeriod(row, period) {
  if (!row) return { value: null, display: 'NA' };
  if (period === '2022') return { value: row.value2022, display: row.display2022 };
  if (period === 'change') return { value: row.change, display: row.displayChange };
  return { value: row.value2025, display: row.display2025 };
}

function makePathFn(w, h) {
  const lonSpan = LON_MAX - LON_MIN;
  const latSpan = LAT_MAX - LAT_MIN;
  const scale = Math.min((w - 2 * PAD) / lonSpan, (h - 2 * PAD) / latSpan);
  const offX = (w - lonSpan * scale) / 2;
  const offY = (h - latSpan * scale) / 2;
  return d3.geoPath().projection(d3.geoTransform({
    point(lon, lat) {
      this.stream.point(offX + (lon - LON_MIN) * scale, offY + (LAT_MAX - lat) * scale);
    },
  }));
}

function shortenRegion(name) {
  const match = text(name).match(/\(([^)]+)\)/);
  return match ? match[1] : text(name).replace(/^Region\s+/i, '');
}

function buildNameRegistry(index, countryFeatures) {
  const nameRegistry = {};
  const psgcByLabel = {};
  const regions = [...(index?.regions?.nir || []), ...(index?.regions?.standard || [])];
  regions.forEach(region => {
    const psgc = normalizePsgc(region.psgc);
    if (!psgc || !region.name) return;
    nameRegistry[psgc] = region.name;
    psgcByLabel[normalizeRegionLabel(region.name)] = psgc;
    const short = region.name.match(/\(([^)]+)\)/)?.[1];
    if (short) psgcByLabel[normalizeRegionLabel(short)] = psgc;
  });
  countryFeatures.forEach(feature => {
    const psgc = normalizePsgc(feature.properties?.adm1_psgc);
    if (psgc && feature.properties?.adm1_en) nameRegistry[psgc] = feature.properties.adm1_en;
  });
  psgcByLabel[normalizeRegionLabel('National Capital Region (NCR)')] = '1300000000';
  psgcByLabel[normalizeRegionLabel('Cordillera Administrative Region (CAR)')] = '1400000000';
  psgcByLabel[normalizeRegionLabel('MIMAROPA Region')] = '1700000000';
  psgcByLabel[normalizeRegionLabel('Negros Island Region (NIR)')] = '1800000000';
  psgcByLabel[normalizeRegionLabel('Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)')] = '1900000000';
  return { nameRegistry, psgcByLabel };
}

function noteBody(note) {
  return text(note).trim().replace(/^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s*/, '');
}

function isValueDependentNote(note) {
  const clean = text(note).trim();
  return /^["“]?NA["”]?\s+denotes/i.test(clean)
    || /^"?0\.0"?\s+indicates/i.test(clean)
    || /parentheses|25-49 unweighted/i.test(clean)
    || /asterisk|fewer than 25|suppressed/i.test(clean);
}

function buildMapRows(pageData, psgcByLabel, options) {
  const regionTable = (pageData.dataTables?.tables || []).find(table => table.id === 'region');
  return tableRows(regionTable).map(record => {
    const psgc = psgcByLabel[normalizeRegionLabel(record.label)];
    const metrics = {};
    options.forEach(option => {
      const c2025 = cellForYear(record, 2025, regionTable, option);
      const c2022 = cellForYear(record, 2022, regionTable, option);
      const change = c2025?.value != null && c2022?.value != null
        ? Number((Number(c2025.value) - Number(c2022.value)).toFixed(1))
        : null;
      metrics[option.key] = {
        value2025: c2025?.value ?? null,
        display2025: c2025?.display ?? 'NA',
        value2022: c2022?.value ?? null,
        display2022: c2022?.display ?? 'NA',
        change,
        displayChange: change == null ? 'NA' : (change > 0 ? '+' : '') + change.toFixed(1),
      };
    });
    return {
      psgc,
      label: record.label,
      noteRef: record.noteRef,
      note: record.note || record.psa_note || (record.noteRef ? footnoteText(pageData, record.noteRef, regionTable) : null),
      metrics,
    };
  }).filter(row => row.psgc);
}

function nationalMetric(pageData, period, option) {
  const national = (pageData?.dataTables?.tables || []).find(table => table.id === 'national')
    || (pageData?.dataTables?.tables || []).find(table => table.id === 'total');
  const record = tableRows(national)[0];
  if (!record) return null;
  const nationalOption = option?.key === 'value' ? option : metricOptions(national, pageData).find(item => item.key === option?.key);
  const c2025 = cellForYear(record, 2025, national, nationalOption);
  const c2022 = cellForYear(record, 2022, national, nationalOption);
  const change = c2025?.value != null && c2022?.value != null
    ? Number((Number(c2025.value) - Number(c2022.value)).toFixed(1))
    : null;
  return metricForPeriod({
    value2025: c2025?.value ?? null,
    display2025: c2025?.display ?? 'NA',
    value2022: c2022?.value ?? null,
    display2022: c2022?.display ?? 'NA',
    change,
    displayChange: change == null ? 'NA' : (change > 0 ? '+' : '') + change.toFixed(1),
  }, period);
}

export function canRenderMap(pageData) {
  return (pageData?.dataTables?.tables || []).some(table => table.id === 'region' && tableRows(table).length && metricOptions(table, pageData).length);
}

export async function renderMap(container, pageData, manifestEntry) {
  container.innerHTML = `
    <svg id="map-svg"><rect class="svg-bg" width="100%" height="100%"></rect></svg>
    <div id="metric-toggle" aria-label="Map indicator"></div>
    <div id="period-toggle" aria-label="Map period"></div>
    <div id="map-status">Loading...</div>
    <button id="map-info-btn">ℹ Details</button>
    <div id="map-detail">
      <div id="map-detail-header">
        <div id="map-detail-header-row">
          <div class="detail-eyebrow" id="map-eyebrow">Map</div>
          <button id="map-detail-close">✕</button>
        </div>
        <div class="detail-lgu-name" id="map-lgu-name">-</div>
      </div>
      <div id="map-detail-body"></div>
    </div>
  `;

  const mapSvgEl = container.querySelector('#map-svg');
  const mapSvg = d3.select(mapSvgEl);
  const mapG = mapSvg.append('g');
  const detailEl = container.querySelector('#map-detail');
  const statusEl = container.querySelector('#map-status');
  const periodToggleEl = container.querySelector('#period-toggle');
  const metricToggleEl = container.querySelector('#metric-toggle');
  let activePeriod = '2025';
  let activeMetric = null;
  let activeRegionPsgc = null;
  let mapRows = [];
  let mapDataByRegion = {};
  let countryFeatures = [];
  let nameRegistry = {};
  let mapColorScale = null;
  const regionTable = (pageData.dataTables?.tables || []).find(table => table.id === 'region');
  const options = orderMetricOptions(metricOptions(regionTable, pageData), manifestEntry);
  activeMetric = options.find(option => option.key === 'ever_pregnant_pct')?.key || options[0]?.key || 'value';

  const zoom = d3.zoom().scaleExtent([0.5, 20]).on('zoom', event => mapG.attr('transform', event.transform));
  mapSvg.call(zoom);
  mapSvg.on('dblclick.zoom', null);

  const [index, geo] = await Promise.all([
    d3.json(ASSET_BASE + '/psgc-index.json'),
    d3.json(ASSET_BASE + '/geo-nir/country.0.001.json'),
  ]);
  countryFeatures = geo.features || [];
  const registry = buildNameRegistry(index, countryFeatures);
  nameRegistry = registry.nameRegistry;
  mapRows = buildMapRows(pageData, registry.psgcByLabel, options);
  mapDataByRegion = Object.fromEntries(mapRows.map(row => [row.psgc, row]));

  function mapDomain() {
    const domainOverrides = manifestEntry?.mapColorDomains || {};
    const overrideKey = activePeriod === 'change' ? `${activeMetric}_delta` : activeMetric;
    const periodOverrideKey = activePeriod === '2022' ? `${activeMetric}_2022` : overrideKey;
    const override = domainOverrides[periodOverrideKey] || domainOverrides[overrideKey];
    if (Array.isArray(override) && override.length === 2) return override;

    const values = mapRows.flatMap(row =>
      options.map(option => metricForPeriod(row.metrics?.[option.key], activePeriod).value)
    ).filter(value => value != null);
    if (activePeriod === 'change') {
      const bound = Math.max(0.5, Math.ceil(Math.max(...values.map(Math.abs), 0.5) * 10) / 10);
      return [-bound, bound];
    }
    if (!values.length) return [0, 1];
    const lo = Math.floor(Math.min(...values) * 2) / 2;
    const hi = Math.ceil(Math.max(...values) * 2) / 2;
    return [lo, hi === lo ? lo + 0.5 : hi];
  }

  function mapScheme() {
    if (activePeriod === 'change') return d3.interpolateRdYlGn;
    const metricSchemes = manifestEntry?.mapColorSchemes || {};
    const schemeName = metricSchemes[activeMetric] || manifestEntry?.mapColorScheme;
    const stops = manifestEntry?.mapColorStops || (schemeName ? null : DEFAULT_MAP_COLOR_STOPS);
    const base = Array.isArray(stops) && stops.length >= 2
      ? d3.interpolateRgbBasis(stops)
      : (d3[schemeName] || d3.interpolateMagma);
    const curve = Number(manifestEntry?.mapColorCurve);
    const reverse = manifestEntry?.mapColorReverse === true;
    if (!Number.isFinite(curve) || curve <= 0 || curve === 1) {
      return t => base(reverse ? 1 - Math.max(0, Math.min(1, t)) : t);
    }
    return t => {
      const curved = Math.pow(Math.max(0, Math.min(1, t)), curve);
      return base(reverse ? 1 - curved : curved);
    };
  }

  function mapValueLabel() {
    const option = options.find(item => item.key === activeMetric);
    if (activePeriod === 'change') return 'Change (2025-2022)';
    const metric = (option?.label || pageData.dataTables?.title || pageData.title || regionTable?.title || 'Value') + (option?.noteRef || '');
    return metric + ' (' + activePeriod + ')';
  }

  function mapNotesHTML() {
    const option = options.find(item => item.key === activeMetric);
    const notes = [];
    const pageTitle = text(pageData?.title || pageData?.dataTables?.title || '').toLowerCase();
    const contextParts = [option?.label || '', option?.note || ''];
    const addNote = note => {
      const clean = text(note).trim();
      if (clean && !notes.some(existing => noteBody(existing) === noteBody(clean))) notes.push(clean);
    };
    if (option?.note) addNote(option.note);
    mapRows.filter(row => row.noteRef && row.note).forEach(row => {
      addNote(row.note);
    });
    const activeValues = mapRows
      .map(row => metricForPeriod(row.metrics?.[activeMetric], activePeriod).display)
      .map(value => text(value));
    tableFootnotes(pageData, regionTable).forEach(note => {
      const clean = text(note).trim();
      const body = noteBody(clean);
      const acronym = body.match(/^([A-Z][A-Za-z0-9-]*)\s*=/)?.[1]?.toUpperCase();
      const activeContext = contextParts.join(' ').toUpperCase();
      if (acronym && activeContext.includes(acronym)) addNote(clean);
      if (/vaccin/i.test(body) && /vaccin/i.test(pageTitle)) addNote(clean);
      if (/^"?0\.0"?\s+indicates/i.test(body) && activeValues.some(value => /(^|\s)0\.0(\s|$)/.test(value))) addNote(clean);
      if (/parentheses|25-49 unweighted/i.test(body) && activeValues.some(value => /^\(.+\)$/.test(value))) addNote(clean);
      if (/asterisk|fewer than 25|suppressed/i.test(body) && activeValues.some(value => value === '*')) addNote(clean);
    });
    tableNotes(pageData, regionTable).forEach(note => {
      const clean = text(note).trim();
      if (!isValueDependentNote(clean)) {
        addNote(clean);
        return;
      }
      if (/^["“]?NA["”]?\s+denotes/i.test(clean) && activeValues.some(value => /\bN\/?A\b/i.test(value))) addNote(clean);
      if (/^"?0\.0"?\s+indicates/i.test(clean) && activeValues.some(value => /(^|\s)0\.0(\s|$)/.test(value))) addNote(clean);
      if (/parentheses|25-49 unweighted/i.test(clean) && activeValues.some(value => /^\(.+\)$/.test(value))) addNote(clean);
      if (/asterisk|fewer than 25|suppressed/i.test(clean) && activeValues.some(value => value === '*')) addNote(clean);
    });
    const clean = notes.filter(Boolean);
    if (!clean.length) return '';
    return '<div class="section-head">Notes</div>' + clean.map(note => '<p class="map-note">' + note + '</p>').join('');
  }

  function colorForRow(row) {
    const metric = metricForPeriod(row?.metrics?.[activeMetric], activePeriod);
    if (metric.value == null) return 'var(--no-data-color)';
    return mapColorScale(metric.value);
  }

  function legendHTML() {
    const [lo, hi] = mapDomain();
    const stops = Array.from({ length: 24 }, (_, index) => mapColorScale(lo + (hi - lo) * index / 23)).join(',');
    return '<div class="section-head">' + mapValueLabel() + '</div>' +
      '<div class="legend-bar" style="background:linear-gradient(to right,' + stops + ')"></div>' +
      '<div class="legend-ends"><span>' + lo + '</span><span>' + hi + '</span></div>';
  }

  function rankedListHTML(activePsgc) {
    const rows = mapRows.map(row => ({ row, metric: metricForPeriod(row.metrics?.[activeMetric], activePeriod) })).filter(item => item.metric.value != null).sort((a, b) => b.metric.value - a.metric.value);
    const national = nationalMetric(pageData, activePeriod, options.find(item => item.key === activeMetric));
    const nationalHTML = national && national.value != null
      ? '<div class="ranked-row ranked-row-national"><span class="ranked-i">AVG</span><span class="ranked-swatch" style="background:' + mapColorScale(national.value) + '"></span><span class="ranked-name"><strong>National Average</strong></span><span class="ranked-val"><strong>' + national.display + '</strong></span></div>'
      : '';
    const body = rows.map((item, index) => {
      const active = String(item.row.psgc) === String(activePsgc);
      const name = nameRegistry[item.row.psgc] || item.row.label;
      const note = item.row.noteRef ? '<sup>' + item.row.noteRef + '</sup>' : '';
      return '<div class="ranked-row' + (active ? ' is-active' : '') + '"><span class="ranked-i">' + (index + 1) + '</span><span class="ranked-swatch" style="background:' + colorForRow(item.row) + '"></span><span class="ranked-name">' + name + note + '</span><span class="ranked-val">' + item.metric.display + '</span></div>';
    }).join('');
    return '<div class="section-head section-head-ranked">All Regions</div>' + nationalHTML + body;
  }

  function backToNationalHTML() {
    return '<button id="map-detail-back-national" class="map-detail-back-national">Back to national ranking</button>';
  }

  function openMapWelcome() {
    activeRegionPsgc = null;
    container.querySelector('#map-eyebrow').textContent = manifestEntry?.sectionTitle || 'Map';
    container.querySelector('#map-lgu-name').textContent = pageData?.title || pageData.dataTables?.title || 'Map';
    const description = manifestEntry?.description || pageData?.description || '';
    const desc = description ? '<p class="map-description">' + description + '</p>' : '';
    container.querySelector('#map-detail-body').innerHTML = desc + legendHTML() + rankedListHTML(null) + mapNotesHTML();
    detailEl.classList.add('open');
  }

  function openMapDetail(psgc) {
    activeRegionPsgc = psgc;
    const row = mapDataByRegion[String(psgc)];
    const metric = metricForPeriod(row?.metrics?.[activeMetric], activePeriod);
    const base = row?.metrics?.[activeMetric] || {};
    container.querySelector('#map-eyebrow').textContent = 'Region';
    container.querySelector('#map-lgu-name').textContent = nameRegistry[String(psgc)] || row?.label || 'Region';
    container.querySelector('#map-detail-body').innerHTML =
      '<div class="data-row"><span class="data-label">' + mapValueLabel() + '</span><span class="data-value">' + metric.display + '</span></div>' +
      '<div class="data-row"><span class="data-label">2025</span><span class="data-value">' + (base.display2025 || 'NA') + '</span></div>' +
      '<div class="data-row"><span class="data-label">2022</span><span class="data-value">' + (base.display2022 || 'NA') + '</span></div>' +
      legendHTML() + backToNationalHTML() + rankedListHTML(psgc) + mapNotesHTML();
    const backButton = container.querySelector('#map-detail-back-national');
    if (backButton) backButton.addEventListener('click', openMapWelcome);
    detailEl.classList.add('open');
  }

  function refreshMapColors() {
    mapColorScale = d3.scaleSequential(mapScheme()).domain(mapDomain());
    mapG.selectAll('path.region').transition().duration(180).style('fill', feature => colorForRow(mapDataByRegion[normalizePsgc(feature.properties.adm1_psgc)]));
    if (detailEl.classList.contains('open')) {
      if (activeRegionPsgc) openMapDetail(activeRegionPsgc);
      else openMapWelcome();
    }
  }

  function renderPeriodControls() {
    periodToggleEl.innerHTML = '';
    PERIODS.forEach(period => {
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'map-period';
      input.value = period.key;
      input.checked = period.key === activePeriod;
      input.addEventListener('change', () => {
        activePeriod = period.key;
        refreshMapColors();
      });
      label.appendChild(input);
      label.append(period.label);
      periodToggleEl.appendChild(label);
    });
  }

  function renderMetricControls() {
    metricToggleEl.innerHTML = '';
    container.classList.toggle('has-map-metrics', options.length > 1);
    if (options.length <= 1) {
      metricToggleEl.style.display = 'none';
      return;
    }
    metricToggleEl.style.display = 'flex';
    options.forEach(option => {
      const controlLabel = option.tabLabel || option.label;
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'map-metric';
      input.value = option.key;
      input.checked = option.key === activeMetric;
      input.addEventListener('change', () => {
        activeMetric = option.key;
        const select = metricToggleEl.querySelector('#metric-select');
        if (select) select.value = activeMetric;
        refreshMapColors();
      });
      label.appendChild(input);
      label.append(controlLabel);
      metricToggleEl.appendChild(label);
    });
    const selectWrap = document.createElement('div');
    selectWrap.id = 'metric-select-wrap';
    const select = document.createElement('select');
    select.id = 'metric-select';
    select.setAttribute('aria-label', 'Select map indicator');
    options.forEach(option => {
      const controlLabel = option.tabLabel || option.label;
      const optionEl = document.createElement('option');
      optionEl.value = option.key;
      optionEl.textContent = controlLabel;
      optionEl.selected = option.key === activeMetric;
      select.appendChild(optionEl);
    });
    select.addEventListener('change', () => {
      activeMetric = select.value;
      metricToggleEl.querySelectorAll('input[name="map-metric"]').forEach(input => {
        input.checked = input.value === activeMetric;
      });
      refreshMapColors();
    });
    selectWrap.appendChild(select);
    metricToggleEl.appendChild(selectWrap);
  }

  function drawMap() {
    const w = mapSvgEl.clientWidth || window.innerWidth;
    const h = mapSvgEl.clientHeight || window.innerHeight - 46;
    mapSvgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const pathFn = makePathFn(w, h);
    mapColorScale = d3.scaleSequential(mapScheme()).domain(mapDomain());
    mapG.selectAll('*').remove();
    mapG.selectAll('path.region')
      .data(countryFeatures)
      .join('path')
      .attr('class', 'region')
      .attr('d', pathFn)
      .style('fill', feature => colorForRow(mapDataByRegion[normalizePsgc(feature.properties.adm1_psgc)]))
      .on('click', (event, feature) => openMapDetail(normalizePsgc(feature.properties.adm1_psgc)))
      .attr('opacity', 0)
      .transition()
      .duration(300)
      .attr('opacity', 1);
    mapG.selectAll('text.map-label')
      .data(countryFeatures)
      .join('text')
      .attr('class', 'map-label')
      .attr('font-size', 10)
      .attr('stroke', 'rgba(255,255,255,0.55)')
      .attr('stroke-width', 1.4)
      .attr('stroke-linejoin', 'round')
      .attr('paint-order', 'stroke fill')
      .each(function(feature) {
        const centroid = pathFn.centroid(feature);
        if (!centroid || Number.isNaN(centroid[0]) || Number.isNaN(centroid[1])) return;
        d3.select(this).attr('x', centroid[0]).attr('y', centroid[1]).text(shortenRegion(feature.properties.adm1_en));
      });
  }

  renderPeriodControls();
  renderMetricControls();
  drawMap();
  statusEl.textContent = '18 regions - click to view details';
  container.querySelector('#map-info-btn').addEventListener('click', openMapWelcome);
  container.querySelector('#map-detail-close').addEventListener('click', () => detailEl.classList.remove('open'));
  window.addEventListener('resize', drawMap);
  if (window.matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => {
      detailEl.classList.add('peek');
      setTimeout(() => detailEl.classList.remove('peek'), 1600);
    }, 800);
  } else {
    openMapWelcome();
  }
}

