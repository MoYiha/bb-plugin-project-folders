---
name: project-folders
description: Manage BB project folders, nested sections, per-chat storage, and archive/restore sections with history. Use for project sections, device selection, folder hierarchy, or chat infrastructure in BB.
---
# Projects and folders
Resolve project and section IDs with `bb project-folders list --json`. Each section has an explicit host and path.
Create a real section: `bb project-folders create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id] --json`. Quote names and paths. `-` selects the project root; a host selects that project's registered source on that host. Nested sections stay on their parent's host. Missing sources and offline devices must never cause fallback to a different device. Existing directories may be registered without overwriting contents.
New projects are created using the core BB project API, through the plugin's New project dialog or the documented core CLI. The dialog includes device, name and folder selection. Do not change a project's existing roots just to organize sections.
New chats use BB's composer and preserve model, attachments and execution choices; the section's workspace path is explicit. Keep generated documents, notes and temporary files in `<workspace>/.bb/chats/<thread-id>/{artifacts,notes,tmp}/`. Code and requested working deliverables follow the user's structure. Read applicable ancestor AGENTS.md files. UI rule edits use SHA comparison and preserve concurrent edits. Renaming a section changes its display name, not its directory.
BB retains canonical chat storage. The plugin exports the timeline to `.bb/chats/<thread-id>/history/` on creation, idle and archive. `history/index.json` selects the snapshot directory and page count, newest first. Attachment binaries remain in BB's storage. `bb project-folders sync <thread-id>` retries an export.
## Archive and restore
`bb project-folders archive <folder-id>` moves the complete directory tree to `<project-source>/.bb/archive/sections/<archive-id>/folder`, writes a manifest, archives its chats and preserves rules, files, history and nested section IDs. `forget` is a compatibility alias for archive, no longer a detach-only operation.
Active work and queued messages must finish before a move. A section containing another BB project's source cannot be moved implicitly. The plugin rejects message dispatch in archived chats until restored.
`bb project-folders archives --json` lists archives and interrupted operations. Retry `archive <folder-id>` for an interrupted archive; `restore <archive-id>` restores an archived section or retries an interrupted restore. State persists across reloads. Do not manipulate the journal manually.
`bb project-folders restore <archive-id>` restores the original path and previously unarchived chats; it never overwrites an occupied original path. Restore the parent first when necessary.
Creating a section with an archived name in the same project/device requires a restore-or-create-new choice in the UI. Do not silently create a fresh directory instead of offering restoration. Permanently deleting archives is not implemented.
