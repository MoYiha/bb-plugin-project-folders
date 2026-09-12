# Changelog

## 0.3.4-rc.2 (local)

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
