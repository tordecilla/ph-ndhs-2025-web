function includesPercentageLanguage(value) {
  return /\b(percent|percentage|share)\b/i.test(String(value || ''));
}

function includesNonPercentageRateLanguage(value) {
  return /\b(rate|rates|births per|children ever born|total fertility)\b/i.test(String(value || ''));
}

export function isPercentagePage(pageData, manifestEntry = null) {
  const dataTables = pageData?.dataTables || {};
  const metadata = [
    pageData?.title,
    pageData?.description,
    pageData?.subtitle,
    dataTables.title,
    dataTables.subtitle,
    manifestEntry?.description,
    manifestEntry?.dataTableSubtitle,
    manifestEntry?.chartSubtitle,
  ].filter(Boolean).join(' ');
  if (includesNonPercentageRateLanguage(metadata)) return false;
  return includesPercentageLanguage(metadata);
}
