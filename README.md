# Projects & Sections for BB

Organize BB projects into real folders, nested sections and chats that start in the right working directory. Archive a section with its files and restore it later with its original chats and rules.

[Русский](README.ru.md) · [Report an issue](https://github.com/VKirill/bb-plugin-project-folders/issues)

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
