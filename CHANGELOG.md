# Changelog

## 0.4.0

- **Per-device working copies**: a project can hold its own working folder on every connected device — one path on the Mac mini, another on a server, a third on the MacBook. The sidebar keeps one entry per project, while the project card gains **device tabs for every machine BB knows**, each with a solid bolt while that machine is connected. A tab with a copy shows its folder as a path field with a folder button; a machine without a copy says so and offers **Add copy**, which opens the Working copies dialog with that device preselected — the folder is created when missing and seeded with AGENTS.md. The folder button opens that device's folder browser, where folders can be created, and the action follows what you pick: a place that does not hold the project folder yet means **Move** — the folder relocates with everything inside, the old path stays as a link for open chats, and sections, chat exports and archives are remapped — while a place that already holds it means **Use this folder**, which only re-registers the path. Every copy keeps its own AGENTS.md and CLAUDE.md; project-level rules are written to all of them. New chats pick the device in the composer's project dropdown (each copy is listed with its device name), and a **Configure** item in the ⋯ / right-click menu jumps to the project's settings. The last copy is protected; copies with sections or chats must be cleared first. CLI: `bb project-folders copy-add` / `copy-remove`.

- Default `AGENTS.md` rules: new plugin settings add separate **project** and **sections** templates with an auto-create toggle. Creating a project, section or subsection seeds `AGENTS.md` with the matching template wrapped in `<!-- bb-project-folders:agents:start -->` / `:end` markers at the end of the file. Existing content above the markers is never modified; existing files receive the block appended at the bottom, and later template edits rewrite the same block in place.
- Shipped English rule presets: the project template distills working-project practice (verify the host, read component docs before editing, file placement, result artifacts, records, secrets, evidence discipline), and the sections template merges Karpathy's coding guidelines — think before coding, simplicity first, surgical changes, verification criteria.
- Rules are hierarchical: plugin settings hold the shared defaults — including shared **Custom rules**; a project can set its own project and sections templates plus its own custom rules (applied to its root and new sections inside it); first and second level sections can set their own template and custom rules; third-level sections get no rules at all. The nearest value wins down the tree. The details pane and the Rules dialog show the mode as three tabs — **Default**, **Custom template** and **Own file** — and the open tab is what the folder uses once saved. The custom tab holds the templates, prefilled from the existing managed block; the **Own file** tab edits the AGENTS.md and CLAUDE.md of the selected device directly and tells the plugin to write nothing there. Custom rules land at the bottom of AGENTS.md and CLAUDE.md (when it exists) on save or apply; clearing the field removes the block.
- Adopted folders: when a project or section is created on a directory that already has AGENTS.md, the plugin leaves AGENTS.md and CLAUDE.md untouched and does not inject anything automatically. A file without the plugin's markers opens on the **Own file** tab and is skipped by **Apply to existing sections**; switch the folder to one of the template tabs to let the plugin manage it. When AGENTS.md is missing but CLAUDE.md exists, a one-line `@AGENTS.md` CLAUDE.md bridge is only created for new files.
- **Apply to existing sections** writes the effective template into every project and allowed section at once — skipping folders kept on their **Own file** tab — and reports updated, unchanged and failed counts.
- Manual ordering: drag projects and sections up/down in the management page tree, or use the Move up / Move down actions; the order is stored in the plugin database and used everywhere.
- Redesign the management page: a minimalist tree of projects and sections sits in the left sidebar — expand, select, and act through the ⋯ or right-click menu — while the main pane shows the selected section's details, its rules and the plugin settings. Compact archive list and tighter spacing.
- Export failure noise is cleaned up: deleted chats (404) drop their error rows, chats without an environment no longer record errors, and stale error rows older than an hour are pruned.
- Fix the folder browser of **Move project**: it never opened, because the request carried an undefined path that RPC validation rejected.
- Translate the new controls into all 11 interface languages.

## 0.3.5

- Project and section chats share one composer: the project control becomes a project/section tree with nested sections indented by depth, so a new chat can be bound to the project root or any nested section before sending. The chat-plus button on a project card and the project's new-chat button in the sidebar tree open it.
- Fix the project-root composer route failing to load: panel sub-paths are now URL-decoded, so `root:<host>` destinations resolve correctly.

## 0.3.4

Stable release of the 0.3.4 preview series: it contains everything from 0.3.4-rc.1 through 0.3.4-rc.4 listed below.

- Tighten sidebar spacing: projects sit on a compact list instead of a 20px gap, and an expanded project keeps a smaller separation from the next one.
- Right-click a project or section heading to open the same menu as the ellipsis button.
- Delete a project from the tree menu or the management page.
- Choose **Leave files in place** (default) or **Move files to the archive** next to the project folder.
- BB chats of that project are removed; Git remotes and other machines are not deleted. Archiving files is refused when the folder is also another project's section.


## 0.3.4-rc.3

- Rename chats inline from the context/ellipsis menu or by double-clicking the title. Enter or blur saves through the native BB rename action; Escape cancels.
- Failed drag/drop reports a short notice without reopening the destination picker.
- Explicit Move action opens a collapsible folder tree with destination selection and Move/Cancel buttons.


## 0.3.4-rc.2 (included in rc.3)

- Share a compact BB-style folder browser between project and section dialogs, adapting BB RemotePathBrowser layout.
- Create folders on the selected device without leaving the picker.
- Confirm empty-folder deletion; preserve nonempty folders, symlinks, and registered project/section folders.
- Translate new controls into all 11 supported languages.


## 0.3.4-rc.1

- Share the chat action menu between right-click and the ellipsis button.
- Move existing chats through a section picker or drag and drop, with durable storage-move recovery.
- Requires the companion BB native directory-update API; unsupported servers leave chats and files unchanged.

## 0.3.3

Show the project and nested section hierarchy in the existing project label of created chats. Labels are scoped to each conversation and restored on unload.

## 0.3.2

Integrate the destination tree into the existing project-control position beneath the composer, removing the extra selector and path block.

## 0.3.1

Add a hierarchical project/section destination picker and show the selected working path above the native composer. Fix section chat creation with the native project-checkout environment provider. Preserve composer selections, enforce the section device and directory, and display submission errors without clearing the draft.

## 0.3.0

Move an entire project directory on the same host and volume, including hidden files, rules, sections and archives. Keep existing chat paths working through a compatibility link. Journal interrupted moves for retry, update project/section/archive paths and block active-work relocation. Add translated move dialogs in all 11 languages.

### Interface

Move sorting into the project/section three-dot menu and make show-all controls compact single-line buttons.

## 0.2.1

Activity, alphabetical and creation-date sorting; configurable per-list chat limit (default 10); independent show-all controls. List settings are translated into all 11 interface languages.

## 0.2.0

First public release: real project sections, per-section chats and working rules, device-aware creation, hidden history snapshots, journaled archive/restore, and interface in 11 languages with English as the default.

## 0.1.0

Local prototype.
