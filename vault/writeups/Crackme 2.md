---
title: "Crackme 2"
date: 2026-04-06
category: reverse-engineering
status: solved
tools: [IDA Free]
tags: [crackme, ida, x86-64]
---

## Overview

This crackme validates user input using a two-step verification process:

1. Length check
2. Character-by-character comparison

---

## Analysis

### Step 1: Input Handling

- The program takes user input using `gets`
- It calculates the length using `strlen`

### Step 2: Length Check

```asm
cmp [rbp+var_40], 0Bh
```

- `0Bh` = 11 (decimal)
- Input must be exactly **11 characters**

If the length is not equal to 11, the program jumps to the failure branch.

### Step 3: Character-by-Character Comparison (Core Logic)

After passing the length check, the program enters a loop where each character is compared individually.

```asm
cmp dl, al
```

- `dl` → character from user input
- `al` → expected character (hardcoded or computed)

The program compares **each character one by one**:

- If characters match → continue loop
- If any character mismatches → program exits with failure

### Step 4: Reconstructing the Password

By stepping through the loop in the debugger:

- Observed expected characters stored in `al`
- Compared with input characters in `dl`
- Recovered the password **character-by-character**

---

## Final Password

> [!flag]
> P@$$W0RD!2S

## Tools Used

- IDA Free

> [!note] Source
> The binary and my original notes are in the [Reverse-engineering-practice repository](https://github.com/devnxh/Reverse-engineering-practice), next to my x86-64 assembly exercises.
