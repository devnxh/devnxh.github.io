/**
 * Search UI on top of Pagefind's JavaScript API. Loaded when the dialog first
 * opens. Pagefind picks the index that matches the page's language.
 */
interface PagefindResult {
  data: () => Promise<{ url: string; excerpt: string; meta: Record<string, string> }>;
}
interface Pagefind {
  init: () => Promise<void>;
  debouncedSearch: (query: string, options?: object, wait?: number) => Promise<{ results: PagefindResult[] } | null>;
}

const dialog = document.getElementById('search') as HTMLDialogElement;
const input = document.getElementById('search-input') as HTMLInputElement;
const status = document.getElementById('search-status') as HTMLElement;
const list = document.getElementById('search-results') as HTMLUListElement;
const strings = JSON.parse(dialog.dataset.strings ?? '{}') as Record<string, string>;

let pagefind: Pagefind | undefined;
let unavailable = false;
let selected = -1;
let lastFocused: Element | null = null;

async function load(): Promise<void> {
  if (pagefind || unavailable) return;
  try {
    // The index exists only after a build, so the path is resolved at run time.
    const path = '/pagefind/pagefind.js';
    pagefind = (await import(/* @vite-ignore */ path)) as Pagefind;
    await pagefind.init();
  } catch {
    unavailable = true;
    status.textContent = strings.unavailable ?? '';
  }
}

function options(): HTMLAnchorElement[] {
  return [...list.querySelectorAll<HTMLAnchorElement>('a')];
}

function select(index: number): void {
  const items = options();
  if (items.length === 0) return;
  selected = (index + items.length) % items.length;
  items.forEach((item, position) => item.setAttribute('aria-selected', String(position === selected)));
  const active = items[selected];
  if (active) {
    input.setAttribute('aria-activedescendant', active.id);
    active.scrollIntoView({ block: 'nearest' });
  }
}

function label(url: string, meta: Record<string, string>): string {
  if (meta.case) return meta.case;
  if (/\/projects\/[^/]+\/$/.test(url)) return strings.project ?? '';
  return strings.page ?? '';
}

async function search(): Promise<void> {
  const query = input.value.trim();
  if (!query) {
    list.replaceChildren();
    status.textContent = '';
    input.setAttribute('aria-expanded', 'false');
    return;
  }
  await load();
  if (!pagefind) return;

  const response = await pagefind.debouncedSearch(query, {}, 120);
  if (response === null) return; // a newer keystroke took over
  const results = await Promise.all(response.results.slice(0, 12).map((result) => result.data()));

  list.replaceChildren(
    ...results.map((result, index) => {
      const item = document.createElement('li');
      item.setAttribute('role', 'presentation');
      const link = document.createElement('a');
      link.href = result.url;
      link.id = `search-result-${index}`;
      link.setAttribute('role', 'option');
      link.setAttribute('aria-selected', 'false');
      const kind = document.createElement('span');
      kind.className = 'label';
      kind.textContent = label(result.url, result.meta);
      const title = document.createElement('span');
      title.className = 'title';
      title.textContent = result.meta.title ?? result.url;
      const excerpt = document.createElement('span');
      excerpt.className = 'excerpt';
      // Pagefind escapes the page text and adds only <mark> around matches.
      excerpt.innerHTML = result.excerpt;
      link.append(kind, title, excerpt);
      item.append(link);
      return item;
    }),
  );
  input.setAttribute('aria-expanded', String(results.length > 0));
  selected = -1;
  if (results.length > 0) select(0);

  const total = response.results.length;
  status.textContent =
    total === 0
      ? (strings.none ?? '').replace('{q}', query)
      : total === 1
        ? (strings.one ?? '')
        : (strings.many ?? '').replace('{n}', String(total));
}

input.addEventListener('input', () => void search());

input.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    select(selected + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    select(selected - 1);
  } else if (event.key === 'Enter') {
    const active = options()[selected];
    if (active) {
      event.preventDefault();
      window.location.assign(active.href);
    }
  }
});

// A click on the backdrop closes the dialog.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

dialog.addEventListener('close', () => {
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
});

export function open(): void {
  if (dialog.open) return;
  lastFocused = document.activeElement;
  dialog.showModal();
  input.focus();
  input.select();
  void load();
}
