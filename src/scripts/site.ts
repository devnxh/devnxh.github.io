/**
 * The script every page loads: theme toggle, email links, the mobile menu and
 * the shortcuts that open search. The search code itself is loaded on demand.
 */
type Theme = 'light' | 'dark' | 'system';

const root = document.documentElement;

// --- Theme -----------------------------------------------------------------

function currentTheme(): Theme {
  const value = root.dataset.theme;
  return value === 'light' || value === 'dark' ? value : 'system';
}

function reflectTheme(): void {
  const active = currentTheme();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-set]')) {
    button.setAttribute('aria-pressed', String(button.dataset.themeSet === active));
  }
}

function setTheme(theme: Theme): void {
  root.classList.add('theme-fade');
  if (theme === 'system') delete root.dataset.theme;
  else root.dataset.theme = theme;
  try {
    if (theme === 'system') localStorage.removeItem('theme');
    else localStorage.setItem('theme', theme);
  } catch {
    // Storage can be blocked. The theme still applies for this page view.
  }
  reflectTheme();
  document.dispatchEvent(new CustomEvent('themechange'));
  window.setTimeout(() => root.classList.remove('theme-fade'), 200);
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-theme-set]')) {
  button.addEventListener('click', () => setTheme(button.dataset.themeSet as Theme));
}
reflectTheme();

// --- Language: remember the choice, never redirect ---------------------------

for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-lang-switch]')) {
  link.addEventListener('click', () => {
    try {
      localStorage.setItem('lang', link.dataset.langSwitch ?? 'en');
    } catch {
      // Not essential.
    }
  });
}

// --- Email -------------------------------------------------------------------

const reverse = (value: string): string => [...value].reverse().join('');
for (const holder of document.querySelectorAll<HTMLElement>('.email')) {
  const address = `${reverse(holder.dataset.u ?? '')}@${reverse(holder.dataset.d ?? '')}`;
  const link = document.createElement('a');
  link.href = `mailto:${address}`;
  link.textContent = holder.dataset.label || address;
  holder.replaceChildren(link);
}

// --- Mobile menu -------------------------------------------------------------

const menu = document.querySelector<HTMLDetailsElement>('.menu');
if (menu) {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.open) {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
  });
}

// --- Search: `/`, Ctrl+K, Cmd+K or the header button -------------------------

async function openSearch(): Promise<void> {
  const { open } = await import('./search');
  open();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-search-open]')) {
  button.addEventListener('click', () => void openSearch());
}

document.addEventListener('keydown', (event) => {
  const target = event.target as HTMLElement | null;
  const typing = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;
  const slash = event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
  const commandK = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey);
  if (!slash && !commandK) return;
  event.preventDefault();
  void openSearch();
});

console.info('Curious how this site is built? The source is at https://github.com/devnxh/devnxh.github.io');
