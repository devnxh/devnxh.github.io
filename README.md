# devnxh.github.io

Portfolio and security write-ups of Devansh Vadher, at <https://devnxh.github.io>.

The site is static, built with [Astro](https://astro.build) and hosted on GitHub Pages. Its content is an [Obsidian](https://obsidian.md) vault in this repository. Write a note in Obsidian, push the `.md` file, and about two minutes later the note is on the site, rendered the way Obsidian shows it.

- [How it works](#how-it-works)
- [Run it on your computer](#run-it-on-your-computer)
- [Write and publish](#write-and-publish)
- [What Obsidian syntax is supported](#what-obsidian-syntax-is-supported)
- [Frontmatter reference](#frontmatter-reference)
- [Translations](#translations)
- [Images, CV and photo](#images-cv-and-photo)
- [Deploying](#deploying)
- [Troubleshooting](#troubleshooting)
- [Project layout](#project-layout)

## How it works

```
vault/                  ← open this folder in Obsidian
  writeups/             one .md per write-up (plus an optional <name>.de.md)
  projects/             one .md per project (plus <name>.de.md)
  pages/                about.md, about.de.md
  attachments/          images, PDFs, audio and video used with ![[...]]
  templates/            Obsidian templates, never built
src/
  site.config.ts        every personal fact, link and feature flag
  content.config.ts     the three content collections and their schemas
  i18n/                 interface strings in English and German
  lib/obsidian/         the Markdown plugins, the vault index and their tests
  components/ layouts/ pages/ styles/ scripts/
.github/workflows/deploy.yml
```

Astro 7 renders Markdown through its unified (remark and rehype) pipeline. `src/lib/obsidian/` adds what Obsidian has and standard Markdown lacks: wikilinks with Obsidian's link resolution, embeds, note transclusion, callouts, highlights, comments, tags, block IDs and inline footnotes. A vault index reads every note once, resolves links between them, and feeds backlinks, tag pages, hover previews and the build warnings.

There is no UI framework and no CSS framework. Styles are hand-written CSS with custom properties and cascade layers. The small amount of JavaScript is plain TypeScript: theme toggle, search, image zoom, link previews, filters.

## Run it on your computer

You need [Node.js](https://nodejs.org) 22.23 or newer and [Git](https://git-scm.com).

```bash
git clone https://github.com/devnxh/devnxh.github.io.git
```

```bash
cd devnxh.github.io
```

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:4321>. The page reloads when you save a note.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local site with live reload. Drafts and `_` files are visible here. |
| `npm run build` | Builds the site into `dist/` and creates the search index. |
| `npm run preview` | Serves the built `dist/` folder, including search. |
| `npm run check` | Type check. Fails if a German interface string is missing. |
| `npm test` | Tests for the Markdown plugins. |
| `npm run images` | Processes raw AI images (see [Images](#images-cv-and-photo)). |

Search needs a build. In `npm run dev` the search dialog says so; use `npm run build` and then `npm run preview` to try it.

## Write and publish

### 1. Set up Obsidian once

1. Open Obsidian, choose **Open folder as vault**, and pick the `vault` folder of this repository.
2. The settings below are already stored in `vault/.obsidian/` and load by themselves. If Obsidian asks, or if you want to check them:
   - **Settings → Files and links → Use [[Wikilinks]]**: on.
   - **Settings → Files and links → New link format**: *Shortest path when possible*.
   - **Settings → Files and links → Default location for new attachments**: *In the folder specified below*, folder `attachments`.
   - **Settings → Core plugins → Templates**: on. **Settings → Templates → Template folder location**: `templates`.

### 2. Write a note

1. Create a note in `writeups/`. The file name becomes the title and the URL: `TryHackMe Blue.md` is published at `/writeups/tryhackme-blue/`.
2. Insert the template: open the command palette (`Ctrl+P`), run **Templates: Insert template**, choose **Write-up**.
3. Fill in the properties at the top. Only `date` is required.
4. Write. Paste screenshots straight into the note; Obsidian saves them in `attachments/`.

A new note from the template starts with `draft: true`. Set it to `false` when the note is ready.

### 3. Publish

Publishing means pushing your changes to the `main` branch on GitHub. Pick whichever way suits you.

**A. Obsidian Git (inside Obsidian)**

1. **Settings → Community plugins → Browse**, install **Git** (by Vinzent03) and enable it.
2. Open the command palette and run **Git: Commit-and-sync**.

The plugin needs the repository root, which is one level above `vault/`. If it reports that it cannot find a repository, set **Settings → Git → Custom base path** to `..`.

**B. GitHub Desktop**

1. Open [GitHub Desktop](https://desktop.github.com) and add this repository.
2. Your changed notes appear on the left. Write a short summary, click **Commit to main**, then **Push origin**.

**C. Upload on github.com**

1. Open the repository on github.com and go to `vault/writeups/`.
2. **Add file → Upload files**, drag your `.md` file in, **Commit changes**.
3. Do the same in `vault/attachments/` for any images the note uses.

After the push, open the **Actions** tab of the repository. When the run named *Deploy to GitHub Pages* has a green tick, the note is live.

### Drafts and private notes

- `draft: true` keeps a note off the site. **The file is still public in this repository.** Anyone can read it on GitHub.
- A file or folder whose name starts with `_` is never published either, and is also public in the repository. `vault/writeups/_syntax-test.md` is such a file.
- For notes nobody should see, use the folder `vault/_private/`. Git ignores it, so its content never leaves your computer.

## What Obsidian syntax is supported

`vault/writeups/_syntax-test.md` uses every item below. Run `npm run dev` and open <http://localhost:4321/writeups/syntax-test/> to see them all.

| Syntax | Result |
| --- | --- |
| `[[Note]]`, `[[Note\|alias]]`, `[[Note#Heading]]`, `[[Note#^block]]` | Links. Matching ignores case, finds notes by file name anywhere in the vault, and also matches frontmatter `aliases`. |
| `[text](../projects/Note.md)` | Ordinary Markdown links to notes work too. |
| A link to a note that does not exist | Muted text with a dashed underline, never a broken link. Listed in the build warnings. |
| `![[image.png]]`, `![[image.png\|400]]`, `![[image.png\|400x300]]`, `![[image.png\|A caption]]` | Optimised, responsive images. A caption is also used as the alt text. Click to enlarge. |
| `![[file.pdf]]`, `![[clip.mp4]]`, `![[audio.mp3]]` | An embedded PDF viewer with a download link, a video player, an audio player. |
| `![[Note]]`, `![[Note#Heading]]`, `![[Note#^block]]` | The note, section or block is shown in place, with a link to its source. Embeds nest two levels deep. |
| `> [!note]`, `> [!warning] Title`, `> [!tip]- Folded` | Callouts, with every Obsidian type and alias, custom titles, folding and nesting. |
| `> [!flag]` or `> [!spoiler]` | A redaction bar that reveals its content when selected. Use it for CTF flags. |
| `==highlight==`, `~~strike~~`, `- [ ]` tasks, tables, footnotes, `^[inline footnotes]` | As in Obsidian. Footnotes sit in the margin on wide screens. |
| `%%comment%%` | Removed completely, inline or across several lines. |
| `#tag`, `#nested/tag` | Linked to tag pages, together with the `tags` property. |
| `$inline$` and `$$block$$` | Maths with KaTeX. |
| ` ```mermaid ` | Diagrams, themed like the site. |
| Code blocks | Syntax highlighting, a copy button, a terminal frame for shell languages, `title="..."`, line markers `{1,4-6}`, `ins=` and `del=`. |
| `---` | A divider. |

**Not supported:** syntax from community plugins, such as Dataview queries, Excalidraw drawings and Canvas files. Export those as images and embed the image.

## Frontmatter reference

Obsidian calls these *Properties*. They are never shown as text.

**Write-ups** (`vault/writeups/`). Only `date` is required.

```yaml
---
title: "TryHackMe: Blue"        # defaults to the file name
date: 2026-11-20                 # required
updated: 2026-11-22
description: "One sentence for lists, previews and search."   # defaults to the first paragraph
category: tryhackme              # tryhackme | ctf | reverse-engineering | malware-analysis | tooling | notes
platform: TryHackMe
difficulty: easy                 # easy | medium | hard | insane
status: solved                   # solved | in-progress
tools: [nmap, metasploit]
tags: [windows, smb]
cover: "[[blue-cover.png]]"
aliases: []
case: 7                          # otherwise numbered by date
draft: false
---
```

**Projects** (`vault/projects/`)

```yaml
---
title: PE-Sentinel
summary: "Python CLI that triages Windows executables without running them."
period: "Jul–Sep 2026"
role: "Solo project"
status: active                   # active | complete | archived
stack: [Python, pefile, yara-python, pytest]
repo: https://github.com/devnxh/PE-Sentinel
demo:
featured: true
order: 1
cover: "[[cover-pe-sentinel.png]]"
highlights:
  - "Flags about 40 commonly abused Windows APIs"
---
```

Facts that appear outside a note (name, links, the status line, the toolbox on Home) live in [`src/site.config.ts`](src/site.config.ts).

## Translations

The site is in English at `/` and in German at `/de/`.

- **Write-ups:** write in English. To add a German version, create a second file next to it with `.de` before the extension: `Blue.md` and `Blue.de.md`. Without a German file, `/de/writeups/blue/` shows the English text inside the German page, with a note that the post exists in English only.
- **Projects and About:** the German files (`PE-Sentinel.de.md`, `about.de.md`) carry `translation: machine` in their frontmatter, which shows the note "Maschinell übersetzt · Original auf Englisch". When a native speaker has reviewed a file, delete that line and the note disappears.
- A German file needs only the properties that differ. Dates, stack, repository and order are taken from the English file.
- **Interface strings** (menu, labels, buttons) are in [`src/i18n/ui.ts`](src/i18n/ui.ts). `npm run check` fails if a key exists in English and not in German.

## Images, CV and photo

- **Images in notes:** paste them into Obsidian. They are stored in `vault/attachments/` and embedded as `![[name.png]]`. Give each image a caption (`![[name.png|What it shows]]`); the build warns about images without one.
- **CV:** save it as `public/cv/Devansh_Vadher_CV.pdf`. The "Download CV" buttons appear only when that file exists.
- **Photo:** optional. Save it as `public/me.jpg` and it appears on About, in greyscale.
- **Project covers:** without a cover, a project shows a hex-dump placeholder. To use a photograph:
  1. Put the raw image in `assets-src/higgsfield/`, named like `cover-pe-sentinel.png`.
  2. Run `npm run images`. It writes a greyscale copy to `vault/attachments/`.
  3. Add `cover: "[[cover-pe-sentinel.png]]"` to the project note.
- **Favicon:** drawn in code. Change `scripts/generate-icons.ts` and run `node scripts/generate-icons.ts`.

## Deploying

One-time setup on GitHub:

1. Create a public repository named exactly `devnxh.github.io`.
2. Push this project to its `main` branch.
3. In the repository, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**.

From then on, every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): install, type check, tests, build, search index, deploy. You can also start it by hand under **Actions → Deploy to GitHub Pages → Run workflow**.

## Troubleshooting

**The Action failed.** Open **Actions**, click the failed run, then the red step.

| Step that failed | Usual cause | Fix |
| --- | --- | --- |
| Build the site | Invalid frontmatter. The log names the file and the field, for example `writeups → Blue: date is required`. | Correct the property in that note and push again. |
| Type check | A string was added to `en` in `src/i18n/ui.ts` and not to `de`. | Add the German string. |
| Run the Markdown plugin tests | A change in `src/lib/obsidian/` broke a test. | Run `npm test` locally to see which. |

**The build passed but printed "Vault warnings".** These never fail a build. They list links to notes that do not exist, missing attachments and images without a caption. Fix them when you can.

**A link shows as plain dashed text.** The target note does not exist, is a draft, or starts with `_`. Check the spelling of the file name.

**A note does not appear on the site.** Check that `draft` is not `true`, that the file name does not start with `_`, that the file is in `vault/writeups/` or `vault/projects/`, and that the Action finished.

**An image does not show.** The file must be inside `vault/` and must have been pushed along with the note.

**The site looks different from Obsidian.** Community-plugin syntax is not rendered. See [what is supported](#what-obsidian-syntax-is-supported).

**Local changes to a plugin do not show.** Astro caches rendered notes. Stop the dev server and start it again; if that is not enough, run `npx astro dev --force`.

## Project layout

- [`src/lib/obsidian/vault.ts`](src/lib/obsidian/vault.ts): reads the vault and resolves links the way Obsidian does.
- [`src/lib/obsidian/graph.ts`](src/lib/obsidian/graph.ts): backlinks and the build warnings.
- [`src/lib/obsidian/remark/`](src/lib/obsidian/remark): the Markdown transforms, one concern per file.
- [`src/lib/obsidian/rehype.ts`](src/lib/obsidian/rehype.ts): contents list, hex offsets, sidenotes, scrollable tables.
- [`src/lib/obsidian/obsidian.test.ts`](src/lib/obsidian/obsidian.test.ts): tests, run against a small fixture vault.
- [`src/styles/tokens.css`](src/styles/tokens.css): colours, type scale and spacing for the light "paper" and dark "carbon" themes.

Set in Newsreader and IBM Plex Mono, both self-hosted.
