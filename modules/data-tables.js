import { displayCell, el, text } from './dom.js';
import { isPercentagePage } from './data-kind.js';

function appendLabelCell(rowEl, label, noteRef, tag = 'td') {
  const cell = document.createElement(tag);
  cell.textContent = text(label);
  if (noteRef) {
    const sup = document.createElement('sup');
    sup.textContent = noteRef;
    cell.appendChild(sup);
  }
  rowEl.appendChild(cell);
  return cell;
}

function tableRows(table) {
  if (Array.isArray(table.records) && table.records.length) {
    return table.records.map(record => ({
      label: record.label,
      noteRef: record.noteRef,
      note: record.note || record.psa_note || '',
      cells: record.cells || [],
    }));
  }
  return (table.rows || []).map(row => ({
    label: Array.isArray(row) ? row[0] : row.label,
    noteRef: Array.isArray(row) ? null : row.noteRef,
    note: Array.isArray(row) ? '' : (row.note || row.psa_note || ''),
    cells: Array.isArray(row) ? row.slice(1) : (row.cells || row.values || []),
  }));
}

function columnLabels(table) {
  if (Array.isArray(table.columns) && table.columns.length) return table.columns;
  if (Array.isArray(table.colGroups) && table.colGroups.length) {
    return [''].concat(table.colGroups.flatMap(group => (group.cols || []).map(col => ({
      label: col.label || col.key || '',
      noteRef: col.noteRef || null,
      groupLabel: col.groupLabel || '',
      groupNoteRef: col.groupNoteRef || null,
      year: group.label,
    }))));
  }
  const first = tableRows(table)[0];
  return [''].concat((first?.cells || []).map((_, index) => String(index + 1)));
}

function groupedYearColumns(columns) {
  const body = columns.slice(1);
  if (body.length && body.every(col => typeof col === 'object' && /^(2025|2022)$/.test(text(col.year)))) {
    const groups = [];
    body.forEach(col => {
      let group = groups[groups.length - 1];
      if (!group || group.year !== col.year) {
        group = { year: col.year, labels: [] };
        groups.push(group);
      }
      group.labels.push(col);
    });
    return groups;
  }
  if (!body.length || !body.every(col => /^(2025|2022)\b/.test(text(col)))) return null;
  if (!body.some(col => /^(2025|2022)\s+\S+/.test(text(col)))) return null;
  const groups = [];
  body.forEach(col => {
    const match = text(col).match(/^(2025|2022)\s*(.*)$/);
    const year = match[1];
    const label = match[2] || year;
    let group = groups[groups.length - 1];
    if (!group || group.year !== year) {
      group = { year, labels: [] };
      groups.push(group);
    }
    group.labels.push(label);
  });
  return groups;
}

function renderHeader(tableEl, columns) {
  const thead = tableEl.createTHead();
  const groups = groupedYearColumns(columns);
  if (!groups) {
    const row = thead.insertRow();
    columns.forEach((label, index) => {
      const th = document.createElement('th');
      th.textContent = text(typeof label === 'object' ? label.label : label);
      if (typeof label === 'object' && label.noteRef) {
        const sup = document.createElement('sup');
        sup.textContent = label.noteRef;
        th.appendChild(sup);
      }
      if (/^2022\b/.test(text(label)) || text(label) === '2022') th.classList.add('year-2022-head');
      if (index > 1 && (/^2022\b/.test(text(label)) || text(label) === '2022')) th.classList.add('year-boundary');
      row.appendChild(th);
    });
    return;
  }

  const hasSubGroups = groups.some(group => group.labels.some(label => typeof label === 'object' && (label.groupLabel || label.groupNoteRef)));
  const groupRow = thead.insertRow();
  const stub = document.createElement('th');
  stub.rowSpan = hasSubGroups ? 3 : 2;
  groupRow.appendChild(stub);
  groups.forEach(group => {
    const th = document.createElement('th');
    th.textContent = group.year;
    th.colSpan = group.labels.length;
    th.classList.add('col-group');
    if (group.year === '2022') th.classList.add('year-2022-head', 'year-boundary');
    groupRow.appendChild(th);
  });

  if (hasSubGroups) {
    const subGroupRow = thead.insertRow();
    subGroupRow.className = 'sub-header group-sub-header';
    groups.forEach(group => {
      let index = 0;
      while (index < group.labels.length) {
        const current = group.labels[index];
        const groupLabel = typeof current === 'object' ? (current.groupLabel || '') : '';
        const groupNoteRef = typeof current === 'object' ? (current.groupNoteRef || null) : null;
        let span = 1;
        while (index + span < group.labels.length) {
          const next = group.labels[index + span];
          const nextLabel = typeof next === 'object' ? (next.groupLabel || '') : '';
          const nextRef = typeof next === 'object' ? (next.groupNoteRef || null) : null;
          if (nextLabel !== groupLabel || nextRef !== groupNoteRef) break;
          span += 1;
        }
        const th = document.createElement('th');
        th.colSpan = span;
        th.textContent = groupLabel;
        if (groupNoteRef) {
          const sup = document.createElement('sup');
          sup.textContent = groupNoteRef;
          th.appendChild(sup);
        }
        if (group.year === '2022') th.classList.add('year-2022-head');
        if (group.year === '2022' && index === 0) th.classList.add('year-boundary');
        subGroupRow.appendChild(th);
        index += span;
      }
    });
  }

  const labelRow = thead.insertRow();
  labelRow.className = 'sub-header';
  groups.forEach(group => {
    group.labels.forEach((label, index) => {
      const th = document.createElement('th');
      th.textContent = text(typeof label === 'object' ? label.label : label);
      if (typeof label === 'object' && label.noteRef) {
        const sup = document.createElement('sup');
        sup.textContent = label.noteRef;
        th.appendChild(sup);
      }
      if (group.year === '2022') th.classList.add('year-2022-head');
      if (group.year === '2022' && index === 0) th.classList.add('year-boundary');
      labelRow.appendChild(th);
    });
  });
}

function renderNotesBlock(notes, source) {
  const cleanNotes = (notes || []).filter(Boolean).filter(note => !/^Source:/i.test(text(note)));
  if (!cleanNotes.length && !source) return null;
  const foot = el('div', 'dt-footnotes');
  cleanNotes.forEach(note => foot.appendChild(el('div', 'dt-note', note)));
  if (source) foot.appendChild(el('div', 'dt-source', 'Source: ' + source));
  return foot;
}

function collectNoteContext(tables) {
  const refs = new Set();
  const values = [];
  const labels = [];
  (tables || []).forEach(table => {
    columnLabels(table).forEach(column => {
      if (typeof column === 'object') {
        if (column.noteRef) refs.add(column.noteRef);
        if (column.groupNoteRef) refs.add(column.groupNoteRef);
        labels.push(column.label || '');
        labels.push(column.groupLabel || '');
      } else {
        labels.push(column);
      }
    });
    tableRows(table).forEach(row => {
      if (row.noteRef) refs.add(row.noteRef);
      labels.push(row.label || '');
      (row.cells || []).forEach(cell => values.push(text(displayCell(cell))));
    });
  });
  return { refs, values, labels };
}

function isRelevantSpecialNote(note, context) {
  const valueText = context.values.join(' ');
  const labelText = context.labels.join(' ').toLowerCase();
  if (/["“]?NA["”]?\s+denotes/i.test(note)) return /\bN\/?A\b/i.test(valueText);
  if (/^"?0\.0"?\s+indicates/i.test(note)) return /(^|\s)0\.0(\s|$)/.test(valueText);
  if (/fewer than 25|suppressed/i.test(note)) return /(^|\s)\*(\s|$)/.test(valueText);
  return true;
}

function relevantPageNotes(dataTables) {
  const context = collectNoteContext(dataTables?.tables || []);
  const footnotes = (dataTables?.footnotes || []).filter(note => {
    const clean = text(note).trim();
    const matchesRef = Array.from(context.refs).some(ref => clean.startsWith(ref));
    return matchesRef || isRelevantSpecialNote(clean, context);
  });
  const notes = (dataTables?.notes || []).filter(note => isRelevantSpecialNote(text(note).trim(), context));
  const explicitRowNotes = [];
  (dataTables?.tables || []).forEach(table => {
    tableRows(table).forEach(row => {
      const note = text(row.note).trim();
      if (note && !explicitRowNotes.includes(note)) explicitRowNotes.push(note);
    });
  });
  const comparable = note => text(note).trim().replace(/^[¹²³⁴⁵⁶⁷⁸⁹⁰]+\s*/, '');
  const existing = new Set([...footnotes, ...notes].map(comparable));
  return [...footnotes, ...notes, ...explicitRowNotes.filter(note => !existing.has(comparable(note)))];
}

function renderTableSection(sectionData, hideSectionSubtitle = false) {
  const section = el('section', 'dt-section');
  section.appendChild(el('h2', 'dt-section-title', sectionData.title || ''));
  if (sectionData.subtitle && !hideSectionSubtitle) section.appendChild(el('p', 'dt-section-subtitle', sectionData.subtitle));

  const table = document.createElement('table');
  const columns = columnLabels(sectionData);
  const dataColumnCount = Math.max(0, columns.length - 1);
  table.style.setProperty('--dt-data-cols', String(dataColumnCount));
  table.style.setProperty('--dt-table-min-width', `${210 + dataColumnCount * 68}px`);
  table.style.setProperty('--dt-table-mobile-min-width', `${180 + dataColumnCount * 58}px`);
  table.className = 'dt-table' + (groupedYearColumns(columns) ? ' dt-table-grouped' : (columns.length === 3 ? ' dt-table-year-pair' : ''));
  const colgroup = document.createElement('colgroup');
  const labelCol = document.createElement('col');
  labelCol.className = 'dt-label-col';
  colgroup.appendChild(labelCol);
  for (let index = 0; index < dataColumnCount; index += 1) {
    const col = document.createElement('col');
    col.className = 'dt-data-col';
    colgroup.appendChild(col);
  }
  table.appendChild(colgroup);
  renderHeader(table, columns);

  const tbody = table.createTBody();
  tableRows(sectionData).forEach(rowData => {
    const row = tbody.insertRow();
    appendLabelCell(row, rowData.label, rowData.noteRef);
    (rowData.cells || []).forEach((cellData, index) => {
      const cell = row.insertCell();
      const display = displayCell(cellData);
      cell.textContent = text(display);
      if (display == null || display === 'NA' || display === 'N/A') cell.classList.add('na');
      const column = columns[index + 1] || '';
      const columnYear = typeof column === 'object' ? column.year : text(column);
      const previousColumn = columns[index] || '';
      const previousYear = typeof previousColumn === 'object' ? previousColumn.year : text(previousColumn);
      if (/^2022\b/.test(text(columnYear)) || text(columnYear) === '2022') cell.classList.add('year-2022');
      if ((/^2022\b/.test(text(columnYear)) || text(columnYear) === '2022') && text(previousYear) !== '2022') cell.classList.add('year-boundary');
    });
  });

  const wrap = el('div', 'dt-table-wrap');
  wrap.appendChild(table);
  section.appendChild(wrap);
  const notesBlock = renderNotesBlock([...(sectionData.footnotes || []), ...(sectionData.notes || [])], null);
  if (notesBlock) section.appendChild(notesBlock);
  return section;
}

export function canRenderDataTables(pageData) {
  return Array.isArray(pageData?.dataTables?.tables) && pageData.dataTables.tables.length > 0;
}

export function renderDataTables(container, pageData, manifestEntry = null) {
  const dataTables = pageData.dataTables;
  container.innerHTML = '';
  const page = el('main', 'tables-page');
  const header = el('header', 'page-header');
  header.appendChild(el('h1', 'page-title', dataTables.title || pageData.title || ''));
  const hideSectionSubtitles = isPercentagePage(pageData, manifestEntry);
  const subtitle = dataTables.subtitle || pageData.subtitle || '';
  if (subtitle) header.appendChild(el('p', 'page-subtitle', subtitle));
  page.appendChild(header);
  const tables = el('div', 'tables');
  let currentGroupTitle = null;
  dataTables.tables.forEach(table => {
    if (table.groupTitle && table.groupTitle !== currentGroupTitle) {
      currentGroupTitle = table.groupTitle;
      tables.appendChild(el('h2', 'dt-group-title', table.groupTitle));
    }
    tables.appendChild(renderTableSection(table, hideSectionSubtitles));
  });
  const footnotes = renderNotesBlock(relevantPageNotes(dataTables), dataTables.source);
  if (footnotes) tables.appendChild(footnotes);
  page.appendChild(tables);
  container.appendChild(page);
}
