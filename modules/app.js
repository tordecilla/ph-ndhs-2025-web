import { canRenderCharts, renderCharts } from './charts.js';
import { canRenderDataTables, renderDataTables } from './data-tables.js';
import { el } from './dom.js';
import { canRenderInsights, renderInsights } from './insights.js';
import { loadManifest, manifestEntryForSlug, currentSlug } from './manifest.js';
import { canRenderMap, renderMap } from './maps.js';
import { setupTabs } from './tabs.js';

const TITLE_SUFFIX = ' | 2025 National Demographic and Health Survey';

async function loadInsightsData() {
  try {
    const response = await fetch('./insights.json', { cache: 'no-cache' });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function setStatus(message) {
  const active = document.querySelector('.tab-panel.active') || document.body;
  active.innerHTML = '';
  active.appendChild(el('div', 'status', message));
}

export async function initPage() {
  try {
    const [dataResponse, manifest, insightsData] = await Promise.all([
      fetch('./data.json', { cache: 'no-cache' }),
      loadManifest(),
      loadInsightsData(),
    ]);
    if (!dataResponse.ok) throw new Error('Unable to load data.json');
    const pageData = await dataResponse.json();
    if (insightsData) pageData.insights = insightsData.insights || insightsData;
    if (!pageData.dataTables || !Array.isArray(pageData.dataTables.tables)) throw new Error('Missing dataTables.tables');
    const slug = currentSlug();
    const manifestEntry = manifestEntryForSlug(manifest, slug);
    document.title = (manifestEntry?.title || pageData.title || pageData.dataTables.title || 'NDHS') + TITLE_SUFFIX;

    const availableTabs = [];
    if (canRenderMap(pageData)) {
      availableTabs.push({
        id: 'map',
        label: 'Maps',
        render: container => renderMap(container, pageData, manifestEntry),
      });
    }
    if (canRenderCharts(pageData, manifestEntry)) {
      availableTabs.push({
        id: 'charts',
        label: 'Charts',
        render: container => renderCharts(container, pageData, manifestEntry),
      });
    }
    if (canRenderDataTables(pageData)) {
      availableTabs.push({
        id: 'tables',
        label: 'Data Tables',
        render: container => renderDataTables(container, pageData, manifestEntry),
      });
    }
    if (canRenderInsights(pageData)) {
      availableTabs.push({
        id: 'insights',
        label: 'Insights',
        render: container => renderInsights(container, pageData, manifestEntry),
      });
    }
    const tabs = availableTabs;
    if (!tabs.length) throw new Error('No renderable tabs found');

    const rendered = new Set();
    setupTabs({
      tabs,
      onActivate(tabId) {
        if (rendered.has(tabId)) return;
        rendered.add(tabId);
        const tab = tabs.find(item => item.id === tabId);
        const container = document.getElementById('tab-' + tabId);
        tab.render(container);
      },
    });
  } catch (error) {
    setStatus(error.message);
  }
}
