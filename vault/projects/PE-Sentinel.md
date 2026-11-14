---
title: PE-Sentinel
summary: "Python CLI that triages Windows executables without running them."
period: "Jul–Sep 2026"
role: "Solo project"
status: active
stack: [Python, pefile, yara-python, pytest]
repo: https://github.com/devnxh/PE-Sentinel
featured: true
order: 1
tags: [malware-analysis, python, yara, windows]
highlights:
  - "Flags about 40 commonly abused Windows APIs"
  - "Detects packing from per-section Shannon entropy"
  - "0 to 100 risk score with itemised reasons"
---

PE-Sentinel is a Python command-line tool that statically analyses Windows PE files (`.exe` and `.dll`) without executing them. It classifies each file as clean, suspicious or malicious, and says why.

## The problem

A single signal, such as high entropy, means little on its own.

> [!todo] TODO
> Devansh: add one or two sentences on what made you start this project.

## What I built

- Hashes each file with SHA-256 and MD5.
- Parses PE headers and imports with `pefile`.
- Flags about 40 commonly abused Windows APIs.
- Flags process-injection combinations such as `VirtualAllocEx` + `WriteProcessMemory` + `CreateRemoteThread`.
- Detects packing from per-section Shannon entropy and from mismatches between virtual and raw section sizes.
- Extracts strings and flags IPs, URLs, registry paths, PowerShell commands and Base64 blobs.
- Runs custom YARA rules through `yara-python`.
- Has a batch mode for whole folders.
- Is covered by `pytest` unit tests.

## How it works

Each check adds evidence. The result is a risk score from 0 to 100 with itemised reasons.

```mermaid
flowchart LR
  A[PE file] --> B[Hashes]
  B --> C[Headers and imports]
  C --> D[Section entropy]
  D --> E[Strings]
  E --> F[YARA rules]
  F --> G[Risk score 0 to 100]
  G --> H[Clean, suspicious or malicious]
```

## Results in numbers

| Measure | Value |
| --- | --- |
| Windows APIs on the watch list | about 40 |
| Hashes per file | 2 (SHA-256, MD5) |
| Risk score range | 0 to 100 |
| Verdicts | 3 (clean, suspicious, malicious) |

> [!todo] TODO
> Devansh: add the number of unit tests and the number of samples you ran it against, if you have them.

## What I learned

A single signal means little on its own. The value comes from combining weak signals and explaining why a file was flagged.
