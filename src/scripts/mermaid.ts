/**
 * Renders Mermaid code blocks as diagrams, themed from the site's tokens, and
 * renders them again when the reader switches theme. This module is a separate
 * chunk: pages without a diagram never download Mermaid.
 */
import mermaid from 'mermaid';

function token(name: string): string {
  // light-dark() values are resolved by the browser when read from a real property.
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  probe.style.display = 'none';
  document.body.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

function configure(): void {
  const fonts = getComputedStyle(document.documentElement);
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: fonts.getPropertyValue('--font-mono'),
    themeVariables: {
      background: token('--paper'),
      primaryColor: token('--paper-2'),
      primaryTextColor: token('--ink'),
      primaryBorderColor: token('--rule-strong'),
      secondaryColor: token('--paper'),
      tertiaryColor: token('--paper'),
      lineColor: token('--ink-muted'),
      textColor: token('--ink'),
      mainBkg: token('--paper-2'),
      nodeBorder: token('--rule-strong'),
      clusterBkg: token('--paper'),
      clusterBorder: token('--rule'),
      edgeLabelBackground: token('--paper'),
      noteBkgColor: token('--paper-2'),
      noteTextColor: token('--ink'),
      noteBorderColor: token('--rule-strong'),
      actorBkg: token('--paper-2'),
      actorBorder: token('--rule-strong'),
      signalColor: token('--ink-muted'),
      fontSize: '15px',
    },
  });
}

let run = 0;

export async function renderDiagrams(): Promise<void> {
  configure();
  run += 1;
  const sources = [...document.querySelectorAll<HTMLElement>('[data-mermaid]')];
  await Promise.all(
    sources.map(async (source, index) => {
      const figure = source.parentElement;
      if (!figure) return;
      try {
        const { svg } = await mermaid.render(`diagram-${run}-${index}`, source.textContent ?? '');
        let output = figure.querySelector<HTMLElement>('.mermaid-output');
        if (!output) {
          output = document.createElement('div');
          output.className = 'mermaid-output';
          figure.append(output);
        }
        output.innerHTML = svg;
        source.hidden = true;
      } catch {
        // A diagram with a syntax error stays visible as its source text.
        source.hidden = false;
      }
    }),
  );
}

document.addEventListener('themechange', () => void renderDiagrams());
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => void renderDiagrams());
