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
- [BB's own New thread screen](#bbs-own-new-thread-screen)
- [Settings](#settings)
- [Chat list](#chat-list)
- [Appearance](#appearance)
- [AGENTS.md rules](#agentsmd-rules)
- [Provider, model and agent](#provider-model-and-agent)
- [Session context](#session-context)
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

| Area                | What it does                                                                                                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Projects & sections | Real folders, nesting, manual order by drag and drop, rename, change path, folderless groups                                                                                        |
| Sidebar tree        | Replaces BB's chat list with the project → section → chat tree; bold unread, auto-collapse, per-list limits                                                                         |
| New chats           | Chat-plus button per project or section; the composer gets a project/section picker                                                                                                 |
| Rules               | AGENTS.md templates for projects and sections, per-project and per-section overrides, own-file mode, custom rules into files or into BB sessions, a one-shot startup instruction    |
| Provider and agent  | Pin the provider, model, reasoning level, service tier, permission mode and — with CLI Agents — the session agent on the plugin, a project or any section; inherited group by group |
| Session context     | Experimental core only: narrow the BB plugins, skills, MCP servers and CLI plugins a session loads, per plugin, project or section                                                  |
| Appearance          | 118 icons in 7 groups or any emoji, 12 colors or a custom one, 4 fill styles, 4 presets, color by level or by project, per-item looks with inheritance                              |
| Archive             | Archive a section with nested sections, files and chats; restore it to the same path                                                                                                |
| Devices             | One project with a working copy on each connected machine                                                                                                                           |
| Moves               | Move a whole project, move or re-link a section, move a chat between sections — on its own device the chat's working folder goes with it                                            |
| Settings            | One settings screen on the management page and in BB settings; shared by all devices                                                                                                |
| Import & export     | Settings and looks as a JSON file                                                                                                                                                   |
| Languages           | 11 interface languages, English by default                                                                                                                                          |

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
- **New section** — from the project or section **⋯** menu, from a right-click on its heading, or from the section card. Create a new subfolder or pick an existing one. A nested section can also live on another device where the project has a folder.
- **Levels** — the project root is level 0, its sections level 1, their subsections level 2, and anything deeper level 3+. Levels decide the default look. The project root uses the project rules template; a section of any depth uses the sections template.
- **Rename** — changes only the label; the directory path stays.
- **Change path** — moves a section to a new folder or re-links it to a folder renamed outside BB (see [Move and delete](#move-and-delete)).
- **Order** — drag projects and sections up or down on the management page, or use **Move up / Move down** in the row menu. The order is stored in the plugin database and used everywhere.
- **Name reuse** — creating a section with the name of an archived one on the same project and device offers to restore it with its history instead.

### Groups

A **group** arranges sections in the tree without a folder of its own — for example an _Apps_ group holding sections that point to different places.

- **New group** — from any project, section or group **⋯** menu, or from a card. Only a name is needed.
- **New section** inside a group creates its folder where the group sits: in the nearest real folder above, or in the project root. A group can hold sections from other devices too (see below).
- **Move to group…** (section menu, card, or drag a row onto a group on the management page) changes only the place in the tree; the folder, files and chats stay where they are. A section can move between groups that share its parent folder; a section on another device or outside its parent folder can move to any group or section of its project.
- Groups have no chats and no rules and do not count as a level, so a section inside a group keeps the rules of its own depth. Their default icon differs from sections and can be styled like any section.
- **Delete group** works on an empty group. Archiving a section also archives the groups inside it and restores them with it.

### A section in a folder outside the project

A section can live on another device than its parent section or group, and point at any folder on its device, not only a subfolder of its parent — for example a client's website on a server:

```text
Clients                          Project (Mac mini: ~/Documents/Clients)
└── example-client.com/                 Section on Mac mini
    └── Development              Group
        └── Sites  Server    Section → /var/www/example-client
```

- In **New section** of a section or group, every device where the project has a folder is available; on another device the section starts in that device's project folder.
- Pick the device, press the folder button and go up to any folder on that device. A folder inside the parent stays an ordinary subfolder; any other folder becomes the section's path as is.
- The folder must not be the disk root, contain or sit inside another section or BB project, or contain the project folder. The device still needs a project folder (add one in the project card): BB runs chats on devices where the project has a copy.
- The tree marks a section whose device differs from its parent's with a device badge.
- Chats started there work in that folder, and the section gets `AGENTS.md`, `CLAUDE.md` and `.bb/chats/` like any section. On a folder served by a web server, keep those files out of public access.
- **Archive** leaves such a folder in place: only its chats and its tree record go to the archive, and restore brings them back. A section that holds sections on other devices or outside its folder must have them moved or archived first.
- **Change path** can move it anywhere on its device except into another project.

The folder picker, shared by the project and section dialogs, browses the selected device, creates child folders and can delete an **empty, unregistered** folder after confirmation. It never deletes files recursively.

## The sidebar tree

The plugin adds a thread list to BB's sidebar: projects, their sections and subsections, and the chats inside each of them. Chats without a project are grouped under **No project**.

- **Chat-plus button** on every project and section heading opens a new chat bound to that folder.
- **⋯ menu or right-click** on a heading: New project, New section, Configure (opens its card on the management page), Appearance, Chat sorting, Move, Working rules, Rename, Change path, Delete or Archive.
- **Unread** — a project or section name turns bold when any chat anywhere below it is unread (can be turned off).
- **Auto-collapse** — a section with no chat activity for a set time (2 hours by default) collapses. It stays open while an agent is running in it or one of its chats is open. A section you collapse or expand by hand keeps your choice; a manually collapsed section stays collapsed even while an agent works inside.
- **Short lists** — each project root, section and the No project group shows the newest chats up to the limit and chats opened in the last 48 hours; **Show all** expands only that list.
- **Pinned chats** stay on top of their list.
- **Drag a chat** onto another section or the project root to move it; on the same device its working folder follows (see [Move and delete](#move-and-delete)).

## Starting chats in the right folder

Pressing chat-plus on a project or section opens BB's standard composer on the management page. The composer's project control becomes a **project/section tree**, indented by depth. A project with copies on several machines appears once; pick the folder, then pick the machine in the composer's device control — the chat starts in that copy's folder. Sections of every device stay in the same tree; a section still lives on its own device. The tooltip shows the destination path. Errors stay visible and keep your draft.

Inside an open chat, the project name on the composer's project control is replaced with the section path, so you always see where the agent works.

Every chat started from BB also receives short instructions: store reports in `.bb/chats/<chat-id>/artifacts/`, notes in `notes/`, throwaway files in `tmp/`, never edit the exported `thread.json` or `history/`, and read the applicable `AGENTS.md` files including parent folders.

## BB's own New thread screen

The plugin's own new-chat surface is not the only way in. BB's New thread screen — including the one behind **Hand off to a new thread** — knows projects, not folders, so a chat started there used to land in the project root.

Its project chip now opens the tree: projects with their sections under them, on every device. Pick a place and the composer switches to it — the project, and the environment that starts the chat in that folder. The same choice is available one level deeper, in the environment picker's **Project section** entry, which draws the sections of the chosen project and device as an indented tree. Either way the chat starts in that section's folder. The folder belongs to the project, so retiring the chat's environment never touches it.

Every project BB offers is in the chip, in BB's own order, including **No project** and a project the plugin has no folder for: replacing the chip must not take a place to work away.

When BB's chip cannot be found — a composer the plugin does not recognise — a **Section** control appears in the action row instead, next to the model and the machine, and does the same job.

A line under the composer names the section a reused environment belongs to, which is what a handed-off chat needs: BB's project chip says the project and nothing more.

## Settings

The same settings are available in two places, and they are identical:

- **Management page** — a **Settings** block sits above the project tree in the left column: Chat list, Appearance, AGENTS.md rules, Provider and agent, Section archive, Import & export, Language. Pick an item to open it; pick a project or section to open its card. A deep link `settings/<section>` opens a section directly.
- **BB settings → Projects & Sections** — the same sections with their own side menu.

Settings (except the language) are stored on the BB server, so every device and browser sees the same values, and open windows update immediately.

## Chat list

![Chat list settings: chat order, section collapsing and tree view.](docs/images/chat-list.webp)

**Chat order**

- **Chat sorting** — Recent activity (default), Alphabetical or Newest first. Activity uses BB's update and attention timestamps, so a new message moves a chat up. Also available from any heading's **⋯ → Chat sorting**.
- **Chats per section** — 1–100 (default 10). The rest open with **Show all**.
- **Hide chats without a visit, hours** — 0–720 (default 48). Chats nobody opened for longer than this also hide under **Show all**. Zero turns the age rule off. Pinned, unread, busy and the open chat stay in the short list.

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

| Preset     | Look                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------ |
| Standard   | Plain folder icons, no colors                                                              |
| Monochrome | Briefcase badge for projects, folder, open folder and layers icons in gray                 |
| By level   | Blue badge for projects, violet level 1, teal level 2, amber level 3+                      |
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

**Per project and per section** — a project or any section card, and its **Working rules** dialog, has three tabs; the open tab is what the folder uses once saved:

- **Default** — the shared templates.
- **Custom template** — its own template (for a project: a project template and a template for new sections inside it), its own custom rules and target, its own startup instruction. The nearest override wins down the tree.
- **Own file** — edit that device's `AGENTS.md` and `CLAUDE.md` directly; the plugin writes nothing there and Apply skips the folder.

A chat can set all of this too: `bb project-folders rules show|set <project-id> <folder-id-or-dash>` writes the same record this card writes, which is how an agent asked for "rules for this section" leaves it on **Custom template** rather than typing into the file behind the plugin's back. Saving a custom template writes it into that place's `AGENTS.md` straight away.

An existing `AGENTS.md` without the plugin markers is treated as yours: the folder opens on **Own file** and nothing is injected. Saving detects concurrent edits and refuses to overwrite a changed file. When a project has copies on several devices, rules are written to every copy.

## Provider, model and agent

A new chat opens with whatever BB remembers for the project. That is enough until one section is a website you review with Claude Code and the next is research you run on a cheaper model.

Any place in the tree can pin what its chats start with — the plugin as a whole (**Settings → Provider and agent**), a project, and every section, however deep, on its card:

- **Own provider and model** — BB's own picker, including the reasoning level and the service tier.
- **Own permission mode** — accept-edits, auto or full.
- **Agent** — a native session agent for Claude Code, Codex or OpenCode. This one needs the [CLI Agents](https://github.com/VKirill/bb-plugin-cli-agents) plugin; without it the two rows above work as usual.

The three groups are inherited one at a time, and the nearest place wins: a section can take its project's model and still pin its own agent, or set **No agent** to refuse the one its project pinned. A group left off falls through to the section above, then the project, then the plugin, then BB's own remembered choice. Nothing is written to disk, and nothing changes BB's defaults.

They are seeds, not locks. The composer opens with them filled in, and its own controls still win for that one chat. A pinned agent is bound to the chat it was created for, so two chats started at the same moment never take each other's agent, and an agent chosen by hand in the composer wins over the pinned one. When a pinned agent cannot be applied — the machine is offline, the agent was renamed, CLI Agents is off — the chat is not created and the message says which place pinned what. Switching the composer to a CLI without session agents is not an error: the agent simply does not apply, because it belongs to its own CLI.

## Session context

> [!NOTE]
> Experimental. This needs a BB build with the VK session-policy extension (`bb.agents.experimental_vkSessionPolicy`). On stock BB the section is hidden and the plugin sends nothing.

By default an agent session loads everything installed: every BB plugin's instructions and tools, a few hundred skills, every MCP server of the CLI. A section for copywriting does not need the SEO toolkit, and a research section does not need Discord.

The plugin (**Settings → Session context**), a project and any section, on its card, can narrow four groups:

- **BB plugins** — their instructions, agent tools and skills.
- **Skills** — by name, BB skills and the CLI's own ones; a trailing `*` matches a prefix (`lane-stack:*`).
- **MCP servers** — the ones the CLI loads from its settings on the machine.
- **CLI plugins** — Claude Code and Codex plugins.

Each group is **Inherit**, **All**, **Only selected** or **All except selected**. The editor offers names found on the section's machine; any other name can be typed in. **BB-wide instructions** turns on or off the text of `<dataDir>/AGENTS.md` on the BB server (`~/.bb/AGENTS.md`), which BB adds to every session; the card shows the path and says when the file does not exist. Without a rule it is BB's default: included. Groups are inherited one at a time, like the provider and model: the nearest section, then the project, then the plugin. **All** lifts a restriction a parent set.

How far a rule reaches depends on the CLI: Claude Code and Codex honor every group, OpenCode everything except CLI plugins, Cursor (and Grok models run through it) only BB plugins. The rules apply when a session is built, so a running chat picks them up on its next session start.

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
- The sidebar and the new-chat folder picker keep one entry per project; the composer's machine control chooses which copy the chat opens in.
- Each copy has its own sections, chats and `AGENTS.md`; project-level rules are written to all copies. The last copy cannot be removed, and a copy with sections or chats must be cleared first.

## Move and delete

**Move a project** (card or **⋯ → Move**) — relocate the whole project folder with hidden files, rules, nested sections, chat exports and archives to a new path on the **same device and disk volume**. The old path becomes a symbolic link so existing chats keep working. Running chats and queued work must finish first. Home folders, BB runtime directories, linked Git worktrees and projects with environments outside their folder cannot be moved. Interrupted moves appear as **Unfinished moves** with **Retry**.

**Change a section path** (**⋯ → Change path**) — pick a folder inside the same project on the same device:

- a **new folder** — the section moves with files, nested sections, chat exports and archive manifests;
- an **existing folder** — the section re-links to it without touching files, the fix for a folder renamed outside BB.

Either way the old path stays as a link; unfinished moves are retried from **Unfinished section moves**.

**Delete a project** — **Leave files in place** (default) only removes it from the tree; **Move files to the archive** relocates the folder to `<parent>/.bb/archive/projects/<id>/folder`. The project's BB chats are deleted. Nothing is removed from a Git remote.

**Move a chat to another section** — **Move to section…** in a chat menu, or drag the chat onto any section or the project root of its project. A group refuses a chat, because a group holds sections and has no folder of its own.

A section on the chat's own device takes the chat's **working folder** with it, together with the chat's `.bb/chats/<id>` storage. BB has no plugin API for repointing an existing chat ([get-bb/bb#3904](https://github.com/get-bb/bb/issues/3904)), so the plugin asks the chat itself: the chat receives one agent-only request and calls its own `update_environment_directory`. That costs one turn of the chat's model and needs a provider whose agent has that tool — Cursor Grok, for one, does not have it. The chat is filed into the destination straight away, so the tree shows the move at once; if the chat does switch, its `.bb/chats/<id>` storage follows and the filing is dropped. If it cannot, the folder simply stays and the chat keeps the badge naming the machine it runs on.

A section on **another device** only takes the place in the tree — a chat cannot change machine. That is the one case worth marking: the chat is badged with the machine it runs on, keeps the full path in the badge's tooltip, and offers **File back where it works** in its menu. Filing a chat inside its own device leaves the row unmarked.

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
bb project-folders place-chat <thread-id> <project-id> <folder-id-or-dash>
bb project-folders unplace-chat <thread-id>
bb project-folders move-chat <thread-id> <project-id> <folder-id-or-dash> <host-id>
bb project-folders archive <folder-id>
bb project-folders archives
bb project-folders restore <archive-id>
bb project-folders copy-add <project-id> <host-id> <path>
bb project-folders copy-remove <project-id> <host-id>
bb project-folders delete-project <project-id> keep|archive
bb project-folders sync <thread-id>
```

`forget` is a compatibility alias for `archive`. Groups are managed from the interface.

## Requirements, data and limitations

- BB 0.43+ with Plugin SDK 0.4.84+ (uses experimental sidebar and composer surfaces).
- Connected macOS or Linux devices with local-path project sources. Windows paths are not supported. Live-tested on macOS.
- No account, API key, paid service or external server.
- **Stored by the plugin:** section records, order, rules modes, archives, move journals, preferences and looks — in the plugin database on the BB server. Only the language choice lives in the browser.
- Moves work within one device and disk volume. A chat's working folder moves through the chat's own agent, so it needs a provider with the directory tool and spends one turn. Some SDK surfaces are experimental and may need updates with future BB versions.
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
