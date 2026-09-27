---
title: Appearance and preferences
type: component
created: 2026-09-27
updated: 2026-09-27
status: active
confidence: medium
tags: [appearance, preferences, settings]
sources:
  - preferences.ts
  - appearance.tsx
  - chat-list.ts
  - server.ts
  - app.tsx
  - i18n.tsx
---
# Appearance and preferences

TL;DR: Shared preferences control chat lists, tree density and level styling; optional per-project and per-section styles can override or cascade to nested sections (`preferences.ts:66-90`, `preferences.ts:59-64`).

## Purpose

The plugin stores common preferences on the BB server so the sidebar, management page and settings page read the same values (`preferences.ts:3-7`, `server.ts:3170-3211`).

## How it works

1. `prefs_get` returns parsed shared preferences, per-item styles and whether UI preferences have been saved (`server.ts:578-585`, `server.ts:3168-3184`).
2. Parsing merges partial or old data with defaults, then validates each field and style (`preferences.ts:170-211`).
3. The appearance editor selects a preset or edits level styles, then `prefs_save` persists global preferences and can replace all item styles (`appearance.tsx:707-766`, `server.ts:3186-3201`).
4. A project/section style is saved or deleted using its `p:`/`f:` key; the UI resolves inherited styles and renders glyphs, colors and fills (`preferences.ts:216-225`, `appearance.tsx:391-447`, `server.ts:3203-3211`).
5. List settings determine sort order, list limits, idle hiding and automatic collapse (`preferences.ts:66-115`, `chat-list.ts:14-32`).

## Modes

| Area | Choices |
|---|---|
| Preset | `standard`, `mono`, `levels`, `projects` |
| Icon | Registered `icon:<name>` or `emoji:<text>` |
| Color | One of 12 named tokens or `#RRGGBB` |
| Fill | `none`, `badge`, `stripe`, `row` |
| Color source | `level` or `project` |
| Per-item options | Cascade, sort mode and chat limit 1–100 |
| Density | `comfortable` or `compact`; indent 0–32 |

Exact allowed values and defaults: `preferences.ts:8-90`, `preferences.ts:94-153`.

## Failures

| Failure | Result |
|---|---|
| Preference data is partial or stale | Valid values are retained; invalid fields/styles use defaults (`preferences.ts:170-211`). |
| Item style key or value is invalid | The parser drops that entry (`preferences.ts:199-211`). |
| Preference save fails | The settings UI reports the error instead of clearing it (`appearance.tsx:707-715`). |

## Business rules

- Per-item keys use `p:<projectId>` or `f:<folderId>` (`preferences.ts:216-225`, `server.ts:595-600`).
- A nested section inherits an ancestor’s appearance only when that style has `cascade` enabled (`preferences.ts:59-64`, `appearance.tsx:439-447`).
- Invalid persisted preferences are repaired field-by-field; unsupported item keys/styles are dropped (`preferences.ts:170-211`).
- Import can replace global settings and optionally replace all per-item looks (`server.ts:587-593`, `server.ts:3186-3199`).

## Public API

| RPC | Purpose | Evidence |
|---|---|---|
| `prefs_get`, `prefs_save` | Read and save shared settings; optional bulk item-style replacement | `server.ts:578-593` |
| `item_style_save` | Upsert or delete one project/section style | `server.ts:595-601`, `server.ts:3203-3211` |

## Gotchas

- Language selection is browser-local; the rest of these preferences are stored in BB plugin storage (`i18n.tsx:39-48`, `server.ts:3170-3211`).
- Changing a preset replaces level appearance settings, while per-item appearance has its own storage (`preferences.ts:117-153`, `server.ts:3191-3198`).
