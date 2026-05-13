import { el } from './dom.js';

const INSIGHTS_SUBTITLE = 'AI-generated insights based on National Demographic and Health Survey data';

export function canRenderInsights(pageData) {
  const insights = pageData?.insights;
  return Boolean(
    insights &&
    (
      (Array.isArray(insights.sections) && insights.sections.length) ||
      (Array.isArray(insights.takeaways) && insights.takeaways.length)
    )
  );
}

export function renderInsights(container, pageData) {
  const insights = pageData.insights || {};
  container.innerHTML = '';

  const page = el('div', 'insights-page');
  const header = el('div', 'insights-header');
  header.appendChild(el('div', 'insights-page-title', pageData.title || 'Insights'));
  header.appendChild(el('div', 'insights-page-subtitle', INSIGHTS_SUBTITLE));
  page.appendChild(header);

  const article = el('article', 'insights-article');

  (insights.sections || []).forEach((section) => {
    const block = el('section', 'insight-card insight-section');
    if (section.heading) block.appendChild(el('h2', 'insight-heading', section.heading));
    block.appendChild(el('p', 'insight-text', section.body || ''));
    article.appendChild(block);
  });

  if (Array.isArray(insights.takeaways) && insights.takeaways.length) {
    const takeaways = el('aside', 'insight-card insight-takeaways-section');
    takeaways.appendChild(el('h2', 'insight-heading', 'Key Takeaways'));
    const list = el('div', 'insight-takeaways');
    insights.takeaways.forEach((item) => {
      list.appendChild(el('div', 'insight-takeaway', item));
    });
    takeaways.appendChild(list);
    article.appendChild(takeaways);
  }

  if (Array.isArray(insights.footnotes) && insights.footnotes.length) {
    const footnotes = el('footer', 'insight-footnotes');
    insights.footnotes.forEach((item) => {
      footnotes.appendChild(el('div', 'insight-footnote', item));
    });
    article.appendChild(footnotes);
  }

  page.appendChild(article);
  container.appendChild(page);
}
