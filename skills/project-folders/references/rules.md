# Rules for a project or a section

What to do when the user says "write AGENTS.md rules for this section", "set up
rules for the project", or "make the agents work with this bot the right way".

## The one mistake to avoid

Writing the text into `AGENTS.md` by hand looks like it worked and is not the
job. The plugin keeps its own record of who owns each folder's rules, and an
edit made behind its back leaves that record on **Default**:

- the card keeps saying "The template comes from the plugin settings";
- the next **Apply to existing sections** rewrites the managed block and the
  text is gone;
- a new subsection inherits the shared template, not the one just written.

Set the rules through `bb project-folders rules set`. It writes the same record
the card writes, and it writes the file too.

## The three modes

| Mode | Card tab | What it means |
| --- | --- | --- |
| `default` | По умолчанию / Default | This place uses the shared template from the plugin settings. It has no text of its own. |
| `custom` | Свой шаблон / Custom template | This place has its own template, its own custom rules and its own startup instruction. Saving stamps the template into this folder's `AGENTS.md` between the plugin's markers. |
| `own-file` | Свой файл / Own file | The file belongs to the user. The plugin writes nothing there and Apply skips the folder. |

Rules exist for a project and for a section of any depth. Groups have no
rules. Inheritance is nearest ancestor, then the project, then the shared
templates.

## What is written where

- The managed block sits at the **end** of `AGENTS.md` between
  `<!-- bb-project-folders:agents:start -->` and `:end`. Everything above the
  markers belongs to the user and is never touched.
- `CLAUDE.md` of a project root becomes a one-line bridge (`@AGENTS.md`), so
  Claude Code reads the same rules.
- Custom rules have a target: `file` writes them into `AGENTS.md`/`CLAUDE.md`
  (terminal agents read them too), `session` passes them only to agents started
  from BB and writes nothing to disk, `both` does both. Choose `session` for
  routing and delegation talk that has no business in a repository.
- The startup instruction is a one-shot line added to the first message of
  every new chat in that place. It never lands in a file and never repeats.

## Inheritance

Nearest place wins, per kind of rule: the section, then its ancestors, then the
project, then the plugin-wide settings. A section that sets only a startup
instruction still takes its template from the project.

## The commands

```sh
# Read what a place has now. A dash is the project root.
bb project-folders rules show <project-id> <folder-id-or-dash> --json

# Give a section its own template.
bb project-folders rules set <project-id> <folder-id> \
  --mode custom --template "<markdown>" --json

# Long text is easier from a file the agent just wrote.
bb project-folders rules set <project-id> <folder-id> \
  --mode custom --template-file /abs/path/rules.md --host <host-id> --json

# A project: --template is the project's own, --sections-template is what its
# new sections start from.
bb project-folders rules set <project-id> - \
  --mode custom --template "<markdown>" --sections-template "<markdown>" --json

# Rules for BB sessions only, plus a startup instruction.
bb project-folders rules set <project-id> <folder-id> \
  --custom "Ask the owner before deploying." --target session \
  --startup "Report the service status first." --json
```

Flags that are not passed keep their current value, so a second call can add a
startup instruction without repeating the template. `rules show` after a `set`
returns the stored record — read it back instead of assuming.

Resolve ids with `bb project-folders list --json`. `--host` selects which copy
of a multi-device project the file paths are read from.

## Writing the text

Write in the language of the project's own `AGENTS.md`. Keep it to what an
agent must know to work **here**, and do not restate the project rules — the
agent reads both files.

A section that holds a running service or a bot usually needs:

```markdown
# <Section name>

What this folder is, in one sentence: what runs here and where it runs.

## Working rules
- What is production and what happens on a change (deploy, restart, migration).
- The definition of done for a change here.
- How to deliver: the exact command, and what must never be overwritten.
- Where secrets come from — a source, never a value.

## Layout
- Which file holds what, so an agent edits the right one.

## Do not
- The two or three actions that cost money, data or trust.
```

Facts only: commands that exist, paths that exist, services that exist. Check
them before writing. No secrets, no tokens, no passwords — name the variable
and where it lives.

## Not rules

Provider, model, reasoning level, permission mode and the session agent are not
AGENTS.md rules: they live in the **Provider, model and agent** block of the
same card and are inherited the same way. Rules say how to work; that block
says what starts the work.
