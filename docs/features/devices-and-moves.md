---
title: Device copies and moves
type: component
created: 2026-09-27
updated: 2026-09-27
status: active
confidence: medium
tags: [devices, moves, filesystem]
sources:
  - project-move.ts
  - section-move.ts
  - thread-move.ts
  - move-files.ts
  - move-contract.ts
  - host.ts
  - chat-list.ts
  - server.ts
---
# Device copies and moves

TL;DR: A BB project can have local-path copies on connected hosts; project, section and chat moves validate ownership and activity, persist retry journals, perform host filesystem operations, and then update plugin metadata (`project-move.ts:47-80`, `section-move.ts:237-261`).

## Purpose

The feature keeps project and section paths aligned with BB metadata across devices and supports moving a chat’s dedicated `.bb/chats/<threadId>` storage alongside its working directory (`server.ts:2426-2513`, `project-move.ts:18-31`, `thread-move.ts:97-104`).

## How it works

1. `copy_add` normalizes an absolute path, requires a connected host and existing project, rejects a second copy on that host or a path already assigned to a project, creates the directory, adds a local-path source, then attempts to seed project rules (`server.ts:2426-2473`).
2. Project relocation validates the destination, records a move journal and asks the host entry to move files and preserve a compatibility link (`project-move.ts:18-31`, `project-move.ts:100-160`).
3. Section relocation validates project ownership and path boundaries, checks chats and pending exports, journals the operation, then dispatches host `inspect`, `move` or `link` (`section-move.ts:145-261`, `host.ts:7-16`).
4. Once files move, a database transaction rebases descendant section paths, history export paths and archive manifests; it marks the journal complete (`section-move.ts:262-307`).
5. A chat move accepts only an idle or error chat in the same project and on the same host, then journals both workspace and chat-storage paths (`thread-move.ts:66-120`).
6. If BB’s directory update works, the chat storage moves immediately. Otherwise the server files the chat in the destination and asks the chat agent to switch; the move settles after that turn (`thread-move.ts:138-185`, `thread-move.ts:216-269`).

## Modes

| Operation | Scope | Filesystem effect | Retry state |
|---|---|---|---|
| Add/remove project copy | One project source on one host | Add/remove BB local-path source | BB project source state |
| Move project | Entire project root on one host | Move directory and leave compatibility link | `project_moves` |
| Move/re-link section | One section subtree on its host | Move folder or link an externally renamed path | `section_moves` |
| Move chat | One chat, same project and host | Repoint environment and move `.bb/chats/<id>` | `thread_moves` |
| Place chat | Tree placement only | No workspace/filesystem change | `thread_places` |

Project and section move journals are set before filesystem work (`project-move.ts:18-31`, `section-move.ts:237-261`); chat move conditions and journal are in `thread-move.ts:76-120`.

`copy_remove` requires an existing source, at least one other project source, and no section rows or environments for the project on that host; it deletes only the BB source record, not the directory (`server.ts:2475-2513`).

## Failures

| Failure | Result |
|---|---|
| Active chats or queued work | Move is refused before file operations (`project-move.ts:140-171`, `section-move.ts:170-209`). |
| Both source and destination exist without a recognized completed link | Move refuses to merge/overwrite (`section-move.ts:211-234`, `thread-move.ts:108-136`). |
| Host/metadata step fails after journaling | Error is recorded in the journal and surfaced for retry (`project-move.ts:234-240`, `section-move.ts:308-314`). |
| Chat’s agent does not switch directory | Chat remains listed at destination but its workspace stays unchanged (`thread-move.ts:228-246`). |

## Business rules

- Project copies require connected hosts and a unique local path; the last copy cannot be removed, and copies with sections or chats must be cleared first (`server.ts:2426-2513`).
- Project and section moves reject active chats and occupied destinations; project and section folders cannot be merged (`project-move.ts:100-160`, `section-move.ts:211-234`).
- Section moves preserve old paths with a compatibility link, and accept an existing destination as the new location only when it represents an external rename (`section-move.ts:223-260`).
- Chat moves require an idle/error chat and a destination on the same host (`thread-move.ts:76-89`).
- Manual placement changes tree location without changing the folder where the chat works (`server.ts:242-253`, `chat-list.ts:251-263`).

## Public API

| RPC / command | Purpose | Evidence |
|---|---|---|
| `project_move`, `pending_moves` | Move project and list pending moves | `server.ts:215-232` |
| `section_move`, `pending_section_moves`, `thread_move` | Move/re-link section or move chat | `server.ts:188-195`, `server.ts:263-278` |
| `copy_add`, `copy_remove`, `copy_edit` | Add, remove or update a device copy | `server.ts:338-359` |
| `thread_place`, `thread_place_clear` | Change tree filing without moving workspace | `server.ts:242-253` |
| CLI `move-section`, `move-chat`, `copy-add`, `copy-remove` | Run matching operations through BB CLI | `server.ts:3406-3415`, `server.ts:3444-3451` |

## Gotchas

- Project moves require the same device and disk volume, and reject unsupported roots or linked worktree cases (`project-move.ts:80-145`).
- A chat relocation fallback consumes an agent turn and depends on the active provider exposing `update_environment_directory` (`thread-move.ts:16-25`, `thread-move.ts:138-168`).
- A move error retains its journal; finish or retry pending moves before starting conflicting operations (`server.ts:215-232`, `section-move.ts:308-314`).

<!-- lane-pilot:backlinks -->
## Referenced by

- [API and commands](../api.md)
- [Data model](../data-model.md)
