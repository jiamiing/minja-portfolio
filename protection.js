// Discourage ordinary copying/saving while keeping forms and keyboard navigation usable.
export function initProtection() {
  const editable = (target) =>
    target instanceof Element &&
    !!target.closest('input,textarea,[contenteditable="true"],[contenteditable=""]');
  document.addEventListener('contextmenu', (event) => event.preventDefault(), { capture: true });
  for (const type of ['copy', 'cut', 'selectstart', 'dragstart'])
    document.addEventListener(
      type,
      (event) => {
        if (!editable(event.target)) event.preventDefault();
      },
      { capture: true },
    );
  document.addEventListener(
    'keydown',
    (event) => {
      if (editable(event.target) || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      if (['s', 'c', 'x', 'a'].includes(event.key.toLowerCase())) event.preventDefault();
    },
    { capture: true },
  );
  document.documentElement.classList.add('content-protected');
}
