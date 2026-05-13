export function text(value) {
  return value == null ? '' : String(value);
}

export function el(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

export function displayCell(cell) {
  if (cell && typeof cell === 'object') return cell.display ?? cell.value ?? 'NA';
  return cell ?? 'NA';
}
