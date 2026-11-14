---
title: "Building PE-Sentinel"
date: 2026-11-14
description: "TODO: one sentence for cards, previews and search results."
category: tooling
platform: Own tooling
status: in-progress
tools: [python, pefile, yara-python, pytest]
tags: [pe, static-analysis, yara]
draft: true
---

> [!todo] This is a draft
> `draft: true` keeps it off the site. The headings and facts below are a starting point. Write the text in your own words, then set `draft: false`.

TODO: an opening paragraph. What is [[PE-Sentinel]], and why analyse a file without running it?

## Why static analysis first

TODO: your reasoning.

- PE-Sentinel statically analyses Windows PE files (`.exe` and `.dll`) without executing them.
- It classifies each file as clean, suspicious or malicious.

## Hashing and parsing

TODO: how you read the file.

- Hashes files with SHA-256 and MD5.
- Parses PE headers and imports with `pefile`.

## Suspicious imports

TODO: how you chose the API list.

- Flags about 40 commonly abused Windows APIs.
- Flags process-injection combinations such as `VirtualAllocEx` + `WriteProcessMemory` + `CreateRemoteThread`.

## Detecting packing

TODO: how the entropy check works, with one real example.

- Detects packing from per-section Shannon entropy.
- Detects packing from mismatches between virtual and raw section sizes.

## Strings

TODO: what the string extraction looks for and why.

- Extracts strings and flags IPs, URLs, registry paths, PowerShell commands and Base64 blobs.

## YARA rules and batch mode

TODO: one rule you wrote, and how batch mode is used.

- Runs custom YARA rules through `yara-python`.
- Has a batch mode for whole folders.

## The risk score

TODO: how the score is put together.

- Gives a 0 to 100 risk score with itemised reasons.

## Testing

TODO: what the tests cover.

- Covered by `pytest` unit tests.

## What I learned

- A single signal, such as high entropy, means little on its own.
- The value comes from combining weak signals and explaining why a file was flagged.

TODO: a closing paragraph.
