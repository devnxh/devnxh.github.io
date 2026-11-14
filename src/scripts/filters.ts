/**
 * Filters on the write-ups index. Every write-up is in the HTML; this script
 * only hides rows, so the page is complete without it.
 */
const active: Record<string, string> = { category: '', difficulty: '', tag: '' };
const rows = [...document.querySelectorAll<HTMLElement>('[data-writeup]')];
const groups = [...document.querySelectorAll<HTMLElement>('[data-year-group]')];
const empty = document.querySelector<HTMLElement>('[data-filter-empty]');

function apply(): void {
  for (const row of rows) {
    const tags = (row.dataset.tags ?? '').split(' ').filter(Boolean);
    const visible =
      (!active.category || row.dataset.category === active.category) &&
      (!active.difficulty || row.dataset.difficulty === active.difficulty) &&
      (!active.tag || tags.includes(active.tag));
    row.hidden = !visible;
  }
  for (const group of groups) {
    group.hidden = group.querySelectorAll('[data-writeup]:not([hidden])').length === 0;
  }
  if (empty) empty.hidden = rows.some((row) => !row.hidden);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-filter]')) {
  button.addEventListener('click', () => {
    const name = button.dataset.filter as string;
    active[name] = button.dataset.value ?? '';
    for (const sibling of document.querySelectorAll<HTMLButtonElement>(`[data-filter="${name}"]`)) {
      sibling.setAttribute('aria-pressed', String(sibling === button));
    }
    apply();
  });
}
