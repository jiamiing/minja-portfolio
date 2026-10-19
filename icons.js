// Draw interface marks as vectors; never delegate their appearance to emoji fonts.
const paths = {
  'arrow-up-right': 'M5 19 19 5M5 5h14v14',
  'arrow-right': 'M4 12h16M13 5l7 7-7 7',
  'arrow-left': 'M20 12H4M11 5l-7 7 7 7',
  'arrow-up': 'M12 20V4M5 11l7-7 7 7',
  'arrow-down': 'M12 4v16M5 13l7 7 7-7',
  'arrows-horizontal': 'M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4',
  'chevron-down': 'm5 9 7 7 7-7',
  plus: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M6 18 18 6',
};
export function icon(name) {
  const shape =
    name === 'dot'
      ? '<circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none"/>'
      : `<path d="${paths[name] || paths['arrow-up-right']}"/>`;
  return `<svg class="ui-icon icon-${name}" width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${shape}</svg>`;
}
