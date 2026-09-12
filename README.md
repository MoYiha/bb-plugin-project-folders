# Projects & Sections for BB

Organize BB projects into real folders, nested sections and chats that start in the right working directory. Archive a section with its files and restore it later with its original chats and rules.

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
2. Open the project's **⋯** menu and choose **New section**. Create a folder or select an existing one.
3. Use the section's **chat-plus** button. BB's standard composer opens with that section's working directory selected.
4. Add **Working rules** for the section when it needs its own conventions.
5. When the work is finished, **Archive** the section. Restore it later from the archive, or accept the restoration offer when reusing its name.

## Give each section its own rules

Keep coding conventions with the website and research instructions with the research folder. The rules editor reads and writes that folder's `AGENTS.md`; agent instructions also ask agents to read applicable parent rules.

![Working rules editor for the Website section, showing its AGENTS.md file and example source, check and report conventions.](docs/images/rules.png)

*Rules are ordinary files beside your work. Section renaming changes its label while preserving its directory path.*

This is useful when one project contains several workstreams: chats start in the intended directory, supporting reports have a dedicated place, and completed sections can leave the active tree without losing their files and history.

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
- **New chat:** use the chat-plus button. Section chats use BB's standard composer and the section's directory. Project chats use BB's normal project environment selection.
- **Rules:** edit `AGENTS.md` in the selected project or section. Conflicting edits are rejected until the file is reopened.
- **Rename:** changes the displayed section name without moving its directory.
- **Language:** English is the default for every new installation. Choose English, Russian, Spanish, French, German, Portuguese, Simplified Chinese, Japanese, Korean, Hindi or Arabic on the management page. The selection is saved in this browser. Arabic uses right-to-left layout. Unsupported language settings fall back to English. Backend diagnostics and generated documentation use English. Project names and file contents are never translated.

## Sort and shorten chat lists

Open **List settings** above the sidebar tree or on the management page. Sort chats by recent activity (default), name, or creation time. Pinned chats remain first; activity uses BB's update and attention timestamps, so a new message or attention event can move a chat up within its project or section.

Each project or section shows up to **10 chats** initially. Set any limit from 1 to 100. **Show all** expands only that list; **Show fewer** restores the limit. The same limit applies separately to project-root chats, each nested section and chats without a project. Settings are saved in the current browser and update open plugin views immediately.

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

## Commands

```
bb project-folders list --json
bb project-folders create <project-id> <parent-id-or-dash> <name> <relative-path> [host-id]
bb project-folders sync <thread-id>
bb project-folders archive <folder-id>
bb project-folders archives --json
bb project-folders restore <archive-id>
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
