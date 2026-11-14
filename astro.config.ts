import { rehypeHeadingIds, unified } from '@astrojs/markdown-remark';
import sitemap from '@astrojs/sitemap';
import { pluginCollapsibleSections } from '@expressive-code/plugin-collapsible-sections';
import { pluginLineNumbers } from '@expressive-code/plugin-line-numbers';
import expressiveCode from 'astro-expressive-code';
import { defineConfig } from 'astro/config';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import remarkSmartypants from 'remark-smartypants';
import { carbonTheme, paperTheme } from './src/lib/code-themes';
import { pluginTerminalCopy } from './src/lib/ec-terminal-copy';
import { obsidian } from './src/lib/obsidian/integration';
import { rehypeObsidian } from './src/lib/obsidian/rehype';
import { remarkObsidian } from './src/lib/obsidian/remark';
import { site } from './src/site.config';

// https://docs.astro.build/en/reference/configuration-reference/
export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },

  i18n: {
    locales: ['en', 'de'],
    defaultLocale: 'en',
    routing: { prefixDefaultLocale: false },
  },

  markdown: {
    // Astro 7 defaults to the Sätteri processor. The Obsidian pipeline is
    // built from remark and rehype plugins, so the site stays on unified.
    processor: unified({
      // Smart punctuation runs last: file names inside [[wikilinks]] must reach
      // the link resolver with their straight quotes and hyphens intact.
      smartypants: false,
      // remark-smartypants ships looser types than Astro expects; the cast is type-only.
      remarkPlugins: [remarkMath, remarkObsidian, remarkSmartypants as unknown as typeof remarkMath],
      rehypePlugins: [rehypeHeadingIds, rehypeObsidian, rehypeKatex],
    }),
  },

  integrations: [
    expressiveCode({
      themes: [paperTheme, carbonTheme],
      // The site sets data-theme on <html> only when the reader overrides the
      // system setting, so both the attribute and the media query are needed.
      themeCssSelector: (theme) => `[data-theme='${theme.type}']`,
      useDarkModeMediaQuery: true,
      plugins: [pluginLineNumbers(), pluginCollapsibleSections(), pluginTerminalCopy()],
      defaultProps: { showLineNumbers: false },
      styleOverrides: {
        borderRadius: '0',
        borderWidth: '1px',
        borderColor: 'var(--rule)',
        codeBackground: 'var(--paper-2)',
        codeFontFamily: 'var(--font-mono)',
        codeFontSize: 'var(--text-code)',
        codeLineHeight: '1.6',
        codePaddingBlock: '1rem',
        codePaddingInline: '1rem',
        uiFontFamily: 'var(--font-mono)',
        uiFontSize: 'var(--text-meta)',
        focusBorder: 'var(--accent)',
        scrollbarThumbColor: 'var(--rule)',
        scrollbarThumbHoverColor: 'var(--ink-faint)',
        frames: {
          shadowColor: 'transparent',
          frameBoxShadowCssValue: 'none',
          editorBackground: 'var(--paper-2)',
          terminalBackground: 'var(--paper-2)',
          editorTabBarBackground: 'var(--paper-2)',
          editorActiveTabBackground: 'var(--paper-2)',
          editorActiveTabIndicatorTopColor: 'transparent',
          editorActiveTabIndicatorBottomColor: 'transparent',
          editorTabBarBorderBottomColor: 'var(--rule)',
          terminalTitlebarBackground: 'var(--paper-2)',
          terminalTitlebarBorderBottomColor: 'var(--rule)',
          terminalTitlebarForeground: 'var(--ink-muted)',
          terminalTitlebarDotsForeground: 'var(--ink-faint)',
          terminalTitlebarDotsOpacity: '0',
          tooltipSuccessBackground: 'var(--ink)',
          tooltipSuccessForeground: 'var(--paper)',
          inlineButtonBackground: 'var(--paper)',
          inlineButtonForeground: 'var(--ink-muted)',
          inlineButtonBorder: 'var(--rule-strong)',
        },
        textMarkers: {
          markBackground: 'color-mix(in srgb, var(--mark) 55%, transparent)',
          markBorderColor: 'var(--warning)',
          insBackground: 'color-mix(in srgb, var(--tip) 16%, transparent)',
          insBorderColor: 'var(--tip)',
          delBackground: 'color-mix(in srgb, var(--accent) 14%, transparent)',
          delBorderColor: 'var(--accent)',
        },
      },
    }),
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en', de: 'de' } },
      filter: (page) => !page.includes('/404'),
    }),
    obsidian({
      securityTxt: {
        site: site.url,
        contact: [site.links.linkedin, site.links.github],
        preferredLanguages: 'en, de',
      },
    }),
  ],

  image: {
    // Responsive srcset and sizes for images embedded from the vault.
    layout: 'constrained',
  },

  vite: {
    // Mermaid is one large chunk, loaded only on pages that have a diagram.
    build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
  },
});
