/**
 * Syntax highlighting themes built from the site's design tokens, one for
 * "paper" and one for "carbon". Every token colour passes WCAG AA on the code
 * block background of its theme.
 */
interface Palette {
  type: 'light' | 'dark';
  name: string;
  paper: string;
  inset: string;
  ink: string;
  muted: string;
  faint: string;
  rule: string;
  accent: string;
  note: string;
  tip: string;
  warning: string;
  question: string;
  example: string;
  mark: string;
}

const paper: Palette = {
  type: 'light',
  name: 'case-notebook-paper',
  paper: '#F3EFE6',
  inset: '#E9E3D6',
  ink: '#1C1A16',
  muted: '#5A554C',
  faint: '#8A8476',
  rule: '#D6CEBD',
  accent: '#B4321E',
  note: '#2B5A86',
  tip: '#376440',
  warning: '#94540F',
  question: '#22605F',
  example: '#66476F',
  mark: '#F2DD6E',
};

const carbon: Palette = {
  type: 'dark',
  name: 'case-notebook-carbon',
  paper: '#151410',
  inset: '#1E1C17',
  ink: '#E8E2D4',
  muted: '#A69F90',
  faint: '#7A7466',
  rule: '#2F2C25',
  accent: '#EE6A4F',
  note: '#86AED6',
  tip: '#8DBE8F',
  warning: '#E3A35C',
  question: '#7EC2BE',
  example: '#C3A3CC',
  mark: '#4A4120',
};

function theme(p: Palette) {
  const scope = (scopes: string[], foreground: string, fontStyle?: string) => ({
    scope: scopes,
    settings: fontStyle ? { foreground, fontStyle } : { foreground },
  });
  return {
    name: p.name,
    type: p.type,
    colors: {
      'editor.background': p.inset,
      'editor.foreground': p.ink,
      'editorLineNumber.foreground': p.faint,
      'editor.selectionBackground': p.mark,
      'terminal.background': p.inset,
      'terminal.foreground': p.ink,
      'titleBar.activeBackground': p.inset,
      'titleBar.activeForeground': p.muted,
      'titleBar.border': p.rule,
      'editorGroupHeader.tabsBackground': p.inset,
      'editorGroupHeader.tabsBorder': p.rule,
      'tab.activeBackground': p.inset,
      'tab.activeForeground': p.muted,
      'tab.activeBorder': p.rule,
      'tab.activeBorderTop': p.rule,
      focusBorder: p.accent,
    },
    tokenColors: [
      scope(['comment', 'punctuation.definition.comment', 'string.comment'], p.muted, 'italic'),
      scope(['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.control', 'keyword.operator.new'], p.accent),
      scope(['string', 'string.quoted', 'string.template', 'punctuation.definition.string'], p.tip),
      scope(['constant.numeric', 'constant.language', 'constant.character', 'constant.other', 'support.constant'], p.warning),
      scope(['entity.name.function', 'support.function', 'meta.function-call', 'entity.name.command'], p.note),
      scope(['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], p.question),
      scope(['entity.name.tag', 'meta.tag', 'punctuation.definition.tag'], p.accent),
      scope(['entity.other.attribute-name', 'variable.parameter', 'meta.attribute'], p.example),
      scope(['variable', 'variable.other', 'meta.definition.variable', 'support.variable'], p.ink),
      scope(['punctuation', 'meta.brace', 'keyword.operator'], p.muted),
      scope(['markup.heading', 'entity.name.section'], p.accent, 'bold'),
      scope(['markup.inserted', 'meta.diff.header.to-file'], p.tip),
      scope(['markup.deleted', 'meta.diff.header.from-file'], p.accent),
      scope(['markup.changed', 'meta.diff.range'], p.note),
      scope(['markup.bold'], p.ink, 'bold'),
      scope(['markup.italic'], p.ink, 'italic'),
    ],
  };
}

export const paperTheme = theme(paper);
export const carbonTheme = theme(carbon);
