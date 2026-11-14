import { definePlugin } from 'astro-expressive-code';

const SHELL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'shellscript', 'zsh', 'console', 'powershell', 'ps', 'ps1', 'cmd', 'bat']);
// `$ ` and `> ` and PowerShell's `PS C:\path> `. A leading `#` is a comment, not a root prompt.
const PROMPT = /^\s*(?:\$|>|PS(?: [^>\n]*)?>)\s+/;

interface HastElement {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastElement[];
}

function findCopyButton(node: HastElement): HastElement | undefined {
  if (node.tagName === 'button' && typeof node.properties?.dataCode === 'string') return node;
  for (const child of node.children ?? []) {
    const found = findCopyButton(child);
    if (found) return found;
  }
  return undefined;
}

/**
 * Terminal blocks are written the way a session looks: `$ command` followed by
 * its output. The copy button should give the reader something they can paste,
 * so when a block has prompts, only the commands are copied, without the prompt.
 */
export function pluginTerminalCopy() {
  return definePlugin({
    name: 'Terminal copy without prompts',
    hooks: {
      postprocessRenderedBlock: ({ codeBlock, renderData }) => {
        if (!SHELL_LANGUAGES.has(codeBlock.language)) return;
        const lines = codeBlock.code.split('\n');
        if (!lines.some((line) => PROMPT.test(line))) return;
        const commands = lines.filter((line) => PROMPT.test(line)).map((line) => line.replace(PROMPT, ''));
        const button = findCopyButton(renderData.blockAst as unknown as HastElement);
        // Expressive Code stores the text to copy with line breaks encoded as U+007F.
        if (button?.properties) button.properties.dataCode = commands.join('\u007f');
      },
    },
  });
}
