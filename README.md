# Projects & Sections for BB

[![BB Compatibility](https://img.shields.io/badge/BB-%3E%3D0.43-blue.svg)](https://getbb.app)
[![Plugin SDK](https://img.shields.io/badge/Plugin%20SDK-%3E%3D0.4.84-green.svg)](https://getbb.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/VKirill/bb-plugin-project-folders?color=orange)](https://github.com/VKirill/bb-plugin-project-folders/releases)

> Turn a flat list of BB chats into a tree of projects and sections that are real folders on disk. Every chat starts in the right working directory, every section can carry its own agent rules, finished work goes to a restorable archive, and the whole tree can be styled with your own icons and colors.

[Русский](README.ru.md) · [Releases](https://github.com/VKirill/bb-plugin-project-folders/releases) · [Report an issue](https://github.com/VKirill/bb-plugin-project-folders/issues)

![Appearance settings: ready-made styles, color mode, a per-level editor with live preview, and the project tree styled by level.](docs/images/appearance.webp)

## Contents

- [Why use it](#why-use-it)
- [Features at a glance](#features-at-a-glance)
- [Install](#install)
- [Projects and sections](#projects-and-sections)
- [The sidebar tree](#the-sidebar-tree)
- [Starting chats in the right folder](#starting-chats-in-the-right-folder)
- [Settings](#settings)
- [Chat list](#chat-list)
- [Appearance](#appearance)
- [AGENTS.md rules](#agentsmd-rules)
- [Section archive](#section-archive)
- [Import and export](#import-and-export)
- [Language](#language)
- [One project on many devices](#one-project-on-many-devices)
- [Move and delete](#move-and-delete)
- [Files and chat history](#files-and-chat-history)
- [Commands](#commands)
- [Requirements, data and limitations](#requirements-data-and-limitations)
- [Development](#development)

## Why use it

BB keeps chats per project. Once a project holds a website, research, design, clients and paperwork, the chat list turns into a long mixed feed, and every new chat opens in the project root even when the task belongs to one subfolder.

Projects & Sections gives that project a structure you already understand — folders:

```text
Launch Studio                     Project (its root folder)
├── Project planning              Chat in the project root
├── Research/                     Section = real folder
│   └── Compare customer needs    Chat that works inside Research/
└── Website/                      Section
    ├── Build the landing page    Chat inside Website/
    └── Design/                   Nested section inside Website/
        └── Review the layout     Chat inside Website/Design/
```

What you get from that:

- **Agents work where the task lives.** A chat started from a section uses that section's folder as its working directory.
- **Rules travel with the work.** Coding conventions sit in the website folder, source requirements in the research folder — as ordinary `AGENTS.md` files that terminal agents read too.
- **The tree stays short.** Inactive sections collapse on their own, each list shows only the latest chats, and finished sections move to an archive you can restore at any time.
- **You recognize things at a glance.** Icons, emoji, colors and fills per level, per project or per section.

## Features at a glance

| Area | What it does |
| --- | --- |
| Projects & sections | Real folders, nesting, manual order by drag and drop, rename, change path |
| Sidebar tree | Replaces BB's chat list with the project → section → chat tree; bold unread, auto-collapse, per-list limits |
| New chats | Chat-plus button per project or section; the composer gets a project/section picker |
| Rules | AGENTS.md templates for projects and sections, per-project and per-section overrides, own-file mode, custom rules into files or into BB sessions, a one-shot startup instruction |
| Appearance | 118 icons in 7 groups or any emoji, 12 colors or a custom one, 4 fill styles, 4 presets, color by level or by project, per-item looks with inheritance |
| Archive | Archive a section with nested sections, files and chats; restore it to the same path |
| Devices | One project with a working copy on each connected machine |
| Moves | Move a whole project, move or re-link a section, move a chat between sections (core patch) |
| Settings | One settings screen on the management page and in BB settings; shared by all devices |
| Import & export | Settings and looks as a JSON file |
| Languages | 11 interface languages, English by default |

## Install

```sh
bb plugin install https://github.com/VKirill/bb-plugin-project-folders.git --yes
```

Or install **Projects & Sections** from the BB Community marketplace. Then:

1. Open BB's sidebar customization and choose the **Projects & Sections** thread list if BB did not select it automatically.
2. Open the management page from plugin navigation (**Projects & Sections**) or from **Manage sections** at the bottom of the tree.
3. Create a project with **New project**: pick a connected device, a name and a new or existing folder.

## Projects and sections

A **project** is a BB project with a folder on a device. A **section** is a subfolder of a project or of another section. The plugin records sections in its own database; the folders are ordinary directories you can open in Finder or a terminal.

- **New project** — choose a connected device, a name and a folder. The folder picker can create a folder on that device. When auto-create is on, the project gets an `AGENTS.md` with the project template.
- **New section** — from the project or section **⋯** menu, from a right-click on its heading, or from the section card. Create a new subfolder or pick an existing one. Nested sections always stay on their parent's device.
- **Levels** — the project root is level 0, its sections level 1, their subsections level 2, and anything deeper level 3+. Levels decide which rules template applies and which default look is used.
- **Rename** — changes only the label; the directory path stays.
- **Change path** — moves a section to a new folder or re-links it to a folder renamed outside BB (see [Move and delete](#move-and-delete)).
- **Order** — drag projects and sections up or down on the management page, or use **Move up / Move down** in the row menu. The order is stored in the plugin database and used everywhere.
- **Name reuse** — creating a section with the name of an archived one on the same project and device offers to restore it with its history instead.

The folder picker, shared by the project and section dialogs, browses the selected device, creates child folders and can delete an **empty, unregistered** folder after confirmation. It never deletes files recursively.

## The sidebar tree

The plugin adds a thread list to BB's sidebar: projects, their sections and subsections, and the chats inside each of them. Chats without a project are grouped under **No project**.

- **Chat-plus button** on every project and section heading opens a new chat bound to that folder.
- **⋯ menu or right-click** on a heading: New project, New section, Configure (opens its card on the management page), Appearance, Chat sorting, Move, Working rules, Rename, Change path, Delete or Archive.
- **Unread** — a project or section name turns bold when any chat anywhere below it is unread (can be turned off).
- **Auto-collapse** — a section with no chat activity for a set time (2 hours by default) collapses. It stays open while an agent is running in it or one of its chats is open. A section you collapse or expand by hand keeps your choice; a manually collapsed section stays collapsed even while an agent works inside.
- **Short lists** — each project root, section and the No project group shows the newest chats up to the limit; **Show all** expands only that list.
- **Pinned chats** stay on top of their list.
- **Drag a chat** onto another section or the project root to move it (requires the core patch, see [Move and delete](#move-and-delete)).

## Starting chats in the right folder

Pressing chat-plus on a project or section opens BB's standard composer on the management page. The composer's project control becomes a **project/section tree**, indented by depth, with every device where the project has a copy. Pick the root or any nested section before sending; the tooltip shows the destination path. Errors stay visible and keep your draft.

Inside an open chat, the project name on the composer's project control is replaced with the section path, so you always see where the agent works.

Every chat started from BB also receives short instructions: store reports in `.bb/chats/<chat-id>/artifacts/`, notes in `notes/`, throwaway files in `tmp/`, never edit the exported `thread.json` or `history/`, and read the applicable `AGENTS.md` files including parent folders.

## Settings

The same settings are available in two places, and they are identical:

- **Management page** — a **Settings** block sits above the project tree in the left column: Chat list, Appearance, AGENTS.md rules, Section archive, Import & export, Language. Pick an item to open it; pick a project or section to open its card. A deep link `settings/<section>` opens a section directly.
- **BB settings → Projects & Sections** — the same sections with their own side menu.

Settings (except the language) are stored on the BB server, so every device and browser sees the same values, and open windows update immediately.

## Chat list

![Chat list settings: chat order, section collapsing and tree view.](docs/images/chat-list.webp)

**Chat order**
- **Chat sorting** — Recent activity (default), Alphabetical or Newest first. Activity uses BB's update and attention timestamps, so a new message moves a chat up. Also available from any heading's **⋯ → Chat sorting**.
- **Chats per section** — 1–100 (default 10). The rest open with **Show all**.

**Section collapsing**
- **Collapse inactive sections automatically** — on by default, also toggled from the heading menu.
- **Collapse sections inactive for, hours** — from 0.25 to 720 hours (default 2).

**Tree view**
- **List density** — Comfortable or Compact rows.
- **Nested section indent** — 0–32 px.
- **Bold sections with unread chats** — on by default.

A single project or section can override sorting and the chat limit in its own **Appearance** dialog.

## Appearance

![Appearance settings: presets, color mode, level editor and live preview.](docs/images/appearance.webp)

**Ready-made styles** change every level at once; the active one is marked with a check.

| Preset | Look |
| --- | --- |
| Standard | Plain folder icons, no colors |
| Monochrome | Briefcase badge for projects, folder, open folder and layers icons in gray |
| By level | Blue badge for projects, violet level 1, teal level 2, amber level 3+ |
| By project | Every project gets its own color; its sections take it, level 1 sections get a left stripe |

**Color is set by**
- **By level** — each level has its own color.
- **By project** — sections take the color of their project. A project without a chosen color gets a stable color derived from its ID.

**Levels** — switch between Projects, Level 1, Level 2 and Level 3+ and set for each:
- **Icon** — 118 Hugeicons in 7 groups (Folders, Work, Development, AI & content, Communication & marketing, Finance, Life & hobbies) with search, 52 quick emoji, or any emoji typed in.
- **Color** — no color, 12 swatches tuned to read in light and dark themes (gray, red, orange, amber, green, teal, cyan, blue, indigo, violet, pink, rose), or any custom color.
- **Fill** — none, icon badge, left stripe or row background.

The preview on the right highlights the level you are editing.

**Individual looks** — any project or section has **⋯ → Appearance** (also a button on its card):
- its own icon, color and fill, each field either set or inherited;
- **Apply to all nested sections that have no look of their own** — the look cascades down the tree;
- its own chat sorting and chats-per-section limit;
- **Reset** returns the item to the level look. The Appearance settings show how many items are styled individually and can reset them all at once.

The nearest value wins: the item itself, then the closest ancestor that cascades, then the project color in By project mode, then the level defaults.

## AGENTS.md rules

![AGENTS.md rules: how the managed block works and the default templates.](docs/images/agents-rules.webp)

Rules are plain `AGENTS.md` files in the project and section folders, so BB agents and terminal agents such as Claude Code or Codex read the same instructions.

**Default rules** (Settings → AGENTS.md rules)
- **Auto-create AGENTS.md** — when a project, section or subsection is created, write the matching template into its `AGENTS.md`.
- **Project rules template** and **Sections rules template** — shipped English presets: project discipline (verify the device, read component docs, file placement, result artifacts, records, secrets) and Karpathy-style coding guidelines (think first, minimal and surgical changes, verification criteria). Edit them freely.
- **Custom rules** — optional extra rules for the whole tree, such as model routing or delegation.
- **Where it applies** — **Into the file** (appended to `AGENTS.md` and to `CLAUDE.md` when it exists, visible to terminal agents), **Into BB sessions** (given to agents started from BB as session instructions, nothing written to disk) or **Both**.
- **Startup instruction** — one-shot text appended to the first message of every new chat, for example "run the tasks skill and show current tasks". It is never written to files and never repeated.
- **Apply to existing sections** — writes the effective templates into every project and allowed section and reports updated, unchanged and failed counts.

**Managed block** — the plugin only writes between two markers at the end of the file:

```text
<!-- bb-project-folders:agents:start -->
…template and custom rules…
<!-- bb-project-folders:agents:end -->
```

Text above the markers is never touched; changing a template rewrites the same block in place.

**Per project and per section** — a project or a level 1–2 section card, and its **Working rules** dialog, has three tabs; the open tab is what the folder uses once saved:
- **Default** — the shared templates.
- **Custom template** — its own template (for a project: a project template and a template for new sections inside it), its own custom rules and target, its own startup instruction. The nearest override wins down the tree.
- **Own file** — edit that device's `AGENTS.md` and `CLAUDE.md` directly; the plugin writes nothing there and Apply skips the folder.

Level 3+ sections get no rules. An existing `AGENTS.md` without the plugin markers is treated as yours: the folder opens on **Own file** and nothing is injected. Saving detects concurrent edits and refuses to overwrite a changed file. When a project has copies on several devices, rules are written to every copy.

## Section archive

![Section archive: archived sections with dates, section and chat counts and Restore buttons.](docs/images/section-archive.webp)

- **Archive** moves a section with all nested sections and files into `<project>/.bb/archive/sections/<archive-id>/folder` on the same device. Its chats are archived and blocked from new messages.
- **Section archive** lists every archive with its date, number of sections and chats.
- **Restore** returns the files to the original path and reactivates the chats. It refuses to overwrite an occupied path.
- Running chats, queued work, or another project's sources inside the folder block archiving. Interrupted operations stay listed with **Retry**.
- There is no permanent deletion from the archive.

## Import and export

![Import & export: export button and import with an option to replace individual looks.](docs/images/import-export.webp)

- **Export** downloads `project-folders-settings.json` with chat list settings, tree view, level appearance and the looks of individual projects and sections.
- **Import** loads such a file. **Also replace the looks of individual projects and sections** decides whether per-item looks are replaced too.
- AGENTS.md rules are not included.

## Language

![Language settings: the plugin interface language selector.](docs/images/language.webp)

The interface is available in English, Russian, Spanish, French, German, Portuguese, Simplified Chinese, Japanese, Korean, Hindi and Arabic (right-to-left layout). English is the default for everyone. The choice is stored per browser and can be changed in **Settings → Language** or with the selector in the page header. The plugin's interface is marked so BB-wide page translators leave it in the language you picked. Project names, file contents and agent templates are never translated.

## One project on many devices

A project can keep a working copy on each connected machine — a laptop, a Mac mini, a server.

- The project card shows **device tabs for every machine BB knows**. A solid bolt means the machine is connected; a faded tab means there is no copy there yet.
- A tab with a copy shows its path with a folder button. Picking a new place **moves** the copy; picking a folder that already holds the project **uses** it without moving files.
- **Add copy** on an empty tab opens **Working copies** with that device selected: the folder is created if missing and seeded with `AGENTS.md`.
- The sidebar keeps one entry per project; new chats can pick any device with a copy.
- Each copy has its own sections, chats and `AGENTS.md`; project-level rules are written to all copies. The last copy cannot be removed, and a copy with sections or chats must be cleared first.

## Move and delete

**Move a project** (card or **⋯ → Move**) — relocate the whole project folder with hidden files, rules, nested sections, chat exports and archives to a new path on the **same device and disk volume**. The old path becomes a symbolic link so existing chats keep working. Running chats and queued work must finish first. Home folders, BB runtime directories, linked Git worktrees and projects with environments outside their folder cannot be moved. Interrupted moves appear as **Unfinished moves** with **Retry**.

**Change a section path** (**⋯ → Change path**) — pick a folder inside the same project on the same device:
- a **new folder** — the section moves with files, nested sections, chat exports and archive manifests;
- an **existing folder** — the section re-links to it without touching files, the fix for a folder renamed outside BB.

Either way the old path stays as a link; unfinished moves are retried from **Unfinished section moves**.

**Delete a project** — **Leave files in place** (default) only removes it from the tree; **Move files to the archive** relocates the folder to `<parent>/.bb/archive/projects/<id>/folder`. The project's BB chats are deleted. Nothing is removed from a Git remote.

**Move a chat to another section** — **Move to section…** in a chat menu, or drag the chat onto a section or project root in the same project and device. Chat history stays intact; only its `.bb/chats/<id>` folder moves. This needs BB's experimental directory-update API from the [companion core patch](docs/bb-native-thread-relocation.patch); without it the plugin reports an error and moves nothing, and every other feature works.

## Files and chat history

```text
<project-or-section>/
  AGENTS.md
  .bb/chats/<chat-id>/
    thread.json
    history/index.json
    history/<snapshot>/page-00000.json
    artifacts/     reports and results
    notes/         working notes and handoff
    tmp/           throwaway files
```

BB stays the canonical chat store. The plugin exports paginated history after a chat is created, after completed turns and on archiving, and publishes the snapshot index only after the whole snapshot is written. Attachments remain in BB, so these exports are not a full backup. Hidden folders can be tracked by Git — add ignore rules before sharing a repository.

## Commands

```sh
bb project-folders list
bb project-folders create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id]
bb project-folders move-section <folder-id> <absolute-path>
bb project-folders move-chat <thread-id> <project-id> <folder-id-or-dash> <host-id>
bb project-folders archive <folder-id>
bb project-folders archives
bb project-folders restore <archive-id>
bb project-folders copy-add <project-id> <host-id> <path>
bb project-folders copy-remove <project-id> <host-id>
bb project-folders delete-project <project-id> keep|archive
bb project-folders sync <thread-id>
```

`forget` is a compatibility alias for `archive`.

## Requirements, data and limitations

- BB 0.43+ with Plugin SDK 0.4.84+ (uses experimental sidebar and composer surfaces).
- Connected macOS or Linux devices with local-path project sources. Windows paths are not supported. Live-tested on macOS.
- No account, API key, paid service or external server.
- **Stored by the plugin:** section records, order, rules modes, archives, move journals, preferences and looks — in the plugin database on the BB server. Only the language choice lives in the browser.
- Moves work within one device and disk volume. Chat moves need the core patch. Some SDK surfaces are experimental and may need updates with future BB versions.
- Upgrading from 0.3.x: browser-only chat list settings and the old declarative AGENTS.md settings are migrated automatically; `bb plugin config project-folders` no longer lists the rules — use the settings screen.

## Development

```sh
npm ci
npm run typecheck
npm test
npm run build
bb plugin reload project-folders
```

Tests cover path boundaries, multiple devices, composer forwarding, rule inheritance and conflicts, paginated history, archive and restore, interrupted moves, preferences storage and migration, appearance resolution and language catalogs.

## License

MIT. Vendored BB UI source keeps its attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
