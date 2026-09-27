---
title: Interface language
type: component
created: 2026-09-27
updated: 2026-09-27
status: active
confidence: high
tags: [localization, language, interface]
sources:
  - i18n.tsx
  - translations.ts
  - locales/ar.json
  - locales/es.json
  - app.tsx
  - agents-template.ts
---
# Interface language

TL;DR: The plugin interface language is selected per browser and stored in local storage; unsupported values fall back to English, and Arabic switches layout direction to right-to-left (`i18n.tsx:39-48`, `i18n.tsx:64-69`).

## Purpose

The i18n module exposes language names, a translation lookup and an external-store hook used by React surfaces (`i18n.tsx:25-69`).

## How it works

1. The language picker reads `project-folders:language` from browser local storage and defaults to English (`i18n.tsx:39-48`).
2. Catalogs are keyed by language; English strings are the source dictionary and unsupported/missing keys fall back to English (`i18n.tsx:1-24`, `i18n.tsx:67-69`).
3. Changing the picker writes the key and dispatches a custom event so mounted components update (`i18n.tsx:71-89`).
4. The layout direction helper returns RTL only for Arabic (`i18n.tsx:64-65`).

## Modes

| Language | Catalog source |
|---|---|
| English | `translations.ts` |
| Russian | English source strings are used as lookup keys and mapped by the Russian branch in `t` |
| Spanish, French, German, Portuguese, Simplified Chinese, Japanese, Korean, Hindi, Arabic | `locales/<code>.json` |

Supported language identifiers are declared in `i18n.tsx:13-37`.

## Failures

| Failure | Result |
|---|---|
| Browser storage is unavailable | The getter returns the default English language (`i18n.tsx:39-48`). |
| Stored language is unsupported | Language resolves to English (`i18n.tsx:47-51`). |
| A dictionary key is absent | Translation lookup uses the English source string (`i18n.tsx:67-69`). |

## Business rules

- A browser’s unsupported or unavailable setting resolves to English (`i18n.tsx:39-48`).
- Missing translations resolve to the English source value (`i18n.tsx:67-69`).
- Language selection does not affect project names, file contents or agent templates; localization is limited to UI strings (`i18n.tsx:67-89`, `agents-template.ts:16-23`).

## Public API

| Export | Purpose | Evidence |
|---|---|---|
| `languages`, `catalogs` | Supported language labels and dictionaries | `i18n.tsx:13-38` |
| `useLanguage`, `direction`, `t` | Read language, select layout direction and translate a UI key | `i18n.tsx:47-69` |
| `LanguagePicker` | Save a browser language and notify subscribers | `i18n.tsx:71-89` |

## Gotchas

- Language choice is browser-local rather than shared in the server preferences (`i18n.tsx:39-45`).
- The files named in `locales/` provide JSON catalogs; Russian uses the dedicated branch rather than an imported JSON file (`i18n.tsx:3-11`, `i18n.tsx:67-69`).
