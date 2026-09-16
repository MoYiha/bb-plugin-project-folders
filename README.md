# Projects & Sections for BB — Real Folders, Section Chats & Restorable Archives

[![BB Compatibility](https://img.shields.io/badge/BB-%3E%3D0.43-blue.svg)](https://getbb.app)
[![Plugin SDK](https://img.shields.io/badge/Plugin%20SDK-%3E%3D0.4.84-green.svg)](https://getbb.app)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/VKirill/bb-plugin-project-folders?include_prereleases&color=orange)](https://github.com/VKirill/bb-plugin-project-folders/releases)

> Organize BB projects into real folders, nested sections, and chats that start in the right working directory. Archive a section with its files and restore it later with its original chats and rules. Interface available in 11 languages.

[Русский](README.ru.md) · [Report an issue](https://github.com/VKirill/bb-plugin-project-folders/issues)

## See your project as a workspace

Keep website work, research and design under one project, with a real folder for each section. Each section can have its own chats and working rules, while a project-level chat can work across the project when its environment is the project root.

![Real section hierarchy in BB: Launch Studio contains Research and Website, with Design nested inside Website.](docs/images/sections.png)

*The installed plugin with demonstration data: section folders, nested sections, rules, rename and archive actions.*

For example, you could organize work like this:

```text
Launch Studio                     Project
├── Project planning              Chat in the project root
├── Research/                     Section folder
│   └── Compare customer needs    Chat in Research
└── Website/                      Section folder
    ├── Build the landing page    Chat in Website
    └── Design/                   Nested section folder
        └── Review the layout     Chat in Design
```

The folders exist on the selected connected device. Chats appear in the tree under their working folder; they are not extra project directories. Their exported history and supporting files go into hidden `.bb/chats/` folders.

## From a folder to a working chat

1. Create a project and choose its device and folder.
2. Open the project's **⋯** menu or right-click the project or section heading and choose **New section**. Create a folder or select an existing one.
3. Use the section's **chat-plus** button. BB's standard composer opens with that section's working directory selected.
4. Add **Working rules** for the section when it needs its own conventions.
5. When the work is finished, **Archive** the section. Restore it later from the archive, or accept the restoration offer when reusing its name.

## Give each section its own rules

Keep coding conventions with the website and research instructions with the research folder. The rules editor reads and writes that folder's `AGENTS.md`; agent instructions also ask agents to read applicable parent rules.

![Working rules editor for the Website section, showing its AGENTS.md file and example source, check and report conventions.](docs/images/rules.png)

*Rules are ordinary files beside your work. Section renaming changes its label while preserving its directory path.*

This is useful when one project contains several workstreams: chats start in the intended directory, supporting reports have a dedicated place, and completed sections can leave the active tree without losing their files and history.

### Default rules for new sections

Plugin settings provide separate **project** and **sections** AGENTS.md templates with an auto-create toggle. The shipped presets are in English (cheap for agents to consume) and combine working-project discipline with Karpathy-style coding guidelines — edit them freely in the plugin settings. Creating a project, section or subsection writes the matching template between service markers at the end of that folder's `AGENTS.md`:

```
<!-- bb-project-folders:agents:start -->
…your default instructions…
<!-- bb-project-folders:agents:end -->
```

Content above the markers is never modified. If the file already exists, the block is appended at the bottom; changing the template later rewrites the same block in place. **Apply to existing sections** — on the management page or in the plugin settings — writes the effective template into every project and section at once and reports updated, unchanged and failed counts. Turn off auto-creation or clear the templates to stop seeding.

Rules are hierarchical. The plugin settings hold the shared defaults. Selecting a project or section in the management page opens three tabs — **Default**, **Custom template** and **Own file** — and the open tab is what the folder uses once saved. **Own file** shows the AGENTS.md and CLAUDE.md of the selected device as editors and keeps the plugin out of them: no template, no custom-rules block, and **Apply to existing sections** skips the folder. A folder whose AGENTS.md carries no plugin markers — a folder you wrote by hand — opens on that tab by itself. The custom tab holds **project-level overrides**: a different project template for that project's root and a different sections template for new sections inside it. First and second level sections can set their own template the same way — nearest override wins, otherwise the project's, otherwise the shared one. **Third-level sections get no rules** — the Rules action is hidden and no template is seeded there.

Manual ordering: drag projects and sections up or down in the tree, or use the **Move up** / **Move down** actions in the row menu. The order is stored in the plugin database and used in the management page and the sidebar.

## Requirements and installation

- BB 0.43+ with Plugin SDK 0.4.84+ APIs, including the experimental sidebar and new-thread composer surfaces.
- Connected macOS or Linux devices with local-path project sources. Tested live on macOS and with isolated SDK/filesystem tests. Windows paths are not supported in this release.
- No extra account, API key, paid service or external server is required by this plugin.

Install using BB's plugin installer with the public Git repository URL:

```
bb plugin install https://github.com/VKirill/bb-plugin-project-folders.git --yes
```

Enable the Projects & Sections thread list in BB's sidebar customization if BB does not select it automatically. The management page is also available in plugin navigation.

## Everyday use

- **New project:** choose a connected device, name and existing or new folder.
- **New section:** open a project's three-dot menu. Choose a project source on a device and create a subfolder or select an existing one. Nested sections stay on their parent's device.
- **New chat:** use the chat-plus button in the sidebar tree or on the management page. The composer's project control becomes a project/section tree, so a new chat can be bound to the project root or any nested section before sending.
- **Rules:** edit `AGENTS.md` in the selected project or section. Conflicting edits are rejected until the file is reopened. New sections can receive a default template automatically (see above).
- **Rename:** changes the displayed section name without moving its directory.
- **Change path:** moves a section to a new folder on the same device, or re-links a section whose directory was renamed outside BB (see [Move a section](#move-a-section)).
- **Language:** English is the default for every new installation. Choose English, Russian, Spanish, French, German, Portuguese, Simplified Chinese, Japanese, Korean, Hindi or Arabic on the management page. The selection is saved in this browser. Arabic uses right-to-left layout. Unsupported language settings fall back to English. Backend diagnostics and generated documentation use English. Project names and file contents are never translated.

The composer integrates a project/section tree into the project control beneath the editor, for chats created on a project or on a section. The selected hierarchy is shown on the control; its tooltip contains the destination path. Use it to choose the project root or a nested section before sending. Submission errors remain visible and preserve your draft.

## Sort and shorten chat lists

Open the project or section **⋯ → Chat sorting** menu to change the order. The display limit is available under **Settings** on the management page. Sort chats by recent activity (default), name, or creation time. Pinned chats remain first; activity uses BB's update and attention timestamps, so a new message or attention event can move a chat up within its project or section. Sections with no chat activity for a while (2 hours by default, adjustable) are automatically collapsed to keep the tree clean (toggleable in settings and in the section menu).

Each project or section shows up to **10 chats** initially. Set any limit from 1 to 100. **Show all** expands only that list; **Show fewer** restores the limit. The same limit applies separately to project-root chats, each nested section and chats without a project. Settings are stored on the BB server, so every device shows the same values, and open plugin views update immediately. A section can override the sort order and the limit in its **Appearance** dialog.

## One settings screen, your own look

The management page and the plugin page in BB settings show the same settings sections: **Chat list** (sorting, limit, auto-collapse threshold, bold unread sections, density, indent), **Appearance**, **AGENTS.md rules**, **Section archive** and **Import & export**. On the management page they are listed under **Settings** in the tree sidebar above the projects; in BB settings they have their own side rail.

**Appearance** sets an icon, a color and a fill for projects and for sections of levels 1, 2 and 3+. Icons come from a curated Hugeicons set with search, or any emoji. Colors are twelve theme-friendly swatches or a custom color; fills are none, an icon badge, a left stripe or a row background. Presets apply a whole look in one click: **Standard**, **Monochrome**, **By level** and **By project** — in the last one every section takes the color of its project. Any project or section can get its own look from **⋯ → Appearance**, optionally applied to all nested sections without their own. **Import & export** saves the whole setup to a JSON file.

## Files and chat history

```
<project-or-section>/
  AGENTS.md
  .bb/chats/<thread-id>/
    thread.json
    history/index.json
    history/<snapshot>/page-00000.json
    artifacts/
    notes/
    tmp/
```

BB remains the canonical chat store. The plugin exports paginated history after chat creation, completed turns and archiving. It publishes the snapshot index only after the full snapshot is written. Binary attachments remain in BB; these exports are not a standalone backup of BB.

Agent instructions direct supporting documents to `artifacts/`, notes to `notes/` and temporary files to `tmp/`. This organizes files; it is not a filesystem access boundary. Project work and code remain in their intended working folders. Hidden directories may still be tracked by Git: add appropriate ignore rules for your project before sharing it.

## Archive and restore

**Archive** moves a section and nested sections into `<project-root>/.bb/archive/sections/<archive-id>/folder` on the same device. A manifest and the plugin's operation journal preserve original paths and section IDs. Its chats are archived and blocked from new messages until restoration.

Running chats, queued work and another project's sources or environments inside the folder prevent the move. **Restore** returns files to the original path and restores previously active chats. It refuses to overwrite an occupied path. Creating a section with a matching archived name on the same project and device offers restoration or explicit creation of a new section.

Interrupted operations remain visible with **Retry**. Permanent archive deletion is not provided. Keep the plugin's database and BB chat storage in your normal backups; the archive folder alone does not recreate BB's database. Disabling or uninstalling the plugin does not move archived folders back; restore sections first if you want to keep using those chat environments without the plugin.

## One project, many devices

A project can keep a working copy on every device: the Mac, the Mac mini, a server. Open **Working copies** from the project root's **⋯** menu or details pane, pick a device and a folder — the plugin creates the folder if it is missing, seeds the AGENTS.md rules and registers it as a project source. The sidebar keeps one entry per project; the details pane switches between copies with device tabs, and each copy carries its own path, sections, chats and AGENTS.md. The tabs list **every** machine, not only the ones already holding a copy: a machine without one says so and offers **Add copy**, which opens the Working copies dialog with that device preselected. A solid bolt on a tab means the machine is connected; a faded tab means the project has no copy there. The path itself sits next to the tabs as a field with a folder button that opens the device's folder browser (folders can be created there). Pick a place where the project is not yet, and the button becomes **Move** — the folder relocates with everything inside; pick a place that already holds the project folder, and it becomes **Use this folder**, which only re-registers it. The same picker is available for every copy in the Working copies dialog. New chat dialogs offer every device where the project has a copy. The last copy cannot be removed; a copy with sections or chats in the tree must be cleared first.

## Move a project

Choose **Delete** on the project card or in its **⋯** menu to remove the project from the BB tree. **Leave files in place** (default) only unregisters the project; the folder stays. **Move files to the archive** relocates that one local folder to `<parent>/.bb/archive/projects/<id>/folder`. BB chats belonging to the project are deleted. The plugin refuses to move files when the folder is also a section of another project or contains another project. This does not delete a GitHub remote.

Choose **Move** on the project card or in its **⋯** menu. Browse for a destination parent folder, then confirm the new project path. The entire project directory moves together: files, dotfiles, working rules, nested sections, chat exports and section archives. Project sources and the plugin's section/archive paths are updated.

Existing BB environments keep their stored working paths, so the old directory is replaced by a symbolic link to the new location. Keep that link while existing chats use it. BB's central database, attachment storage and files outside the project directory are not relocated. A project source on another device is unchanged.

Relocation currently works on the **same device and disk volume**, to a path that does not exist. Finish running chats and queued work first. Home folders, BB runtime directories, linked Git worktrees and projects with environments outside their source folder cannot be moved this way. Interrupted moves appear on the management page with **Retry**; new messages are blocked until the move is completed.

## Move a section

Choose **Change path** in a section's **⋯** / right-click menu or on its card (CLI: `bb project-folders move-section <folder-id> <absolute-path>`). The section must stay inside its project folder on the same device and may not land inside another section or on an already registered path. Two modes follow what the picker finds:

- **New folder** — the section directory relocates entirely: files, dotfiles, working rules, nested sections, chat exports and archive manifests; the plugin's records follow it.
- **Existing folder** — the section re-links to a directory that already holds its files. This is the repair path for a folder that was renamed or moved outside BB: the recorded path is re-pointed, no files are touched.

Either way the old path becomes a symbolic link so existing chats keep working; keep it while they do. Workspace paths recorded before a completed move resolve through it, so chat labels, bindings and history exports keep pointing at the right section. Running chats and queued work must finish first; interrupted moves persist a barrier and are retried from the same destination via the **Unfinished section moves** card or the same CLI call.

## Commands

```
bb project-folders list --json
bb project-folders create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id]
bb project-folders copy-add <project-id> <host-id> <path>
bb project-folders copy-remove <project-id> <host-id>
bb project-folders sync <thread-id>
bb project-folders archive <folder-id>
bb project-folders archives --json
bb project-folders restore <archive-id>
bb project-folders delete-project <project-id> keep|archive
```

`forget` is a compatibility alias for `archive`.

## Development

```
npm ci
npm run typecheck
npm test
npm run build
```

Tests cover path boundaries, multiple devices, composer forwarding, rule conflicts, paginated history, archive/restore, interrupted moves and language fallback. The plugin uses the public BB Plugin SDK without modifying BB core. Some SDK surfaces are experimental; future BB changes may require plugin updates.

## License

MIT. Vendored BB UI source retains its attribution in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Moving existing chats (requires a BB core patch)

Right-click a chat or use its `…` menu and choose **Move to section…**. You can also drag a chat onto a section or the project root. The destination must belong to the same project and device. Chat identity and history stay intact; only the chat's `.bb/chats/<id>` directory moves. Repository files and other project files do not move.

This feature requires BB's experimental directory-update API (`threads.update.experimental_directory`), supplied by the [companion BB core patch](docs/bb-native-thread-relocation.patch), based on BB 0.43.1. Stock BB 0.43.0 and 0.43.1 do not have it: an unsupported server reports an error without moving files, and every other feature of the plugin keeps working. The patch also hides native browser panes while plugin dialogs are open; it must be applied to the BB UI used by the desktop client.

Active chats and queued messages prevent relocation. If storage relocation fails after the environment switches, a durable journal blocks new messages and exports. Repeat the same move to finish it. Existing destination folders are never merged or overwritten.

### Folder picker

The project and section dialogs share a compact picker adapted from BB’s RemotePathBrowser. Use the folder-plus button to create a child folder on the selected device. The trash button asks for confirmation and removes only an empty, unregistered folder. Files and section history are never recursively deleted by this action; archive registered sections instead.

## Tags & Ecosystem
`bb`, `bb-plugin`, `project-folders`, `sections`, `workspace-organization`, `file-manager`, `developer-tools`, `i18n`

