/**
 * The link graph and the build report, both derived from the vault index.
 *
 * The graph feeds "Linked from" sections, hover previews and (later) the graph
 * view. The report lists everything the build should warn about without
 * failing: unresolved links, missing attachments and undescribed images.
 */
import {
  findHeading,
  isHiddenFile,
  isVisible,
  resolveAttachment,
  resolveNote,
  resolveRelative,
  type Attachment,
  type Note,
  type NoteFile,
  type OutLink,
  type Vault,
} from './vault';

export interface ResolvedLink {
  note?: Note;
  attachment?: Attachment;
}

export function resolveOutLink(vault: Vault, file: NoteFile, link: OutLink): ResolvedLink {
  if (link.attachment) return { attachment: resolveAttachment(vault, link.path) };
  const note = /\.md$/i.test(link.path)
    ? resolveRelative(vault, link.path, file)
    : resolveNote(vault, link.path, file);
  return { note: note && isVisible(vault, note) ? note : undefined };
}

function visibleFiles(vault: Vault): NoteFile[] {
  return vault.files.filter((file) => vault.includeHidden || !isHiddenFile(file));
}

export interface LinkGraph {
  /** note id → ids it links to or embeds */
  outgoing: Map<string, Set<string>>;
  /** note id → ids that link to it */
  incoming: Map<string, Set<string>>;
}

export function buildGraph(vault: Vault): LinkGraph {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  for (const file of visibleFiles(vault)) {
    for (const link of file.links) {
      const target = resolveOutLink(vault, file, link).note;
      if (!target || target.id === file.id) continue;
      if (!outgoing.has(file.id)) outgoing.set(file.id, new Set());
      if (!incoming.has(target.id)) incoming.set(target.id, new Set());
      outgoing.get(file.id)?.add(target.id);
      incoming.get(target.id)?.add(file.id);
    }
  }
  return { outgoing, incoming };
}

/** Notes that link to `id`, as notes, sorted by title. */
export function backlinksOf(vault: Vault, graph: LinkGraph, id: string): Note[] {
  return [...(graph.incoming.get(id) ?? [])]
    .map((source) => vault.notes.get(source))
    .filter((note): note is Note => Boolean(note))
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Attachments that must be copied to the site because something links to them or embeds them without Astro's image pipeline. */
export function servedAttachments(vault: Vault): Attachment[] {
  const served = new Map<string, Attachment>();
  for (const file of visibleFiles(vault)) {
    for (const link of file.links) {
      if (!link.attachment) continue;
      const optimised = link.kind === 'embed' && link.attachment === 'image';
      const attachment = resolveAttachment(vault, link.path);
      if (attachment && !optimised) served.set(attachment.file, attachment);
    }
  }
  return [...served.values()];
}

export interface ReportEntry {
  file: string;
  target: string;
}

export interface BuildReport {
  unresolvedLinks: ReportEntry[];
  missingAnchors: ReportEntry[];
  missingAttachments: ReportEntry[];
  undescribedImages: ReportEntry[];
  slugCollisions: Array<{ id: string; files: string[] }>;
}

export function buildReport(vault: Vault): BuildReport {
  const report: BuildReport = {
    unresolvedLinks: [],
    missingAnchors: [],
    missingAttachments: [],
    undescribedImages: [],
    slugCollisions: vault.collisions,
  };

  for (const file of visibleFiles(vault)) {
    for (const link of file.links) {
      const entry = { file: `vault/${file.file}`, target: link.raw };
      const resolved = resolveOutLink(vault, file, link);
      if (link.attachment) {
        if (!resolved.attachment) report.missingAttachments.push(entry);
        else if (link.kind === 'embed' && link.attachment === 'image' && !link.described) {
          report.undescribedImages.push(entry);
        }
        continue;
      }
      if (!resolved.note) {
        report.unresolvedLinks.push(entry);
        continue;
      }
      const target = resolved.note.variants[file.lang] ?? resolved.note.variants.en;
      if (!target) continue;
      if (link.heading && !findHeading(target, link.heading)) report.missingAnchors.push(entry);
      if (link.block && !target.blockIds.includes(link.block)) report.missingAnchors.push(entry);
    }
  }
  return report;
}

export function reportCount(report: BuildReport): number {
  return (
    report.unresolvedLinks.length +
    report.missingAnchors.length +
    report.missingAttachments.length +
    report.undescribedImages.length +
    report.slugCollisions.length
  );
}

/** The warnings summary printed at the end of a build. Empty string when there is nothing to say. */
export function formatReport(report: BuildReport): string {
  if (reportCount(report) === 0) return '';
  const lines: string[] = [];
  const section = (title: string, entries: ReportEntry[]): void => {
    if (entries.length === 0) return;
    lines.push(`  ${title} (${entries.length})`);
    for (const entry of entries) lines.push(`    ${entry.file}  →  ${entry.target}`);
  };
  section('Unresolved links (rendered as plain text)', report.unresolvedLinks);
  section('Links to a heading or block that does not exist', report.missingAnchors);
  section('Missing attachments', report.missingAttachments);
  section('Images without alt text or a caption', report.undescribedImages);
  if (report.slugCollisions.length > 0) {
    lines.push(`  Notes that produce the same URL (${report.slugCollisions.length})`);
    for (const collision of report.slugCollisions) {
      lines.push(`    ${collision.id}  ←  ${collision.files.join(', ')}`);
    }
  }
  return ['Vault warnings (the build did not fail):', ...lines].join('\n');
}
