---
title: "Crackme 1"
date: 2026-04-05
category: reverse-engineering
difficulty: easy
status: solved
tools: [gdb]
tags: [crackme, gdb, x86-64]
---

## Steps

- Loaded in GDB
- Found comparison instruction:

```asm
cmp eax, 0x539
```

## Key

> [!flag]
> 1337

## Conclusion

Password is hardcoded in binary.

> [!note] Source
> The binary and my original notes are in the [Reverse-engineering-practice repository](https://github.com/devnxh/Reverse-engineering-practice), next to my x86-64 assembly exercises.
