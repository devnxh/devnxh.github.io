/**
 * Content collections. Each one reads a folder of the Obsidian vault.
 *
 * The schemas are forgiving on purpose: Obsidian leaves empty properties as
 * `null`, writes one tag as a string and many as a list, and nobody should have
 * a build fail over that. The build fails only when a value is present and
 * wrong, or when a write-up has no date. Astro prints the file and the field.
 */
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { vaultLoader } from './lib/obsidian/loader';

/** An optional value where Obsidian's empty property (`null`) counts as absent. */
const optional = <T extends z.ZodType>(schema: T) => schema.nullish().transform((value) => value ?? undefined);

/** `tags: windows`, `tags: [windows, smb]` and an empty `tags:` are all fine. */
const stringList = z.preprocess((value) => {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((item) => item != null).map(String);
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}, z.array(z.string()));

/** An enum that ignores case and surrounding spaces, with a message that lists the choices. */
const choice = <const T extends readonly [string, ...string[]]>(field: string, values: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
    z.enum(values, { error: `${field} must be one of: ${values.join(', ')}` }),
  );

const date = (field: string, required: boolean) =>
  z.coerce.date({
    error: required
      ? `${field} is required. Write it as YYYY-MM-DD, for example 2026-11-20.`
      : `${field} is not a date. Write it as YYYY-MM-DD, for example 2026-11-22.`,
  });

export const CATEGORIES = ['tryhackme', 'ctf', 'reverse-engineering', 'malware-analysis', 'tooling', 'notes'] as const;
export const DIFFICULTIES = ['easy', 'medium', 'hard', 'insane'] as const;
export const WRITEUP_STATUSES = ['solved', 'in-progress'] as const;
export const PROJECT_STATUSES = ['active', 'complete', 'archived'] as const;

const shared = {
  aliases: stringList,
  tags: stringList,
  /** `[[image.png]]` from the attachments folder. */
  cover: optional(z.string()),
  /** `true` keeps the note off the site. The file is still public in the repository. */
  draft: optional(z.boolean({ error: 'draft must be true or false' })).transform((value) => value ?? false),
  /** `machine` shows a "machine translated" note on the German page. Remove the field to remove the note. */
  translation: optional(choice('translation', ['machine'] as const)),
};

const writeups = defineCollection({
  loader: vaultLoader('writeups'),
  schema: z.object({
    ...shared,
    title: optional(z.string()),
    date: date('date', true),
    updated: optional(date('updated', false)),
    description: optional(z.string()),
    category: optional(choice('category', CATEGORIES)).transform((value) => value ?? 'notes'),
    platform: optional(z.string()),
    difficulty: optional(choice('difficulty', DIFFICULTIES)),
    status: optional(choice('status', WRITEUP_STATUSES)),
    tools: stringList,
    case: optional(z.number({ error: 'case must be a whole number, for example 7' }).int().positive()),
  }),
});

const projects = defineCollection({
  loader: vaultLoader('projects'),
  schema: z.object({
    ...shared,
    title: optional(z.string()),
    summary: optional(z.string()),
    period: optional(z.string()),
    /** Shown in index rows. Falls back to the last year found in `period`. */
    year: optional(z.coerce.string()),
    role: optional(z.string()),
    status: optional(choice('status', PROJECT_STATUSES)),
    stack: stringList,
    repo: optional(z.url({ error: 'repo must be a full URL starting with https://' })),
    demo: optional(z.url({ error: 'demo must be a full URL starting with https://' })),
    featured: optional(z.boolean({ error: 'featured must be true or false' })).transform((value) => value ?? false),
    order: optional(z.number({ error: 'order must be a number' })).transform((value) => value ?? 99),
    highlights: stringList,
  }),
});

const pages = defineCollection({
  loader: vaultLoader('pages'),
  schema: z.object({
    ...shared,
    title: optional(z.string()),
    description: optional(z.string()),
  }),
});

export const collections = { writeups, projects, pages };
