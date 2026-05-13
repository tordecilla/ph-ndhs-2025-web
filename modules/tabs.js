const TAB_LABELS = {
  map: 'Maps',
  charts: 'Charts',
  tables: 'Data Tables',
  insights: 'Insights',
};

const TAB_HASHES = {
  insights: 'tinsights',
};

const HASH_ALIASES = {
  tinsights: 'insights',
};

export function parseTabHash(validTabs, fallback) {
  const raw = String(location.hash || '').replace(/^#/, '');
  const child = raw.includes('--') ? raw.slice(raw.indexOf('--') + 2) : raw;
  const tab = HASH_ALIASES[child] || child;
  return validTabs.includes(tab) ? tab : fallback;
}

export function setupTabs({ tabs, onActivate }) {
  const tabBar = document.getElementById('tab-bar');
  const validTabs = tabs.map(tab => tab.id);
  const fallback = validTabs[0];
  let activeTab = null;

  tabBar.innerHTML = '';
  tabs.forEach(tab => {
    const button = document.createElement('button');
    button.className = 'tab-btn';
    button.dataset.tab = tab.id;
    button.textContent = tab.label || TAB_LABELS[tab.id] || tab.id;
    button.addEventListener('click', () => switchTab(tab.id));
    tabBar.appendChild(button);
  });

  function notifyParentHash(tab) {
    try { window.parent.postMessage({ type: 'child-hash', hash: tab }, '*'); } catch (error) {}
  }

  function switchTab(tab, replace = false) {
    activeTab = validTabs.includes(tab) ? tab : fallback;
    document.querySelectorAll('.tab-btn').forEach(button => {
      button.classList.toggle('active', button.dataset.tab === activeTab);
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-' + activeTab);
    });
    onActivate(activeTab);

    const nextHash = '#' + (TAB_HASHES[activeTab] || activeTab);
    if (location.hash !== nextHash) {
      if (replace) history.replaceState(null, '', nextHash);
      else history.pushState(null, '', nextHash);
    }
    notifyParentHash(activeTab);
  }

  window.addEventListener('hashchange', () => {
    switchTab(parseTabHash(validTabs, fallback), true);
  });

  switchTab(parseTabHash(validTabs, fallback), true);
}
