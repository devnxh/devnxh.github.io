/**
 * Behaviour for rendered notes: image zoom, a wrap toggle on code blocks,
 * hover previews of internal links, the contents list, and Mermaid diagrams.
 * Everything here is an enhancement; the page reads fine without it.
 */
const prose = document.querySelector<HTMLElement>('.prose');
const strings = JSON.parse(prose?.dataset.strings ?? '{}') as Record<string, string>;

// --- Click an image to enlarge it in a native dialog ---------------------------

const zoom = document.getElementById('zoom') as HTMLDialogElement | null;
const zoomImage = zoom?.querySelector('img');
if (zoom && zoomImage) {
  for (const image of document.querySelectorAll<HTMLImageElement>('.prose figure[data-zoom] img')) {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `${strings.zoom ?? 'Enlarge image'}${image.alt ? `: ${image.alt}` : ''}`);
    const show = (): void => {
      zoomImage.src = image.currentSrc || image.src;
      zoomImage.alt = image.alt;
      zoom.showModal();
    };
    image.addEventListener('click', show);
    image.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        show();
      }
    });
  }
  zoom.addEventListener('click', (event) => {
    if (event.target === zoom || event.target === zoomImage) zoom.close();
  });
}

// --- Wrap toggle on code blocks ---------------------------------------------------

for (const block of document.querySelectorAll<HTMLElement>('.prose .expressive-code')) {
  const pre = block.querySelector('pre');
  if (!pre || pre.scrollWidth <= pre.clientWidth) continue;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'code-wrap-toggle';
  button.textContent = strings.wrap ?? 'Wrap';
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const wrapped = pre.classList.toggle('wrap');
    button.setAttribute('aria-pressed', String(wrapped));
  });
  block.append(button);
}

// --- Contents: open on wide screens, mark the section being read -----------------

const toc = document.querySelector<HTMLDetailsElement>('.toc');
if (toc) {
  const wide = window.matchMedia('(min-width: 80rem)');
  const sync = (): void => {
    if (wide.matches) toc.open = true;
  };
  sync();
  wide.addEventListener('change', sync);

  const links = new Map<string, HTMLAnchorElement>();
  for (const link of toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    links.set(decodeURIComponent(link.hash.slice(1)), link);
  }
  const headings = [...links.keys()].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
  if (headings.length > 0 && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      () => {
        const passed = headings.filter((heading) => heading.getBoundingClientRect().top < window.innerHeight * 0.3);
        const current = passed.at(-1) ?? headings[0];
        for (const [id, link] of links) {
          if (id === current?.id) link.setAttribute('aria-current', 'true');
          else link.removeAttribute('aria-current');
        }
      },
      { rootMargin: '0px 0px -70% 0px', threshold: [0, 1] },
    );
    for (const heading of headings) observer.observe(heading);
  }
}

// --- Hover and focus previews of internal links (wide pointers only) -----------------

const canHover = window.matchMedia('(hover: hover) and (min-width: 64rem)').matches;
const previewLinks = canHover ? [...document.querySelectorAll<HTMLAnchorElement>('.prose a[data-wl]')] : [];
if (previewLinks.length > 0) {
  type Index = Record<string, { title: string; excerpt: string; label: string }>;
  let index: Promise<Index> | undefined;
  let timer: number | undefined;
  let popover: HTMLElement | undefined;

  const loadIndex = (): Promise<Index> => {
    index ??= fetch(prose?.dataset.linkIndex ?? '/link-index.json')
      .then((response) => (response.ok ? (response.json() as Promise<Index>) : {}))
      .catch(() => ({}));
    return index;
  };
  const hide = (): void => {
    window.clearTimeout(timer);
    popover?.remove();
    popover = undefined;
  };
  const show = async (link: HTMLAnchorElement): Promise<void> => {
    const entry = (await loadIndex())[new URL(link.href).pathname];
    if (!entry || !link.matches(':hover, :focus-visible')) return;
    hide();
    popover = document.createElement('div');
    popover.className = 'preview';
    popover.setAttribute('role', 'tooltip');
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = entry.label;
    const title = document.createElement('strong');
    title.textContent = entry.title;
    const excerpt = document.createElement('span');
    excerpt.textContent = entry.excerpt;
    popover.append(label, title, excerpt);
    document.body.append(popover);
    const rect = link.getBoundingClientRect();
    const left = Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - popover.offsetWidth - 16);
    popover.style.left = `${Math.max(16, left)}px`;
    popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  };
  for (const link of previewLinks) {
    const start = (): void => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void show(link), 300);
    };
    link.addEventListener('mouseenter', start);
    link.addEventListener('focus', start);
    link.addEventListener('mouseleave', hide);
    link.addEventListener('blur', hide);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hide();
  });
}

// --- Mermaid: loaded only when the page has a diagram -----------------------------

const diagrams = [...document.querySelectorAll<HTMLElement>('[data-mermaid]')];
if (diagrams.length > 0) {
  const loadMermaid = (): void => void import('./mermaid').then(({ renderDiagrams }) => renderDiagrams());
  if ('IntersectionObserver' in window) {
    // Mermaid is large. It is fetched when a diagram is about to scroll into view,
    // so it never competes with the first render of the page.
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        loadMermaid();
      },
      { rootMargin: '400px 0px' },
    );
    for (const diagram of diagrams) observer.observe(diagram.parentElement ?? diagram);
  } else {
    loadMermaid();
  }
}
