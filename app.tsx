import { FolderBrowser } from "./folder-browser";
import { ThreadSectionLabel } from "./thread-section-label";
import {
  MoveDialog,
  PendingMoves,
  PendingSectionMoves,
  SectionMoveDialog,
} from "./move-dialog";
import { ChatSortMenu } from "./chat-settings";
import {
  PluginSettings,
  SettingsNav,
  SettingsPane,
  isSettingsSection,
  type SettingsSection,
} from "./plugin-settings";
import {
  AppearanceDialog,
  Glyph,
  rowDecoration,
  useFolderLook,
} from "./appearance";
import { Help, RuleFields, type RuleDraft } from "./agents-apply";
import {
  sortChats,
  isSectionCollapsed,
  parseCollapseState,
  type CollapseRecord,
  hasFolderUnread,
} from "./chat-list";
import { t, useLanguage, LanguagePicker, direction } from "./i18n";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  type DragEventHandler,
} from "react";
import {
  definePluginApp,
  useRpc,
  useRealtime,
  useBbNavigate,
  experimental_useSidebarThreads,
  experimental_useSidebarThreadActions,
  experimental_NewThreadComposer as NewThreadComposer,
  type PluginThreadListProps,
  type PluginNavPanelProps,
  type PluginSidebarThread,
} from "@get-bb/plugin-sdk/app";
import { createPortal } from "react-dom";
import type { Folder, ComposerRequest, rpcContract } from "./server";
import type { Archive } from "./archive";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "./components/ui/dropdown-menu";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Icon } from "./components/ui/icon";
import "./style.css";
type Target = { projectId: string; folderId: string | null };
type Modal = {
  action: "create" | "rules" | "rename" | "forget" | "remove";
  target: Target;
  folder: Folder;
  /** 0 = project root, 1 = section, 2 = subsection; 3+ has no rules. */
  level: number;
  /** Per-device copies of the project root, for the rules tabs. */
  copies?: Folder[];
  /** Preset the rules dialog to this device's tab. */
  rulesHost?: string;
};
function useTree() {
  const rpc = useRpc<typeof rpcContract>();
  const [data, setData] = useState<{
    folders: Folder[];
    roots: Folder[];
    bindings: Record<string, string>;
    errors: string[];
    machines: { id: string; name: string; connected: boolean }[];
  }>({ folders: [], roots: [], bindings: {}, errors: [], machines: [] });
  const [error, setError] = useState("");
  const refresh = useCallback(() => {
    rpc.call("list").then(
      (d) => {
        setData(d);
        setError("");
      },
      (e) => setError(String(e)),
    );
  }, [rpc]);
  useEffect(refresh, [refresh]);
  useRealtime("changed", refresh);
  return { rpc, data, error, refresh };
}
function FolderDialog({
  modal,
  onClose,
  onCreated,
}: {
  modal: Modal | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [hostId, setHostId] = useState("");
  const [locations, setLocations] = useState<
    {
      hostId: string;
      name: string;
      path: string | null;
      available: boolean;
      reason: string | null;
    }[]
  >([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const selectedLocation = locations.find((l) => l.hostId === hostId);
  const folderPath =
    modal?.action === "create"
      ? (selectedLocation?.path ?? modal.folder.path)
      : modal?.folder.path;
  const [matches, setMatches] = useState<Archive[]>([]);
  const [name, setName] = useState("");
  const [relative, setRelative] = useState("");
  const [picked, setPicked] = useState(false);
  const [browse, setBrowse] = useState<string | null>(null);
  const [dirs, setDirs] = useState<{ name: string; relative: string }[]>([]);
  const [content, setContent] = useState("");
  const [claude, setClaude] = useState<string | null>(null);
  const [sha, setSha] = useState<string | null>(null);
  const [dialogRules, setDialogRules] = useState<RuleDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectFiles, setProjectFiles] = useState<"keep" | "archive">("keep");
  /** Rules tabs: which device's copy of the project root is being edited. */
  const [rulesHost, setRulesHost] = useState<string | null>(null);
  const [machines, setMachines] = useState<
    { id: string; name: string; connected: boolean }[]
  >([]);
  const ruleCopies =
    modal?.action === "rules" && !modal.target.folderId
      ? (modal.copies ?? [modal.folder])
      : null;
  const machineName = (id: string) =>
    machines.find((m) => m.id === id)?.name ?? id;
  useEffect(() => {
    setHostId(modal?.folder.hostId ?? "");
    setLocations([]);
    setLocationsLoading(modal?.action === "create");
    let live = true;
    if (modal?.action === "rules" && !modal.target.folderId)
      rpc.call("machines").then(
        (r) => live && setMachines(r.machines),
        () => {},
      );
    if (modal?.action === "create")
      rpc.call("locations", modal.target).then(
        (r) => {
          if (live) {
            setLocations(r.locations);
            setLocationsLoading(false);
          }
        },
        (e) => {
          if (live) {
            setError(String(e));
            setLocationsLoading(false);
          }
        },
      );
    setName(modal?.action === "rename" ? modal.folder.name : "");
    setRelative("");
    setPicked(false);
    setBrowse(null);
    setError("");
    setContent("");
    setClaude(null);
    setDialogRules(null);
    setProjectFiles("keep");
    setLoading(false);
    // Root rules wait for the rules tab (rulesHost); sections load right away.
    if (
      modal?.action === "rules" &&
      (modal.target.folderId || rulesHost !== null)
    ) {
      setLoading(true);
      rpc
        .call("rules_read", {
          ...modal.target,
          ...(rulesHost ? { hostId: rulesHost } : {}),
        })
        .then(
          (r) => {
            setContent(r.content);
            setClaude(r.claude);
            setSha(r.sha);
            setDialogRules({
              mode: r.mode,
              sectionTemplate: r.template || r.suggestedSection,
              projectTemplate: r.projectTemplate || r.suggestedProject,
              custom: r.custom,
              customTarget: r.customTarget,
              startup: r.startup,
            });
            setLoading(false);
          },
          (e) => {
            setError(String(e));
            setLoading(false);
          },
        );
    }
    return () => {
      live = false;
    };
  }, [modal, rpc, rulesHost]);
  useEffect(() => {
    setRulesHost(
      modal?.action === "rules" && !modal.target.folderId
        ? (modal.rulesHost ?? modal.folder.hostId)
        : null,
    );
  }, [modal]);
  useEffect(() => {
    if (browse === null || !modal) return;
    let live = true;
    setLoading(true);
    rpc.call("browse", { ...modal.target, hostId, relative: browse }).then(
      (r) => {
        if (live) {
          setDirs(r.directories);
          setLoading(false);
        }
      },
      (e) => {
        if (live) {
          setError(String(e));
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [browse, modal, rpc, hostId]);
  const save = async (allowFresh = false) => {
    if (!modal) return;
    setBusy(true);
    setError("");
    try {
      if (modal.action === "create") {
        if (!allowFresh) {
          const found = await rpc.call("archive_matches", {
            ...modal.target,
            hostId,
            name,
            relativePath: picked ? relative : name,
          });
          if (found.archives.length) {
            setMatches(found.archives);
            return;
          }
        }
        await rpc.call("create", {
          ...modal.target,
          hostId,
          name,
          relativePath: picked ? relative : name,
          allowFresh,
        });
      } else if (modal.action === "rename")
        await rpc.call("rename", { ...modal.target, name });
      else if (modal.action === "forget")
        await rpc.call("forget", modal.target);
      else if (modal.action === "remove")
        await rpc.call("project_delete", {
          projectId: modal.target.projectId,
          files: projectFiles,
        });
      else {
        await rpc.call("rules_save", {
          ...modal.target,
          content,
          sha,
          ...(rulesHost ? { hostId: rulesHost } : {}),
        });
        if (dialogRules)
          await rpc.call("rules_settings_save", {
            projectId: modal.target.projectId,
            folderId: modal.target.folderId,
            mode: dialogRules.mode,
            sectionTemplate: dialogRules.sectionTemplate,
            projectTemplate: dialogRules.projectTemplate,
            custom: dialogRules.custom,
            customTarget: dialogRules.customTarget,
            startup: dialogRules.startup,
          });
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => setMatches([]), [name, relative, hostId, picked, modal]);
  const restoreMatch = async (id: string) => {
    setBusy(true);
    setError("");
    try {
      await rpc.call("restore", { id });
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const title =
    browse !== null
      ? t("Выбор папки")
      : modal?.action === "create"
        ? t("Новый раздел")
        : modal?.action === "rules"
          ? t("Правила работы")
          : modal?.action === "rename"
            ? t("Переименовать")
            : modal?.action === "remove"
              ? t("Удалить проект")
              : t("Архивировать раздел");
  return (
    <Dialog
      open={!!modal}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="pf-dialog" dir={direction()}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{modal?.folder.name}</DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}
        {modal?.action === "create" && (
          <label className="pf-field">
            {t("Устройство")}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-full justify-between"
                  disabled={busy || locationsLoading}
                >
                  <span className="flex items-center gap-2">
                    <Icon name="Monitor" />
                    {locationsLoading
                      ? t("Загрузка устройств…")
                      : (selectedLocation?.name ?? t("Выберите устройство"))}
                  </span>
                  <Icon name="ChevronDown" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {locations.map((l) => (
                  <DropdownMenuItem
                    key={l.hostId}
                    disabled={!l.available}
                    onSelect={() => {
                      setHostId(l.hostId);
                      setBrowse(null);
                      setRelative("");
                      setPicked(false);
                      setError("");
                    }}
                  >
                    <Icon name="Monitor" />
                    <span>
                      {l.name}
                      {l.reason && (
                        <span className="block text-xs text-muted-foreground">
                          {l.reason}
                        </span>
                      )}
                    </span>
                    {hostId === l.hostId && <Icon name="Check" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </label>
        )}
        {browse !== null ? (
          <>
            <FolderBrowser
              key={hostId + browse}
              hostId={hostId}
              path={
                (folderPath ?? "").replace(/\/$/, "") +
                (browse ? "/" + browse : "")
              }
              parent={
                browse
                  ? (folderPath ?? "").replace(/\/$/, "") +
                    "/" +
                    browse.split("/").slice(0, -1).join("/")
                  : null
              }
              directories={dirs.map((d) => ({
                name: d.name,
                path: (folderPath ?? "").replace(/\/$/, "") + "/" + d.relative,
              }))}
              loading={loading || busy}
              navigate={(p) =>
                setBrowse(
                  p
                    .slice((folderPath ?? "").replace(/\/$/, "").length)
                    .replace(/^\//, ""),
                )
              }
              refresh={() => {
                if (modal) {
                  setLoading(true);
                  void rpc
                    .call("browse", {
                      ...modal.target,
                      hostId,
                      relative: browse,
                    })
                    .then(
                      (r) => setDirs(r.directories),
                      (e) => setError(String(e)),
                    )
                    .finally(() => setLoading(false));
                }
              }}
              onBusyChange={setBusy}
            />
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setBrowse(null)}
              >
                {t("Назад")}
              </Button>
              <Button
                disabled={busy || !browse || loading}
                onClick={() => {
                  setRelative(browse);
                  setPicked(true);
                  if (!name) setName(browse.split("/").at(-1) || "");
                  setBrowse(null);
                }}
              >
                {t("Выбрать папку")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save(matches.length > 0);
            }}
          >
            {matches.length > 0 && (
              <div className="rounded-lg border p-3 mb-4">
                <p className="font-medium mb-2">
                  {t("В архиве найден раздел с таким названием")}
                </p>
                {matches.map((a) => (
                  <div key={a.id} className="mb-3">
                    <p>
                      {a.folder.name} ·{" "}
                      {new Date(a.createdAt).toLocaleDateString()}
                    </p>
                    <p className="pf-folder-path">{a.folder.path}</p>
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => void restoreMatch(a.id)}
                    >
                      <Icon name="Archive" />
                      {t("Восстановить с историей")}
                    </Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  {t(
                    "Восстановление вернёт прежнюю папку, правила, вложенные разделы и чаты на исходное место.",
                  )}
                </p>
              </div>
            )}
            {(modal?.action === "create" || modal?.action === "rename") && (
              <label className="pf-field">
                {t(
                  modal?.action === "rename" && !modal.target.folderId
                    ? "Название проекта"
                    : "Название раздела",
                )}
                <Input
                  autoFocus
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            {modal?.action === "create" && (
              <>
                <label className="pf-field">
                  {t("Папка")}
                  <div className="pf-path-control">
                    <Input
                      readOnly
                      value={folderPath + "/" + (picked ? relative : name)}
                      aria-label={t("Папка раздела")}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      aria-label={t("Выбрать папку")}
                      onClick={() => setBrowse("")}
                    >
                      <Icon name="Folder" />
                    </Button>
                  </div>
                </label>
                <p className="text-sm text-muted-foreground mb-4">
                  {t(
                    "Новая папка создастся по названию раздела. Кнопка папки позволяет выбрать существующую.",
                  )}
                </p>
                {picked && (
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => {
                      setPicked(false);
                      setRelative("");
                    }}
                  >
                    {t("Создать новую папку по названию")}
                  </Button>
                )}
              </>
            )}
            {modal?.action === "rules" && (
              <>
                {ruleCopies && ruleCopies.length > 1 && (
                  <div
                    className="pf-tabs"
                    role="tablist"
                    aria-label={t("Устройство")}
                  >
                    {ruleCopies.map((c) => (
                      <button
                        key={`${c.projectId}:${c.hostId}`}
                        type="button"
                        role="tab"
                        aria-selected={rulesHost === c.hostId}
                        className={
                          "pf-tab" +
                          (rulesHost === c.hostId ? " pf-selected" : "") +
                          (machines.find((m) => m.id === c.hostId)?.connected
                            ? " pf-tab-live"
                            : "")
                        }
                        title={c.path}
                        disabled={busy}
                        onClick={() => setRulesHost(c.hostId)}
                      >
                        <Icon name="Zap" />
                        {machineName(c.hostId)}
                      </button>
                    ))}
                  </div>
                )}
                <p className="pf-folder-path">
                  {(ruleCopies?.find((c) => c.hostId === rulesHost)?.path ??
                    modal.folder.path) + "/AGENTS.md"}
                </p>
                <textarea
                  className="pf-rules"
                  aria-label={t("Правила AGENTS.md")}
                  rows={10}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
                {claude !== null && (
                  <div className="mt-3">
                    <p className="pf-agents-hint">CLAUDE.md</p>
                    <pre className="pf-rules-preview">{claude}</pre>
                  </div>
                )}
                {dialogRules && (
                  <div className="pf-agents-override">
                    <RuleFields
                      draft={dialogRules}
                      onChange={(patch) =>
                        setDialogRules({ ...dialogRules, ...patch })
                      }
                      showProject={!modal.target.folderId}
                      namePrefix="pf-dialog"
                    />
                    <p className="pf-agents-hint">
                      {t(
                        "Сохранение вписывает свои правила вниз AGENTS.md и CLAUDE.md, если он есть.",
                      )}
                    </p>
                  </div>
                )}
              </>
            )}
            {modal?.action === "forget" && (
              <p className="text-sm mb-4">
                {t(
                  "Папка вместе с вложенными разделами, правилами и историей переместится в скрытый архив проекта .bb/archive/sections/. Чаты будут архивированы. Всё можно восстановить на странице «Проекты и разделы».",
                )}
              </p>
            )}
            {modal?.action === "remove" && (
              <fieldset className="mb-4 space-y-3">
                <p className="text-sm">
                  {t(
                    "Проект пропадёт из дерева BB. Его чаты будут удалены из BB. Это нельзя отменить из плагина.",
                  )}
                </p>
                <label className="pf-field">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="project-files"
                      checked={projectFiles === "keep"}
                      onChange={() => setProjectFiles("keep")}
                    />
                    {t("Не трогать файлы")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("Папка на диске останется на месте.")}
                  </span>
                </label>
                <label className="pf-field">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="project-files"
                      checked={projectFiles === "archive"}
                      onChange={() => setProjectFiles("archive")}
                    />
                    {t("Перенести файлы в архив")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t(
                      "Папка переедет в скрытый архив рядом с проектом, в .bb/archive/projects/.",
                    )}
                  </span>
                </label>
              </fieldset>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("Отмена")}
              </Button>
              <Button
                type="submit"
                variant={modal?.action === "remove" ? "destructive" : "default"}
                disabled={
                  busy ||
                  loading ||
                  (modal?.action === "create" &&
                    (locationsLoading || !selectedLocation?.available))
                }
              >
                {busy
                  ? t("Сохраняю…")
                  : modal?.action === "create"
                    ? matches.length
                      ? t("Создать новый, не восстанавливая")
                      : t("Создать")
                    : modal?.action === "forget"
                      ? t("Архивировать")
                      : modal?.action === "remove"
                        ? t("Удалить")
                        : t("Сохранить")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
function ProjectDialog({
  open,
  onClose,
  onCreated,
  defaultHostId,
}: {
  open: boolean;
  defaultHostId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [hosts, setHosts] = useState<
    { id: string; name: string; connected: boolean }[]
  >([]);
  const [hostId, setHostId] = useState("");
  const [name, setName] = useState("");
  const [base, setBase] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  /** Open folder browser: null = closed, copyHost = picking for that copy's row. */
  const [browse, setBrowse] = useState(false);
  const [listing, setListing] = useState<{
    path: string;
    parent: string | null;
    directories: { name: string; path: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let live = true;
    setError("");
    setName("");
    setChosen(null);
    setBrowse(false);
    setHostId("");
    rpc.call("machines").then(
      (r) => {
        if (live) {
          setHosts(r.machines);
          setHostId(
            r.machines.find((h) => h.connected && h.id === defaultHostId)?.id ??
              r.machines.find((h) => h.connected)?.id ??
              "",
          );
        }
      },
      (e) => {
        if (live) setError(String(e));
      },
    );
    return () => {
      live = false;
    };
  }, [open, rpc, defaultHostId]);
  useEffect(() => {
    if (!open || !hostId) return;
    let live = true;
    setChosen(null);
    setBase("");
    setBrowse(false);
    setLoading(true);
    rpc.call("project_browse", { hostId }).then(
      (r) => {
        if (live) {
          setBase(r.path);
          setListing(r);
          setLoading(false);
        }
      },
      (e) => {
        if (live) {
          setError(String(e));
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
  }, [open, hostId, rpc]);
  const enter = async (path: string) => {
    setLoading(true);
    setError("");
    try {
      setListing(await rpc.call("project_browse", { hostId, path }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await rpc.call("project_create", {
        hostId,
        name,
        path: chosen ?? base.replace(/\/$/, "") + "/" + name,
      });
      onCreated();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value && !busy) onClose();
      }}
    >
      <DialogContent className="pf-dialog" dir={direction()}>
        <DialogHeader>
          <DialogTitle>
            {browse ? t("Выбор папки") : t("Новый проект")}
          </DialogTitle>
          <DialogDescription>
            {t("Устройство и рабочая папка проекта")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <label className="pf-field">
          {t("Устройство")}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full justify-between"
                disabled={busy || loading}
              >
                <span className="flex items-center gap-2">
                  <Icon name="Monitor" />
                  {hosts.find((h) => h.id === hostId)?.name ?? t("Загрузка…")}
                </span>
                <Icon name="ChevronDown" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {hosts.map((h) => (
                <DropdownMenuItem
                  key={h.id}
                  disabled={!h.connected}
                  onSelect={() => setHostId(h.id)}
                >
                  <Icon name="Monitor" />
                  {h.name}
                  {!h.connected ? t("— не подключено") : ""}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
        {browse ? (
          <>
            {listing && (
              <FolderBrowser
                key={hostId + listing.path}
                hostId={hostId}
                path={listing.path}
                parent={listing.parent}
                directories={listing.directories}
                loading={loading || busy}
                navigate={(p) => void enter(p)}
                refresh={() => void enter(listing.path)}
                onBusyChange={setBusy}
              />
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setBrowse(false)}
              >
                {t("Назад")}
              </Button>
              <Button
                disabled={busy || loading || !listing}
                onClick={() => {
                  setChosen(listing!.path);
                  if (!name) setName(listing!.path.split("/").at(-1) ?? "");
                  setBrowse(false);
                }}
              >
                {t("Выбрать папку")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="pf-field">
              {t("Название проекта")}
              <Input
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="pf-field">
              {t("Папка")}
              <div className="pf-path-control">
                <Input
                  aria-label={t("Папка проекта")}
                  required
                  value={
                    chosen ?? (base ? base.replace(/\/$/, "") + "/" + name : "")
                  }
                  onChange={(e) => setChosen(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !hostId}
                  aria-label={t("Выбрать папку")}
                  onClick={() => setBrowse(true)}
                >
                  <Icon name="Folder" />
                </Button>
              </div>
            </label>
            <p className="text-sm text-muted-foreground mb-4">
              {t(
                "Можно выбрать существующую папку или указать новую — она будет создана на выбранном устройстве.",
              )}
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("Отмена")}
              </Button>
              <Button disabled={busy || loading || !hostId || !base}>
                {busy ? t("Создаю…") : t("Создать проект")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
function CopiesDialog({
  root,
  presetHost,
  onClose,
  onChanged,
  onRelocate,
}: {
  root: Folder | null;
  /** Opens with this device already chosen in the "add a copy" form. */
  presetHost?: string | null;
  onClose: () => void;
  onChanged: () => void;
  /** Hands a copy over to the folder picker of the move dialog. */
  onRelocate: (copy: Folder) => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [machines, setMachines] = useState<
    { id: string; name: string; connected: boolean }[]
  >([]);
  const [copies, setCopies] = useState<Folder[]>([]);
  const [hostId, setHostId] = useState("");
  const [base, setBase] = useState("");
  const [chosen, setChosen] = useState<string | null>(null);
  const [browse, setBrowse] = useState(false);
  const [listing, setListing] = useState<{
    path: string;
    parent: string | null;
    directories: { name: string; path: string }[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirmHost, setConfirmHost] = useState<string | null>(null);
  const load = useCallback(() => {
    rpc.call("machines").then(
      (r) => setMachines(r.machines),
      (e) => setError(String(e)),
    );
    if (root)
      rpc.call("list").then(
        (r) => setCopies(r.roots.filter((x) => x.projectId === root.projectId)),
        () => {},
      );
  }, [rpc, root]);
  useEffect(() => {
    if (!root) return;
    setHostId(presetHost ?? "");
    setChosen(null);
    setBrowse(false);
    setError("");
    setConfirmHost(null);
    load();
  }, [root, presetHost, load]);
  useEffect(() => {
    if (!root || !hostId) return;
    let live = true;
    setChosen(null);
    setBrowse(false);
    setLoading(true);
    rpc.call("project_browse", { hostId }).then(
      (r) => {
        if (live) {
          setBase(r.path);
          setListing(r);
          setLoading(false);
        }
      },
      (e) => {
        if (live) {
          setError(String(e));
          setLoading(false);
        }
      },
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, hostId, rpc]);
  const enter = async (p: string) => {
    setLoading(true);
    setError("");
    try {
      setListing(await rpc.call("project_browse", { hostId, path: p }));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };
  const add = async () => {
    if (!root || !hostId) return;
    setBusy(true);
    setError("");
    try {
      await rpc.call("copy_add", {
        projectId: root.projectId,
        hostId,
        path: chosen ?? base,
      });
      setHostId("");
      setChosen(null);
      onChanged();
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (host: string) => {
    if (!root) return;
    setBusy(true);
    setError("");
    try {
      await rpc.call("copy_remove", {
        projectId: root.projectId,
        hostId: host,
      });
      setConfirmHost(null);
      onChanged();
      load();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const free = machines.filter(
    (m) => m.connected && !copies.some((c) => c.hostId === m.id),
  );
  const name = (id: string) => machines.find((m) => m.id === id)?.name ?? id;
  return (
    <Dialog
      open={!!root}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="pf-dialog" dir={direction()}>
        <DialogHeader>
          <DialogTitle>
            {browse ? t("Выбор папки") : t("Рабочие копии")}
          </DialogTitle>
          <DialogDescription>
            {t("У проекта может быть своя рабочая папка на каждом устройстве.")}
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        {browse ? (
          <>
            {listing && (
              <FolderBrowser
                key={hostId + listing.path}
                hostId={hostId}
                path={listing.path}
                parent={listing.parent}
                directories={listing.directories}
                loading={loading || busy}
                navigate={(p) => void enter(p)}
                refresh={() => void enter(listing.path)}
                onBusyChange={setBusy}
              />
            )}
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setBrowse(false)}
              >
                {t("Назад")}
              </Button>
              <Button
                disabled={busy || loading || !listing}
                onClick={() => {
                  setChosen(listing!.path.replace(/\/$/, ""));
                  setBrowse(false);
                }}
              >
                {t("Выбрать папку")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="pf-copies">
            <p className="text-sm text-muted-foreground">
              {t(
                "Папка копии на устройстве. Кнопка рядом с путём открывает выбор папки: проект можно перенести в новую папку или привязать к существующей.",
              )}
            </p>
            {copies.map((c) => (
              <div key={`${c.projectId}:${c.hostId}`} className="pf-copy-row">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <Icon
                      name="Zap"
                      className={
                        machines.find((m) => m.id === c.hostId)?.connected
                          ? "pf-bolt-live"
                          : ""
                      }
                    />
                    {name(c.hostId)}
                  </p>
                  <div className="pf-path-control">
                    <Input
                      readOnly
                      aria-label={`${t("Папка проекта")} — ${name(c.hostId)}`}
                      value={c.path}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      aria-label={t("Выбрать папку")}
                      onClick={() => onRelocate(c)}
                    >
                      <Icon name="Folder" />
                    </Button>
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1">
                  {confirmHost === c.hostId ? (
                    <>
                      <Button
                        variant="destructive"
                        disabled={busy}
                        onClick={() => void remove(c.hostId)}
                      >
                        {t("Убрать")}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => setConfirmHost(null)}
                      >
                        {t("Отмена")}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      disabled={busy || copies.length <= 1}
                      onClick={() => setConfirmHost(c.hostId)}
                    >
                      <Icon name="Trash2" />
                      {t("Убрать")}
                    </Button>
                  )}
                </span>
              </div>
            ))}
            <form
              className="pf-copy-add"
              onSubmit={(e) => {
                e.preventDefault();
                void add();
              }}
            >
              <label className="pf-field">
                {t("Добавить копию на устройстве")}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2 w-full justify-between"
                      disabled={busy || loading}
                    >
                      <span className="flex items-center gap-2">
                        <Icon name="Monitor" />
                        {free.find((m) => m.id === hostId)?.name ??
                          t("Выберите устройство")}
                      </span>
                      <Icon name="ChevronDown" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {free.map((m) => (
                      <DropdownMenuItem
                        key={m.id}
                        onSelect={() => setHostId(m.id)}
                      >
                        <Icon name="Monitor" />
                        {m.name}
                      </DropdownMenuItem>
                    ))}
                    {!free.length && (
                      <DropdownMenuItem disabled>
                        {t("Все подключённые устройства уже заняты.")}
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </label>
              {hostId && (
                <label className="pf-field">
                  {t("Папка")}
                  <div className="pf-path-control">
                    <Input
                      aria-label={t("Папка проекта")}
                      required
                      value={chosen ?? base}
                      onChange={(e) => setChosen(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={loading}
                      aria-label={t("Выбрать папку")}
                      onClick={() => setBrowse(true)}
                    >
                      <Icon name="Folder" />
                    </Button>
                  </div>
                </label>
              )}
              <p className="text-sm text-muted-foreground">
                {t(
                  "Папка будет создана при необходимости, в неё впишутся правила AGENTS.md. Чаты проекта доступны на каждом устройстве отдельно.",
                )}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t("Готово")}
                </Button>
                <Button type="submit" disabled={busy || !hostId}>
                  {busy ? t("Сохраняю…") : t("Добавить копию")}
                </Button>
              </DialogFooter>
            </form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
function ThreadRow({
  thread,
  active,
  onNavigate,
  onMove,
  onDrag,
}: {
  onMove: (thread: PluginSidebarThread) => void;
  onDrag: (thread: PluginSidebarThread | null) => void;
  thread: PluginSidebarThread;
  active: string | null;
  onNavigate: () => void;
}) {
  const a = experimental_useSidebarThreadActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [renameError, setRenameError] = useState("");
  const [saving, setSaving] = useState(false);
  const renamePending = useRef(false);
  const cancelled = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const beginRename = () => {
    cancelled.current = false;
    setDraft(thread.title || thread.titleFallback || "");
    setRenameError("");
    setMenuOpen(false);
    setEditing(true);
  };
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);
  const saveRename = async () => {
    if (cancelled.current || renamePending.current) return;
    const title = draft.trim();
    if (!title || title === thread.title) {
      setEditing(false);
      return;
    }
    renamePending.current = true;
    setSaving(true);
    try {
      await a.rename(thread.id, title);
      setEditing(false);
    } catch (error) {
      setRenameError(String(error));
      inputRef.current?.focus();
    } finally {
      renamePending.current = false;
      setSaving(false);
    }
  };
  return (
    <div
      className={"pf-thread " + (active === thread.id ? "pf-active" : "")}
      draggable={!editing}
      onDragStart={(event) => {
        if (menuOpen || editing) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(
          "application/x-bb-project-folders-thread",
          thread.id,
        );
        event.dataTransfer.effectAllowed = "move";
        onDrag(thread);
      }}
      onDragEnd={() => onDrag(null)}
      onContextMenu={(event) => {
        if (editing) return;
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      {editing ? (
        <Input
          ref={inputRef}
          className="pf-thread-rename"
          aria-label={t("Переименовать")}
          value={draft}
          disabled={saving}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void saveRename()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void saveRename();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              cancelled.current = true;
              setEditing(false);
            }
          }}
        />
      ) : (
        <a
          href={"#" + thread.id}
          data-sidebar-thread-shortcut-target=""
          data-sidebar-thread-id={thread.id}
          onClick={(e) => {
            e.preventDefault();
            a.open(thread.id, { split: e.metaKey || e.ctrlKey });
            onNavigate();
          }}
          title={thread.indicatorLabel ?? undefined}
        >
          <span
            className="pf-status"
            aria-label={thread.indicatorLabel ?? undefined}
          >
            {thread.hasPendingInteraction
              ? "◉"
              : thread.indicator === "runtime"
                ? "●"
                : "·"}
          </span>
          {thread.isPinned && <Icon name="Pin" />}
          <span
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              beginRename();
            }}
            className={thread.isUnread ? "pf-unread" : ""}
          >
            {thread.title || thread.titleFallback}
          </span>
        </a>
      )}
      {renameError && (
        <span role="alert" className="text-destructive text-xs">
          {renameError}
        </span>
      )}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="pf-icon" aria-label={t("Действия чата")}>
            <Icon name="MoreHorizontal" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onCloseAutoFocus={(event) => {
            if (editing) {
              event.preventDefault();
              inputRef.current?.focus();
            }
          }}
        >
          <DropdownMenuItem onSelect={beginRename}>
            <Icon name="Pencil" />
            {t("Переименовать")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void a.setPinned(thread.id, !thread.isPinned)}
          >
            <Icon name="Pin" />
            {thread.isPinned ? t("Открепить") : t("Закрепить")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void a.setRead(thread.id, thread.isUnread)}
          >
            <Icon name="Check" />
            {thread.isUnread
              ? t("Отметить прочитанным")
              : t("Отметить непрочитанным")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onMove(thread)}>
            <Icon name="Folder" />
            {t("Переместить в подраздел…")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => a.archive(thread.id)}>
            <Icon name="Archive" />
            {t("В архив")}
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => a.requestDelete(thread.id)}
          >
            <Icon name="Trash2" />
            {t("Удалить…")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
function FolderHeading({
  folder,
  root,
  closed,
  unread = false,
  highlighted,
  rulesAllowed,
  look,
  onAppearance,
  onToggle,
  onNewChat,
  onDragOver,
  onDragLeave,
  onDrop,
  onNewProject,
  onCreate,
  onConfigure,
  onMove,
  onRules,
  onRename,
  onRelocate,
  onRemove,
  onArchive,
}: {
  folder: Folder;
  root: boolean;
  closed: boolean;
  unread?: boolean;
  highlighted: boolean;
  rulesAllowed: boolean;
  look: {
    icon: string;
    color?: string;
    fill: "none" | "badge" | "stripe" | "row";
  };
  onAppearance: () => void;
  onToggle: () => void;
  onNewChat: () => void;
  onDragOver: DragEventHandler<HTMLDivElement>;
  onDragLeave: DragEventHandler<HTMLDivElement>;
  onDrop: DragEventHandler<HTMLDivElement>;
  onNewProject: () => void;
  onCreate: () => void;
  onConfigure: () => void;
  onMove: () => void;
  onRules: () => void;
  onRename: () => void;
  onRelocate: () => void;
  onRemove: () => void;
  onArchive: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const row = rowDecoration(look);
  return (
    <div
      className={
        "pf-heading" + row.className + (highlighted ? " pf-drop-target" : "")
      }
      style={row.style}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setMenuOpen(true);
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        className={"pf-label" + (unread ? " pf-unread" : "")}
        onClick={onToggle}
        title={folder.path}
      >
        <Icon
          name={closed ? "ChevronRight" : "ChevronDown"}
          className="pf-chevron"
        />
        <Glyph {...look} />
        <span>{folder.name}</span>
      </button>
      <button
        className="pf-icon"
        title={t("Новый чат")}
        aria-label={`${t("Новый чат")}: ${folder.name}`}
        onClick={onNewChat}
      >
        <Icon name="MessageCirclePlus" />
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            className="pf-icon"
            aria-label={`${t("Действия чата")}: ${folder.name}`}
          >
            <Icon name="MoreHorizontal" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {root && (
            <DropdownMenuItem onSelect={onNewProject}>
              <Icon name="FolderPlus" />
              {t("Новый проект")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onCreate}>
            <Icon name="SectionAdd" />
            {t("Новый раздел")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onConfigure}>
            <Icon name="SlidersHorizontal" />
            {t("Настройка")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onAppearance}>
            <Icon name="Palette" />
            {t("Оформление")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <ChatSortMenu />
          {root && (
            <DropdownMenuItem onSelect={onMove}>
              <Icon name="Folder" />
              {t("Перенести")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {rulesAllowed && (
            <DropdownMenuItem onSelect={onRules}>
              <Icon name="Settings" />
              {t("Правила работы")}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={onRename}>
            <Icon name="Edit" />
            {t("Переименовать")}
          </DropdownMenuItem>
          {!root && (
            <DropdownMenuItem onSelect={onRelocate}>
              <Icon name="FolderExport" />
              {t("Изменить путь")}
            </DropdownMenuItem>
          )}
          {root && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <Icon name="Trash2" />
                {t("Удалить")}
              </DropdownMenuItem>
            </>
          )}
          {!root && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onArchive}>
                <Icon name="Archive" />
                {t("Архивировать")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
function Tree(props: PluginThreadListProps) {
  const language = useLanguage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { rpc, data, error, refresh } = useTree();
  const { prefs, look } = useFolderLook(data.folders);
  const listSettings = prefs.chatList;
  const [styling, setStyling] = useState<{
    projectId: string;
    folder: Folder | null;
    name: string;
  } | null>(null);
  const { threads, projects, status } = experimental_useSidebarThreads();
  const environmentKey = threads.map((t) => t.environment?.id ?? "").join("|");
  useEffect(refresh, [environmentKey, refresh]);
  const actions = experimental_useSidebarThreadActions();
  const nav = useBbNavigate();
  const [modal, setModal] = useState<Modal | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [movingProject, setMovingProject] = useState<Folder | null>(null);
  const [movingSection, setMovingSection] = useState<Folder | null>(null);
  const [movingChat, setMovingChat] = useState<PluginSidebarThread | null>(
    null,
  );
  const [draggedChat, setDraggedChat] = useState<PluginSidebarThread | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState("");
  const [selectedMove, setSelectedMove] = useState<{
    folder: Folder;
    root: boolean;
  } | null>(null);
  const [moveCollapsed, setMoveCollapsed] = useState<Record<string, boolean>>(
    {},
  );
  useEffect(() => {
    setSelectedMove(null);
    setMoveCollapsed({});
  }, [movingChat?.id]);
  const canMove = (chat: PluginSidebarThread | null, folder: Folder) =>
    !!chat &&
    chat.projectId === folder.projectId &&
    chat.host?.id === folder.hostId;
  const moveChat = async (
    chat: PluginSidebarThread,
    folder: Folder,
    root: boolean,
    fromDrop = false,
  ) => {
    if (moveBusy || !canMove(chat, folder)) return;
    setMoveBusy(true);
    setMoveError("");
    setDraggedChat(null);
    setDropTarget(null);
    try {
      await rpc.call("thread_move", {
        threadId: chat.id,
        projectId: folder.projectId,
        folderId: root ? null : folder.id,
        hostId: folder.hostId,
      });
      setMovingChat(null);
      setCollapseRecords((old) => {
        const next = {
          ...old,
          [folder.id]: { collapsed: false, at: Date.now() },
        };
        localStorage.setItem("project-folders:collapsed", JSON.stringify(next));
        return next;
      });
      refresh();
    } catch (error) {
      const message = String(error);
      setMoveError(
        /queued messages|Finish.*chat|Wait for the chat/i.test(message)
          ? t(
              "Дождитесь завершения ответа и сообщений в очереди, затем повторите перенос.",
            )
          : message,
      );
      if (!fromDrop) setMovingChat(chat);
    } finally {
      setMoveBusy(false);
    }
  };

  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(timer);
  }, []);

  const [collapseRecords, setCollapseRecords] = useState<
    Record<string, CollapseRecord>
  >(() => {
    try {
      return parseCollapseState(
        localStorage.getItem("project-folders:collapsed"),
      );
    } catch {
      return {};
    }
  });

  const isClosed = (f: Folder, root: boolean) =>
    isSectionCollapsed({
      folderId: f.id,
      projectId: f.projectId,
      root,
      folders: data.folders,
      bindings: data.bindings,
      threads,
      record: collapseRecords[f.id],
      activeThreadId: props.activeThreadId,
      autoCollapseInactive: listSettings.autoCollapseInactive,
      thresholdMs: listSettings.inactiveHours * 60 * 60 * 1000,
    });

  const isProjectClosed = (pId: string) => {
    const record = collapseRecords[pId];
    return !!record?.collapsed;
  };

  const toggle = (id: string, currentlyClosed: boolean) =>
    setCollapseRecords((old) => {
      const next = {
        ...old,
        [id]: { collapsed: !currentlyClosed, at: Date.now() },
      };
      localStorage.setItem("project-folders:collapsed", JSON.stringify(next));
      return next;
    });
  const open = (f: Folder, root: boolean) => {
    nav.toPluginPanel("folders", {
      subPath: `chat/${f.projectId}/${root ? `root:${f.hostId}` : f.id}`,
    });
    props.onNavigate();
  };
  /** One entry per project: roots of other devices are picked in the composer and the copies dialog. */
  const visibleRoots = data.roots.filter(
    (r, i) => data.roots.findIndex((x) => x.projectId === r.projectId) === i,
  );
  const rows = (
    ts: readonly PluginSidebarThread[],
    group: string,
    sort = listSettings.sort,
    limit = listSettings.limit,
  ) => {
    const sorted = sortChats(ts, sort, language);
    const shown = expanded[group] ? sorted : sorted.slice(0, limit);
    return (
      <>
        {shown.map((thread) => (
          <ThreadRow
            key={thread.id}
            thread={thread}
            active={props.activeThreadId}
            onNavigate={props.onNavigate}
            onMove={(chat) => {
              setMoveError("");
              setMovingChat(chat);
            }}
            onDrag={(chat) => {
              setDraggedChat(chat);
              if (!chat) setDropTarget(null);
            }}
          />
        ))}
        {sorted.length > limit && (
          <button
            className="pf-show-more"
            aria-expanded={!!expanded[group]}
            onClick={() =>
              setExpanded((old) => ({ ...old, [group]: !old[group] }))
            }
          >
            <Icon name={expanded[group] ? "ChevronUp" : "ChevronDown"} />
            {expanded[group]
              ? t("Свернуть список")
              : `${t("Показать все")} (${sorted.length})`}
          </button>
        )}
      </>
    );
  };
  const node = (f: Folder, root = false, level = 0): React.ReactNode => {
    const children = data.folders.filter(
      (c) => c.projectId === f.projectId && c.parentId === (root ? null : f.id),
    );
    const target = { projectId: f.projectId, folderId: root ? null : f.id };
    const ts = threads.filter(
      (t) =>
        t.projectId === f.projectId &&
        (root
          ? !data.bindings[t.environment?.id ?? ""]
          : data.bindings[t.environment?.id ?? ""] === f.id),
    );
    const folderClosed = isClosed(f, root);
    const folderUnread = hasFolderUnread({
      folderId: f.id,
      projectId: f.projectId,
      root,
      folders: data.folders,
      bindings: data.bindings,
      threads,
    });
    const folderLook = look(f.projectId, root ? null : f);
    return (
      <div key={f.id} className={root ? "pf-project" : "pf-folder"}>
        <FolderHeading
          folder={f}
          root={root}
          closed={folderClosed}
          unread={folderUnread && listSettings.boldUnread}
          highlighted={dropTarget === f.id}
          rulesAllowed={root || level <= 2}
          look={folderLook}
          onAppearance={() =>
            setStyling({
              projectId: f.projectId,
              folder: root ? null : f,
              name: f.name,
            })
          }
          onToggle={() => toggle(f.id, folderClosed)}
          onNewChat={() => void open(f, root)}
          onDragOver={(event) => {
            if (!moveBusy && canMove(draggedChat, f)) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDropTarget(f.id);
            }
          }}
          onDragLeave={(event) => {
            if (
              !(event.relatedTarget instanceof Node) ||
              !event.currentTarget.contains(event.relatedTarget)
            )
              setDropTarget(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (
              draggedChat &&
              event.dataTransfer.getData(
                "application/x-bb-project-folders-thread",
              ) === draggedChat.id
            )
              void moveChat(draggedChat, f, root, true);
          }}
          onNewProject={() => setNewProject(true)}
          onCreate={() =>
            setModal({ action: "create", target, folder: f, level })
          }
          onConfigure={() => {
            nav.toPluginPanel("folders", {
              subPath: `select/${f.projectId}/${
                root ? `root:${f.hostId}` : f.id
              }`,
            });
            props.onNavigate();
          }}
          onMove={() => setMovingProject(f)}
          onRules={() =>
            setModal({
              action: "rules",
              target,
              folder: f,
              level,
              copies: root
                ? data.roots.filter((r) => r.projectId === f.projectId)
                : undefined,
            })
          }
          onRename={() =>
            setModal({ action: "rename", target, folder: f, level })
          }
          onRelocate={() => setMovingSection(f)}
          onRemove={() =>
            setModal({ action: "remove", target, folder: f, level })
          }
          onArchive={() =>
            setModal({ action: "forget", target, folder: f, level })
          }
        />
        {!folderClosed && (
          <div className="pf-children">
            {children.map((c) => node(c, false, level + 1))}
            {rows(ts, f.id, folderLook.sort, folderLook.limit)}
          </div>
        )}
      </div>
    );
  };
  return (
    <div
      className={
        "pf pf-tree" + (prefs.view.density === "compact" ? " pf-compact" : "")
      }
      style={{ "--pf-indent": `${prefs.view.indent}px` } as React.CSSProperties}
      dir={direction()}
    >
      <Button
        variant="ghost"
        className="mb-2 w-full justify-start"
        onClick={() => setNewProject(true)}
      >
        <Icon name="FolderPlus" />
        {t("Новый проект")}
      </Button>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {status === "loading" && <p>{t("Загрузка…")}</p>}
      {visibleRoots.map((f) => node(f, true))}
      {projects
        .filter((p) => !data.roots.some((r) => r.projectId === p.id))
        .map((p) => {
          const projectClosed = isProjectClosed(p.id);
          const projectUnread = threads.some(
            (t) => t.projectId === p.id && !t.isArchived && !!t.isUnread,
          );
          return (
            <div className="pf-project" key={p.id}>
              <div className="pf-heading">
                <button
                  className={"pf-label" + (projectUnread ? " pf-unread" : "")}
                  onClick={() => toggle(p.id, projectClosed)}
                >
                  <Icon name={projectClosed ? "ChevronRight" : "ChevronDown"} />
                  <span>{p.isPersonal ? t("Без проекта") : p.name}</span>
                </button>
                <button
                  className="pf-icon"
                  aria-label={t("Новый чат без проекта")}
                  onClick={() => {
                    actions.openNewThread({
                      projectId: p.id,
                      focusPrompt: true,
                    });
                    props.onNavigate();
                  }}
                >
                  <Icon name="MessageCirclePlus" />
                </button>
              </div>
              {!projectClosed && (
                <div className="pf-children">
                  {rows(
                    threads.filter((t) => t.projectId === p.id),
                    p.id,
                  )}
                </div>
              )}
            </div>
          );
        })}
      <button
        className="pf-manage"
        onClick={() => nav.toPluginPanel("folders")}
      >
        {t("Управление разделами")}
      </button>
      {moveError && !movingChat && (
        <div role="alert" className="pf-error pf-move-notice">
          {moveError}
          <button aria-label={t("Отмена")} onClick={() => setMoveError("")}>
            <Icon name="X" />
          </button>
        </div>
      )}
      <Dialog
        open={!!movingChat}
        onOpenChange={(open) => {
          if (!open && !moveBusy) setMovingChat(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("Переместить в подраздел…")}</DialogTitle>
            <DialogDescription>
              {movingChat?.title || movingChat?.titleFallback}
            </DialogDescription>
          </DialogHeader>
          <p>
            {t(
              "Выберите подраздел на том же устройстве. История чата сохранится.",
            )}
          </p>
          {moveError && (
            <p role="alert" className="pf-error">
              {moveError}
            </p>
          )}
          <div className="pf-move-targets" aria-busy={moveBusy}>
            {(() => {
              const render = (
                folder: Folder,
                root: boolean,
                depth: number,
              ): React.ReactNode => (
                <div key={folder.id}>
                  <div
                    className="pf-move-tree-row"
                    style={{ paddingInlineStart: depth * 18 }}
                  >
                    <button
                      className="pf-icon"
                      aria-label={folder.name}
                      aria-expanded={!moveCollapsed[folder.id]}
                      onClick={() =>
                        setMoveCollapsed((old) => ({
                          ...old,
                          [folder.id]: !old[folder.id],
                        }))
                      }
                    >
                      <Icon
                        name={
                          moveCollapsed[folder.id]
                            ? "ChevronRight"
                            : "ChevronDown"
                        }
                      />
                    </button>
                    <button
                      className={
                        "pf-move-target" +
                        (selectedMove?.folder.id === folder.id
                          ? " pf-selected"
                          : "")
                      }

                      disabled={moveBusy || !canMove(movingChat, folder)}
                      onClick={() => {
                        setSelectedMove({ folder, root });
                      }}
                      title={folder.path}
                    >
                      <Icon name="Folder" />
                      <span>{folder.name}</span>
                      {selectedMove?.folder.id === folder.id && (
                        <Icon name="Check" />
                      )}
                    </button>
                  </div>
                  {!moveCollapsed[folder.id] &&
                    data.folders
                      .filter(
                        (child) =>
                          child.projectId === folder.projectId &&
                          child.hostId === folder.hostId &&
                          child.parentId === (root ? null : folder.id),
                      )
                      .map((child) => render(child, false, depth + 1))}
                </div>
              );
              return data.roots
                .filter((root) => root.projectId === movingChat?.projectId)
                .map((root) => render(root, true, 0));
            })()}
          </div>
          {selectedMove && (
            <p className="pf-folder-path">{selectedMove.folder.path}</p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={moveBusy}
              onClick={() => setMovingChat(null)}
            >
              {t("Отмена")}
            </Button>
            <Button
              disabled={moveBusy || !selectedMove}
              onClick={() => {
                if (movingChat && selectedMove)
                  void moveChat(
                    movingChat,
                    selectedMove.folder,
                    selectedMove.root,
                  );
              }}
            >
              {moveBusy ? t("Перенос чата…") : t("Перенести")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MoveDialog
        folder={movingProject}
        onClose={() => setMovingProject(null)}
        onMoved={refresh}
      />
      <SectionMoveDialog
        folder={movingSection}
        onClose={() => setMovingSection(null)}
        onMoved={refresh}
      />
      <ProjectDialog
        defaultHostId={data.roots[0]?.hostId}
        open={newProject}
        onClose={() => setNewProject(false)}
        onCreated={refresh}
      />
      <FolderDialog
        modal={modal}
        onClose={() => setModal(null)}
        onCreated={refresh}
      />
      <AppearanceDialog
        target={styling}
        folders={data.folders}
        onClose={() => setStyling(null)}
      />
    </div>
  );
}
function ArchiveList({ bare = false }: { bare?: boolean }) {
  const rpc = useRpc<typeof rpcContract>();
  const [items, setItems] = useState<Archive[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const refresh = useCallback(() => {
    rpc.call("archive_list").then(
      (r) => setItems(r.archives),
      (e) => setError(String(e)),
    );
  }, [rpc]);
  useEffect(refresh, [refresh]);
  useRealtime("changed", refresh);
  const run = async (a: Archive) => {
    setBusy(a.id);
    setError("");
    try {
      if (a.state === "archiving")
        await rpc.call("archive", { folderId: a.folder.id });
      else await rpc.call("restore", { id: a.id });
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(null);
    }
  };
  const Wrapper = bare ? "div" : "section";
  return (
    <Wrapper className={bare ? "pf-archive-bare" : "pf-card"}>
      {!bare && <h2>{t("Архив разделов")}</h2>}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!items.length && <p className="pf-archive-empty">{t("Архив пуст")}</p>}
      {items.map((a) => (
        <div key={a.id} className="pf-archive-item">
          <div className="pf-archive-info">
            <strong>{a.folder.name}</strong>
            <span className="pf-archive-meta">{a.folder.path}</span>
            <span className="pf-archive-meta">
              {new Date(a.createdAt).toLocaleString()} · {a.members.length}{" "}
              {t("разделов ·")}
              {a.threadIds.length} {t("чатов")}
            </span>
            {a.error && (
              <span role="alert" className="text-destructive pf-archive-meta">
                {a.error}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            disabled={busy === a.id}
            onClick={() => void run(a)}
          >
            {busy === a.id
              ? t("Выполняю…")
              : a.state === "archived"
                ? t("Восстановить")
                : t("Повторить")}
          </Button>
        </div>
      ))}
    </Wrapper>
  );
}
function Panel({ subPath }: PluginNavPanelProps) {
  const { rpc, data, error, refresh } = useTree();
  const [submitError, setSubmitError] = useState("");
  const composeRef = useRef<HTMLDivElement>(null);
  const [projectSlot, setProjectSlot] = useState<{
    node: HTMLElement;
    className: string;
  } | null>(null);
  useEffect(() => {
    const owner = composeRef.current;
    if (!owner) return;
    let original: HTMLElement | null = null;
    let slot: HTMLElement | null = null;
    let previousDisplay = "";
    const restore = () => {
      if (original) original.style.display = previousDisplay;
      slot?.remove();
      original = null;
      slot = null;
    };
    const attach = () => {
      const button = owner.querySelector<HTMLElement>(
        "[data-promptbox-project-control]",
      );
      if (button === original) return;
      restore();
      if (!button) {
        setProjectSlot(null);
        return;
      }
      original = button;
      previousDisplay = button.style.display;
      slot = document.createElement("span");
      slot.className = "pf-native-project-slot inline-flex shrink-0";
      button.before(slot);
      button.style.display = "none";
      setProjectSlot({ node: slot, className: button.className });
    };
    attach();
    const observer = new MutationObserver(attach);
    observer.observe(owner, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      restore();
    };
  }, [subPath, data.folders.length, data.roots.length]);
  useLanguage();
  const [modal, setModal] = useState<Modal | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [movingProject, setMovingProject] = useState<Folder | null>(null);
  const [movingSection, setMovingSection] = useState<Folder | null>(null);
  const [copyRoot, setCopyRoot] = useState<Folder | null>(null);
  const { look } = useFolderLook(data.folders);
  const [styling, setStyling] = useState<{
    projectId: string;
    folder: Folder | null;
    name: string;
  } | null>(null);
  /** Device preselected in the working-copies dialog, when it opens from a free tab. */
  const [copyHost, setCopyHost] = useState<string | null>(null);
  /** Device tab in the project card; null = the selected root's own device. */
  const [cardHostState, setCardHostState] = useState<string | null>(null);
  /** AGENTS.md draft of the card's active device copy: draft, saved copy, its CLAUDE.md. */
  const [cardDraft, setCardDraft] = useState<string | null>(null);
  const [cardSaved, setCardSaved] = useState("");
  const [cardClaude, setCardClaude] = useState<string | null>(null);
  const [cardClaudeDraft, setCardClaudeDraft] = useState<string | null>(null);
  const [cardSaving, setCardSaving] = useState(false);
  const [cardRuleError, setCardRuleError] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  /** Settings section shown while no project or section is selected. */
  const [settingsView, setSettingsView] = useState<SettingsSection>("list");
  const [sideClosed, setSideClosed] = useState<Record<string, boolean>>({});
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [dragInfo, setDragInfo] = useState<{
    key: string;
    scope: string;
  } | null>(null);
  const [dropKey, setDropKey] = useState<{
    key: string;
    pos: "above" | "below";
  } | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [ruleDraft, setRuleDraft] = useState<RuleDraft | null>(null);
  const [ruleSaving, setRuleSaving] = useState(false);
  const [ruleSaved, setRuleSaved] = useState(false);
  const [ruleError, setRuleError] = useState("");
  /** The mode saved for the folder; the open tab may differ until saved. */
  const [ruleModeSaved, setRuleModeSaved] = useState<
    "manual" | "inherit" | "custom" | null
  >(null);
  const nav = useBbNavigate();
  const [action, projectId, folderId] = (subPath || "")
    .replace(/^\//, "")
    .split("/")
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const f =
    data.folders.find((f) => f.id === folderId && f.projectId === projectId) ??
    data.roots.find(
      (r) => r.projectId === projectId && folderId === `root:${r.hostId}`,
    );
  const rootSelected = folderId?.startsWith("root:") ?? false;
  // `settings/<section>` opens a plugin settings section.
  useEffect(() => {
    if (action !== "settings" || !projectId || !isSettingsSection(projectId))
      return;
    setSelectedKey(null);
    setSettingsView(projectId);
  }, [action, projectId]);
  // `select/<project>/<folder-or-root:host>` opens management with the row selected.
  useEffect(() => {
    if (action !== "select" || !projectId) return;
    setSelectedKey(
      folderId?.startsWith("root:")
        ? `${projectId}|${folderId.slice("root:".length)}`
        : (folderId ?? null),
    );
  }, [action, projectId, folderId]);
  const machineName = (hostId: string) =>
    data.machines.find((m) => m.id === hostId)?.name ?? hostId;
  const projectCopies = (projectId: string) =>
    data.roots.filter((r) => r.projectId === projectId);
  /** One project entry in the tree; per-device copies live in the copies dialog. */
  const visibleRoots = data.roots.filter(
    (r, i) => data.roots.findIndex((x) => x.projectId === r.projectId) === i,
  );
  const sectionMenu = (r: Folder, depth = 0): React.ReactNode => (
    <div key={`${r.id}:${r.hostId}`}>
      <DropdownMenuItem
        style={depth > 0 ? { paddingLeft: 8 + depth * 16 } : undefined}
        onSelect={() => {
          setSubmitError("");
          nav.toPluginPanel("folders", {
            subPath: `chat/${r.projectId}/${depth === 0 ? `root:${r.hostId}` : r.id}`,
          });
        }}
      >
        <Icon name="Folder" />
        {r.name}
        {depth === 0 && projectCopies(r.projectId).length > 1 && (
          <span className="pf-menu-host">· {machineName(r.hostId)}</span>
        )}
        {f?.path === r.path && f?.hostId === r.hostId ? " ✓" : ""}
      </DropdownMenuItem>
      {data.folders
        .filter(
          (c) =>
            c.projectId === r.projectId &&
            c.hostId === r.hostId &&
            c.parentId === (depth === 0 ? null : r.id),
        )
        .map((c) => sectionMenu(c, depth + 1))}
    </div>
  );
  const selectedNames: string[] = [];
  let ancestor = f;
  const visited = new Set<string>();
  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    selectedNames.unshift(ancestor.name);
    ancestor = ancestor.parentId
      ? data.folders.find((x) => x.id === ancestor!.parentId)
      : undefined;
  }
  const projectName = data.roots.find(
    (r) => r.projectId === projectId && r.hostId === f?.hostId,
  )?.name;
  if (!rootSelected && projectName) selectedNames.unshift(projectName);
  const levelOf = (f: Folder) => {
    let level = 1;
    let parent = f.parentId
      ? data.folders.find((x) => x.id === f.parentId)
      : undefined;
    const visited = new Set<string>();
    while (parent && !visited.has(parent.id)) {
      visited.add(parent.id);
      level++;
      parent = parent.parentId
        ? data.folders.find((x) => x.id === parent!.parentId)
        : undefined;
    }
    return level;
  };
  const scopeOf = (root: boolean, f: Folder) =>
    root ? "projects" : (f.parentId ?? `project:${f.projectId}`);
  const siblingKeys = (scope: string): string[] =>
    scope === "projects"
      ? [
          ...new Map(
            data.roots.map((r) => [r.projectId, `${r.projectId}|${r.hostId}`]),
          ).values(),
        ]
      : scope.startsWith("project:")
        ? data.folders
            .filter(
              (x) =>
                !x.parentId && x.projectId === scope.slice("project:".length),
            )
            .map((x) => x.id)
        : data.folders.filter((x) => x.parentId === scope).map((x) => x.id);
  const reorder = (scope: string, from: string, to: string, below = false) => {
    setReorderError("");
    const ids = siblingKeys(scope);
    const i = ids.indexOf(from);
    const j = ids.indexOf(to);
    if (i < 0 || j < 0 || (i === j && !below)) return;
    ids.splice(i, 1);
    ids.splice(ids.indexOf(to) + (below ? 1 : 0), 0, from);
    const call =
      scope === "projects"
        ? rpc.call("reorder", {
            kind: "projects",
            ids: ids.map((k) => k.split("|")[0]),
          })
        : rpc.call("reorder", {
            kind: "sections",
            projectId:
              data.folders.find((x) => x.id === ids[0])?.projectId ?? "",
            parentId: scope.startsWith("project:") ? null : scope,
            ids,
          });
    call.then(
      () => refresh(),
      (e) => setReorderError(String(e)),
    );
  };
  const sideNode = (f: Folder, root: boolean): React.ReactNode => {
    const key = root ? `${f.projectId}|${f.hostId}` : f.id;
    const children = data.folders.filter(
      (c) => c.projectId === f.projectId && c.parentId === (root ? null : f.id),
    );
    const open = !sideClosed[key];
    const level = root ? 0 : levelOf(f);
    const target = { projectId: f.projectId, folderId: root ? null : f.id };
    const scope = scopeOf(root, f);
    const siblings = siblingKeys(scope);
    const at = siblings.indexOf(key);
    const move = (dir: -1 | 1) => {
      const other = siblings[at + dir];
      if (other) reorder(scope, key, other);
    };
    const dropHere = dropKey?.key === key ? dropKey.pos : null;
    const folderLook = look(f.projectId, root ? null : f);
    const row = rowDecoration(folderLook);
    return (
      <div key={key} className={root ? "pf-side-project" : undefined}>
        <div
          className={
            "pf-side-row" +
            row.className +
            (selectedKey === key ? " pf-selected" : "") +
            (dropHere ? ` pf-drop-${dropHere}` : "")
          }
          style={row.style}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.setData("text/plain", key);
            event.dataTransfer.effectAllowed = "move";
            setDragInfo({ key, scope });
          }}
          onDragEnd={() => {
            setDragInfo(null);
            setDropKey(null);
          }}
          onDragOver={(event) => {
            if (!dragInfo || dragInfo.key === key) return;
            if (dragInfo.scope !== scope) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            const rect = event.currentTarget.getBoundingClientRect();
            setDropKey({
              key,
              pos:
                event.clientY < rect.top + rect.height / 2 ? "above" : "below",
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            const info = dragInfo;
            const drop = dropKey;
            setDragInfo(null);
            setDropKey(null);
            if (!info || !drop || drop.key !== key) return;
            reorder(scope, info.key, key, drop.pos === "below");
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            setMenuKey(key);
          }}
        >
          <button
            type="button"
            className="pf-icon"
            aria-label={f.name}
            aria-expanded={open}
            style={{ visibility: children.length ? "visible" : "hidden" }}
            onClick={() => setSideClosed((old) => ({ ...old, [key]: open }))}
          >
            <Icon name={open ? "ChevronDown" : "ChevronRight"} />
          </button>
          <button
            type="button"
            className="pf-side-label"
            title={f.path}
            onClick={() => setSelectedKey(key)}
          >
            <Glyph {...folderLook} />
            <span>{f.name}</span>
          </button>
          <DropdownMenu
            open={menuKey === key}
            onOpenChange={(o) => setMenuKey(o ? key : null)}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="pf-icon"
                aria-label={`${t("Действия чата")}: ${f.name}`}
              >
                <Icon name="MoreHorizontal" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() =>
                  nav.toPluginPanel("folders", {
                    subPath: `chat/${f.projectId}/${
                      root ? `root:${f.hostId}` : f.id
                    }`,
                  })
                }
              >
                <Icon name="MessageCirclePlus" />
                {t("Новый чат")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setModal({ action: "create", target, folder: f, level })
                }
              >
                <Icon name="SectionAdd" />
                {t("Новый раздел")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSelectedKey(key)}>
                <Icon name="SlidersHorizontal" />
                {t("Настройка")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setStyling({
                    projectId: f.projectId,
                    folder: root ? null : f,
                    name: f.name,
                  })
                }
              >
                <Icon name="Palette" />
                {t("Оформление")}
              </DropdownMenuItem>
              {root && (
                <DropdownMenuItem onSelect={() => setNewProject(true)}>
                  <Icon name="FolderPlus" />
                  {t("Новый проект")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {(root || level <= 2) && (
                <DropdownMenuItem
                  onSelect={() =>
                    setModal({
                      action: "rules",
                      target,
                      folder: f,
                      level,
                      copies: projectCopies(f.projectId),
                    })
                  }
                >
                  <Icon name="Settings" />
                  {t("Правила")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() =>
                  setModal({ action: "rename", target, folder: f, level })
                }
              >
                <Icon name="Edit" />
                {t("Переименовать")}
              </DropdownMenuItem>
              {!root && (
                <DropdownMenuItem onSelect={() => setMovingSection(f)}>
                  <Icon name="FolderExport" />
                  {t("Изменить путь")}
                </DropdownMenuItem>
              )}
              {root && (
                <DropdownMenuItem onSelect={() => setMovingProject(f)}>
                  <Icon name="Folder" />
                  {t("Перенести")}
                </DropdownMenuItem>
              )}
              {root && (
                <DropdownMenuItem onSelect={() => setCopyRoot(f)}>
                  <Icon name="Copy" />
                  {t("Рабочие копии")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={at <= 0} onSelect={() => move(-1)}>
                {t("Сдвинуть вверх")}
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={at < 0 || at >= siblings.length - 1}
                onSelect={() => move(1)}
              >
                {t("Сдвинуть вниз")}
              </DropdownMenuItem>
              {!root && (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() =>
                    setModal({
                      action: "forget",
                      target: { projectId: f.projectId, folderId: f.id },
                      folder: f,
                      level,
                    })
                  }
                >
                  <Icon name="Archive" />
                  {t("В архив")}
                </DropdownMenuItem>
              )}
              {root && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      setModal({
                        action: "remove",
                        target: {
                          projectId: f.projectId,
                          folderId: null,
                        },
                        folder: f,
                        level,
                      })
                    }
                  >
                    <Icon name="Trash2" />
                    {t("Удалить")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {open && children.length > 0 && (
          <div className="pf-side-children">
            {children.map((c) => sideNode(c, false))}
          </div>
        )}
      </div>
    );
  };
  const selectedNode = (() => {
    if (!selectedKey) return null;
    if (selectedKey.includes("|")) {
      const [projectId, hostId] = selectedKey.split("|");
      return (
        data.roots.find(
          (r) => r.projectId === projectId && r.hostId === hostId,
        ) ?? null
      );
    }
    return data.folders.find((x) => x.id === selectedKey) ?? null;
  })();
  const sel = selectedNode;
  const selRoot = !!sel && (selectedKey?.includes("|") ?? false);
  const selLevel = sel && !selRoot ? levelOf(sel) : 0;
  const selRulesAllowed = !!sel && (selRoot || selLevel <= 2);
  useEffect(() => {
    if (!selectedNode || !(selRoot || selLevel <= 2)) {
      setRuleDraft(null);
      setRuleModeSaved(null);
      return;
    }
    let live = true;
    rpc
      .call("rules_read", {
        projectId: selectedNode.projectId,
        folderId: selRoot ? null : selectedNode.id,
      })
      .then(
        (r) => {
          if (live) {
            setRuleDraft({
              mode: r.mode,
              sectionTemplate: r.template || r.suggestedSection,
              projectTemplate: r.projectTemplate || r.suggestedProject,
              custom: r.custom,
              customTarget: r.customTarget,
              startup: r.startup,
            });
            setRuleModeSaved(r.mode);
          }
        },
        () => {
          if (live) {
            setRuleDraft(null);
            setRuleModeSaved(null);
          }
        },
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey, rpc]);
  const cardCopies = sel && selRoot ? projectCopies(sel.projectId) : [];
  /** Every machine BB knows: the ones holding a copy first, then the free ones. */
  const cardMachines =
    sel && selRoot
      ? [
          ...cardCopies.map((c) => c.hostId),
          ...data.machines
            .filter((m) => !cardCopies.some((c) => c.hostId === m.id))
            .map((m) => m.id),
        ]
      : [];
  const cardHost =
    (sel &&
      selRoot &&
      cardMachines.find((id) => id === (cardHostState ?? sel.hostId))) ||
    sel?.hostId ||
    "";
  /** The copy on the open device tab, or null when that machine has none yet. */
  const cardCopy = cardCopies.find((c) => c.hostId === cardHost) ?? null;
  const online = (id: string) =>
    data.machines.find((m) => m.id === id)?.connected ?? false;
  useEffect(() => {
    // Follow the clicked row: stale device tabs leaked content across projects.
    setCardHostState(null);
  }, [selectedKey]);
  useEffect(() => {
    setCardDraft(null);
    setCardClaude(null);
    setCardClaudeDraft(null);
    setCardRuleError("");
    // Every project and section with rules shows its own AGENTS.md.
    if (!sel || !(selRoot || selLevel <= 2)) return;
    // A machine without a copy has no file to read yet.
    if (selRoot && !cardCopy) return;
    let live = true;
    rpc
      .call("rules_read", {
        projectId: sel.projectId,
        folderId: selRoot ? null : sel.id,
        hostId: cardHost,
      })
      .then(
        (r) => {
          if (live) {
            setCardDraft(r.content);
            setCardSaved(r.content);
            setCardClaude(r.claude);
            setCardClaudeDraft(r.claude);
          }
        },
        (e) => {
          if (live) {
            setCardDraft("");
            setCardRuleError(String(e));
          }
        },
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.projectId, sel?.id, selRoot, selLevel, cardHost, cardCopy, rpc]);
  const saveCardRules = async (file: "AGENTS.md" | "CLAUDE.md") => {
    if (!sel) return;
    const draft = file === "AGENTS.md" ? cardDraft : cardClaudeDraft;
    if (draft === null) return;
    setCardSaving(true);
    setCardRuleError("");
    try {
      const at = {
        projectId: sel.projectId,
        folderId: selRoot ? null : sel.id,
        hostId: cardHost,
      };
      await rpc.call("rules_save", {
        ...at,
        content: draft,
        sha: null,
        ...(file === "CLAUDE.md" ? { file } : {}),
      });
      if (file === "AGENTS.md") {
        setCardSaved(draft);
        const r = await rpc.call("rules_read", at);
        setCardClaude(r.claude);
        setCardClaudeDraft(r.claude);
      } else {
        setCardClaude(draft);
      }
    } catch (e) {
      setCardRuleError(String(e));
    } finally {
      setCardSaving(false);
    }
  };
  const saveRules = async () => {
    if (!selectedNode || !ruleDraft) return;
    setRuleSaving(true);
    setRuleSaved(false);
    setRuleError("");
    try {
      await rpc.call("rules_settings_save", {
        projectId: selectedNode.projectId,
        folderId: selRoot ? null : selectedNode.id,
        mode: ruleDraft.mode,
        sectionTemplate: ruleDraft.sectionTemplate,
        projectTemplate: ruleDraft.projectTemplate,
        custom: ruleDraft.custom,
        customTarget: ruleDraft.customTarget,
        startup: ruleDraft.startup,
      });
      setRuleModeSaved(ruleDraft.mode);
      setRuleSaved(true);
    } catch (e) {
      setRuleError(String(e));
    } finally {
      setRuleSaving(false);
    }
  };
  // AGENTS.md and CLAUDE.md of the selected copy: the files the agents read.
  const fileEditors = (
    <div className="pf-agents-preview" key={cardHost}>
      <label className="pf-field">
        AGENTS.md · {machineName(cardHost)}
        {cardDraft === null ? (
          <p className="pf-agents-hint">{t("Загрузка…")}</p>
        ) : (
          <textarea
            className="pf-rules"
            rows={8}
            aria-label={`${t("Содержимое AGENTS.md")} — ${machineName(cardHost)}`}
            value={cardDraft}
            disabled={cardSaving}
            onChange={(e) => setCardDraft(e.target.value)}
          />
        )}
      </label>
      {cardClaude !== null && cardClaudeDraft !== null && (
        <label className="pf-field">
          CLAUDE.md · {machineName(cardHost)}
          <textarea
            className="pf-rules"
            rows={5}
            aria-label={`CLAUDE.md — ${machineName(cardHost)}`}
            value={cardClaudeDraft}
            disabled={cardSaving}
            onChange={(e) => setCardClaudeDraft(e.target.value)}
          />
          {cardClaudeDraft !== cardClaude && (
            <span className="pf-agents-actions">
              <Button
                size="sm"
                disabled={cardSaving || !cardClaudeDraft.trim()}
                onClick={() => void saveCardRules("CLAUDE.md")}
              >
                {cardSaving ? t("Сохраняю…") : t("Сохранить")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={cardSaving}
                onClick={() => setCardClaudeDraft(cardClaude)}
              >
                {t("Отмена")}
              </Button>
            </span>
          )}
        </label>
      )}
      {cardDraft !== null && cardDraft !== cardSaved && (
        <div className="pf-agents-actions">
          <Button
            size="sm"
            disabled={cardSaving || !cardDraft.trim()}
            onClick={() => void saveCardRules("AGENTS.md")}
          >
            <Icon name={cardSaving ? "Settings" : "CircleCheck"} />
            {cardSaving ? t("Сохраняю…") : t("Сохранить")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={cardSaving}
            onClick={() => setCardDraft(cardSaved)}
          >
            {t("Отмена")}
          </Button>
        </div>
      )}
      {cardRuleError && (
        <p role="alert" className="text-destructive text-sm">
          {cardRuleError}
        </p>
      )}
    </div>
  );
  const details = sel && (
    <section className="pf-card pf-details">
      <h2>{sel.name}</h2>
      {selRoot ? (
        <div className="pf-root-copies">
          {cardMachines.length > 1 && (
            <div
              className="pf-tabs"
              role="tablist"
              aria-label={t("Устройство")}
            >
              {cardMachines.map((id) => {
                const copy = cardCopies.find((c) => c.hostId === id) ?? null;
                // A solid bolt means the machine is connected right now.
                return (
                  <button
                    key={`${sel.projectId}:${id}`}
                    type="button"
                    role="tab"
                    aria-selected={cardHost === id}
                    className={
                      "pf-tab" +
                      (cardHost === id ? " pf-selected" : "") +
                      (online(id) ? " pf-tab-live" : "") +
                      (copy ? "" : " pf-tab-free")
                    }
                    title={
                      copy?.path ??
                      (online(id)
                        ? t("Копии проекта на этой машине нет")
                        : t("Машина не подключена"))
                    }
                    onClick={() => setCardHostState(id)}
                  >
                    <Icon name="Zap" />
                    {machineName(id)}
                  </button>
                );
              })}
            </div>
          )}
          {cardCopy ? (
            <div className="pf-path-control">
              <Input
                readOnly
                aria-label={t("Папка проекта")}
                value={cardCopy.path}
              />
              <Button
                type="button"
                variant="outline"
                aria-label={t("Выбрать папку")}
                onClick={() => setMovingProject(cardCopy)}
              >
                <Icon name="Folder" />
              </Button>
            </div>
          ) : (
            <div className="pf-path-control">
              <Input
                readOnly
                disabled
                value=""
                aria-label={t("Папка проекта")}
                placeholder={t("Копии проекта на этой машине нет")}
              />
              <Button
                variant="outline"
                disabled={!online(cardHost)}
                onClick={() => {
                  setCopyHost(cardHost);
                  setCopyRoot(sel);
                }}
              >
                <Icon name="Plus" />
                {online(cardHost)
                  ? t("Добавить копию")
                  : t("Машина не подключена")}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="pf-folder-path">{sel.path}</p>
      )}
      <div className="pf-details-actions">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            nav.toPluginPanel("folders", {
              // Follow the open device tab: the copy you are looking at.
              subPath: `chat/${sel.projectId}/${
                selRoot ? `root:${cardCopy?.hostId ?? sel.hostId}` : sel.id
              }`,
            })
          }
        >
          <Icon name="MessageCirclePlus" />
          {t("Новый чат")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setModal({
              action: "create",
              target: {
                projectId: sel.projectId,
                folderId: selRoot ? null : sel.id,
              },
              folder: selRoot ? (cardCopy ?? sel) : sel,
              level: selLevel,
            })
          }
        >
          <Icon name="SectionAdd" />
          {t("Новый раздел")}
        </Button>
        {!selRoot && selLevel <= 2 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setModal({
                action: "rules",
                target: {
                  projectId: sel.projectId,
                  folderId: sel.id,
                },
                folder: sel,
                level: selLevel,
              })
            }
          >
            <Icon name="Settings" />
            {t("Правила")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="pf-ghost-muted"
          onClick={() =>
            setModal({
              action: "rename",
              target: {
                projectId: sel.projectId,
                folderId: selRoot ? null : sel.id,
              },
              folder: sel,
              level: selLevel,
            })
          }
        >
          <Icon name="Edit" />
          {t("Переименовать")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="pf-ghost-muted"
          onClick={() =>
            setStyling({
              projectId: sel.projectId,
              folder: selRoot ? null : sel,
              name: sel.name,
            })
          }
        >
          <Icon name="Palette" />
          {t("Оформление")}
        </Button>
        {!selRoot && (
          <Button
            size="sm"
            variant="ghost"
            className="pf-ghost-muted"
            onClick={() => setMovingSection(sel)}
          >
            <Icon name="FolderExport" />
            {t("Изменить путь")}
          </Button>
        )}
        {selRoot && (
          <Button
            size="sm"
            variant="ghost"
            className="pf-ghost-muted"
            onClick={() => setCopyRoot(sel)}
          >
            <Icon name="Copy" />
            {t("Рабочие копии")}
          </Button>
        )}
        {!selRoot && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setModal({
                action: "forget",
                target: { projectId: sel.projectId, folderId: sel.id },
                folder: sel,
                level: selLevel,
              })
            }
          >
            <Icon name="Archive" />
            {t("В архив")}
          </Button>
        )}
        {selRoot && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setModal({
                action: "remove",
                target: { projectId: sel.projectId, folderId: null },
                folder: sel,
                level: selLevel,
              })
            }
          >
            <Icon name="Trash2" />
            {t("Удалить")}
          </Button>
        )}
      </div>
      {selRulesAllowed && (
        <div className="pf-agents-rule">
          <h3>
            {t("Правила AGENTS.md")}
            <Help
              text={t(
                "Вкладка решает, кто ведёт AGENTS.md этой папки: шаблон из настроек плагина, свой шаблон для этого места или ваш файл, в который плагин не пишет ничего.",
              )}
            />
          </h3>
          {ruleDraft ? (
            <>
              <RuleFields
                draft={ruleDraft}
                onChange={(patch) => {
                  setRuleDraft({ ...ruleDraft, ...patch });
                  setRuleSaved(false);
                }}
                showProject={selRoot}
                namePrefix="pf-details"
                fileSlot={
                  selRoot && !cardCopy ? (
                    <p className="pf-agents-empty">
                      {t("Копии проекта на этой машине нет")}
                    </p>
                  ) : (
                    fileEditors
                  )
                }
                customNote={
                  <p className="pf-agents-hint">
                    {selRoot
                      ? t(
                          "Общие для всех машин проекта: применяются к новым разделам и по кнопке «Применить к существующим разделам».",
                        )
                      : t(
                          "Этот шаблон получают новые подразделы и команда «Применить к существующим разделам» для этого раздела.",
                        )}
                  </p>
                }
              />
              {/* The file tab saves through its own buttons; the mode itself
                  is only saved when it differs from the stored one. */}
              {(ruleDraft.mode !== "manual" || ruleModeSaved !== "manual") && (
                <div className="pf-agents-actions">
                  <Button
                    disabled={ruleSaving}
                    onClick={() => void saveRules()}
                  >
                    <Icon name={ruleSaved ? "CircleCheck" : "Settings"} />
                    {ruleSaved ? t("Сохранено") : t("Сохранить")}
                  </Button>
                </div>
              )}
              {ruleError && (
                <p role="alert" className="text-destructive text-sm">
                  {ruleError}
                </p>
              )}
            </>
          ) : (
            <p className="pf-agents-hint">{t("Загрузка…")}</p>
          )}
        </div>
      )}
    </section>
  );
  if (action === "chat")
    return f ? (
      <div className="pf-native-compose" ref={composeRef}>
        {projectSlot &&
          createPortal(
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={projectSlot.className}
                  aria-label={t("Проекты и разделы")}
                  title={f.path}
                >
                  <Icon name="Folder" />
                  <span className="min-w-0 truncate">
                    {selectedNames.join(" / ")}
                  </span>
                  <Icon name="ChevronDown" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="max-h-80 overflow-auto min-w-64">
                {data.roots.map((r) => sectionMenu(r))}
              </DropdownMenuContent>
            </DropdownMenu>,
            projectSlot.node,
          )}
        {submitError && (
          <p role="alert" className="text-destructive p-4">
            {submitError}
          </p>
        )}
        <NewThreadComposer
          key={`${f.id}:${f.hostId}`}
          defaultProjectId={projectId}
          defaultEnvironment={{
            type: "provider",
            environmentProviderId: "project-checkout",
            machine: { type: "existing", hostId: f.hostId },
            inputs: { path: f.path },
          }}
          draftKey={`project-folders:${f.id}`}
          layout="document"
          className="w-full"
          onSubmit={async (request) => {
            setSubmitError("");
            try {
              const t = await rpc.call("spawn", {
                projectId,
                folderId: rootSelected ? null : folderId,
                hostId: f.hostId,
                request: request as unknown as ComposerRequest,
              });
              nav.toThread(t.id);
            } catch (e) {
              const message = e instanceof Error ? e.message : String(e);
              const m = message.match(
                /This section lives on the "(.+)" device\./,
              );
              setSubmitError(
                m
                  ? `${t("Этот раздел живёт на устройстве")} «${m[1]}». ${t("Выберите это устройство или создайте раздел на нужном сервере.")}`
                  : message,
              );
              throw e;
            }
          }}
        />
      </div>
    ) : (
      <p className="p-4">{error || t("Загрузка…")}</p>
    );
  return (
    <div className="pf pf-panel" dir={direction()}>
      <div className="pf-header">
        <h1>{t("Проекты и разделы")}</h1>
        <div className="pf-header-side">
          <LanguagePicker />
          <Button onClick={() => setNewProject(true)}>
            <Icon name="FolderPlus" />
            {t("Новый проект")}
          </Button>
        </div>
      </div>
      <p className="pf-intro">
        {t(
          "Разделы — папки проекта. Переписка и служебные материалы хранятся в скрытой папке",
        )}{" "}
        <code>.bb/chats/</code> {t("каждого раздела.")}
      </p>
      <div className="pf-layout">
        <aside className="pf-side" aria-label={t("Проекты и разделы")}>
          <nav aria-label={t("Настройки плагина")}>
            <div className="pf-side-heading">{t("Настройки")}</div>
            <SettingsNav
              variant="side"
              value={sel ? null : settingsView}
              onChange={(section) => {
                setSelectedKey(null);
                setSettingsView(section);
              }}
            />
          </nav>
          <div className="pf-side-heading">{t("Проекты")}</div>
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
          {visibleRoots.map((r) => sideNode(r, true))}
          {reorderError && (
            <p role="alert" className="text-destructive pf-side-error">
              {reorderError}
            </p>
          )}
        </aside>
        <main className="pf-main">
          <PendingMoves />
          <PendingSectionMoves />
          {details}
          {!sel && (
            <SettingsPane
              section={settingsView}
              archive={<ArchiveList bare />}
            />
          )}
          {[error, ...data.errors].filter(Boolean).map((e, i) => (
            <p className="text-destructive" role="alert" key={i}>
              {e}
            </p>
          ))}
        </main>
      </div>
      <MoveDialog
        folder={movingProject}
        onClose={() => setMovingProject(null)}
        onMoved={refresh}
      />
      <SectionMoveDialog
        folder={movingSection}
        onClose={() => setMovingSection(null)}
        onMoved={refresh}
      />
      <ProjectDialog
        defaultHostId={data.roots[0]?.hostId}
        open={newProject}
        onClose={() => setNewProject(false)}
        onCreated={refresh}
      />
      <FolderDialog
        modal={modal}
        onClose={() => setModal(null)}
        onCreated={refresh}
      />
      <AppearanceDialog
        target={styling}
        folders={data.folders}
        onClose={() => setStyling(null)}
      />
      <CopiesDialog
        root={copyRoot}
        presetHost={copyHost}
        onRelocate={(copy) => {
          setCopyRoot(null);
          setMovingProject(copy);
        }}
        onClose={() => setCopyRoot(null)}
        onChanged={refresh}
      />
    </div>
  );
}
function SettingsSection() {
  useLanguage();
  return (
    <div className="pf" dir={direction()}>
      <PluginSettings archive={<ArchiveList bare />} />
    </div>
  );
}
export default definePluginApp((app) => {
  app.slots.experimental_threadHeaderAction({
    id: "section-label",
    title: "Section location",
    component: ThreadSectionLabel,
  });
  app.slots.experimental_threadList({
    id: "tree",
    title: t("Проекты и разделы"),
    description: t("Дерево папок и чатов"),
    component: Tree,
  });
  app.slots.navPanel({
    id: "folders",
    path: "folders",
    title: t("Проекты и разделы"),
    icon: "Folder",
    component: Panel,
  });
  app.slots.settingsSection({
    id: "settings",
    component: SettingsSection,
  });

});
