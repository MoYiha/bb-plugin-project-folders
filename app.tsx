import { FolderBrowser } from "./folder-browser";
import { ThreadSectionLabel } from "./thread-section-label";
import { MoveDialog, PendingMoves } from "./move-dialog";
import { ChatSettings, ChatSortMenu, useChatSettings } from "./chat-settings";
import { sortChats } from "./chat-list";
import { t, useLanguage, LanguagePicker, direction } from "./i18n";
import { useCallback, useEffect, useState, useRef } from "react";
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
  action: "create" | "rules" | "rename" | "forget";
  target: Target;
  folder: Folder;
};
function useTree() {
  const rpc = useRpc<typeof rpcContract>();
  const [data, setData] = useState<{
    folders: Folder[];
    roots: Folder[];
    bindings: Record<string, string>;
    errors: string[];
  }>({ folders: [], roots: [], bindings: {}, errors: [] });
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
  const [sha, setSha] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setHostId(modal?.folder.hostId ?? "");
    setLocations([]);
    setLocationsLoading(modal?.action === "create");
    let live = true;
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
    setLoading(false);
    if (modal?.action === "rules") {
      setLoading(true);
      rpc.call("rules_read", modal.target).then(
        (r) => {
          setContent(r.content);
          setSha(r.sha);
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
  }, [modal, rpc]);
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
      else await rpc.call("rules_save", { ...modal.target, content, sha });
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
                <p className="pf-folder-path">{modal.folder.path}/AGENTS.md</p>
                <textarea
                  className="pf-rules"
                  aria-label={t("Правила AGENTS.md")}
                  rows={12}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </>
            )}
            {modal?.action === "forget" && (
              <p className="text-sm mb-4">
                {t(
                  "Папка вместе с вложенными разделами, правилами и историей переместится в скрытый архив проекта .bb/archive/sections/. Чаты будут архивированы. Всё можно восстановить на странице «Проекты и разделы».",
                )}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("Отмена")}
              </Button>
              <Button
                type="submit"
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
  return (
    <div
      className={"pf-thread " + (active === thread.id ? "pf-active" : "")}
      draggable
      onDragStart={(event) => {
        if (menuOpen) {
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
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
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
        <span className={thread.isUnread ? "pf-unread" : ""}>
          {thread.title || thread.titleFallback}
        </span>
      </a>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="pf-icon" aria-label={t("Действия чата")}>
            <Icon name="MoreHorizontal" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
function Tree(props: PluginThreadListProps) {
  const language = useLanguage();
  const [listSettings] = useChatSettings();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { rpc, data, error, refresh } = useTree();
  const { threads, projects, status } = experimental_useSidebarThreads();
  const environmentKey = threads.map((t) => t.environment?.id ?? "").join("|");
  useEffect(refresh, [environmentKey, refresh]);
  const actions = experimental_useSidebarThreadActions();
  const nav = useBbNavigate();
  const [modal, setModal] = useState<Modal | null>(null);
  const [newProject, setNewProject] = useState(false);
  const [movingProject, setMovingProject] = useState<Folder | null>(null);
  const [movingChat, setMovingChat] = useState<PluginSidebarThread | null>(
    null,
  );
  const [draggedChat, setDraggedChat] = useState<PluginSidebarThread | null>(
    null,
  );
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState("");
  const canMove = (chat: PluginSidebarThread | null, folder: Folder) =>
    !!chat &&
    chat.projectId === folder.projectId &&
    chat.host?.id === folder.hostId;
  const moveChat = async (
    chat: PluginSidebarThread,
    folder: Folder,
    root: boolean,
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
      setClosed((old) => ({ ...old, [folder.id]: false }));
      refresh();
    } catch (error) {
      setMoveError(String(error));
      setMovingChat(chat);
    } finally {
      setMoveBusy(false);
    }
  };

  const [closed, setClosed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("project-folders:collapsed") || "{}",
      );
    } catch {
      return {};
    }
  });
  const toggle = (id: string) =>
    setClosed((old) => {
      const next = { ...old, [id]: !old[id] };
      localStorage.setItem("project-folders:collapsed", JSON.stringify(next));
      return next;
    });
  const open = async (f: Folder, root: boolean) => {
    if (root) {
      actions.openNewThread({ projectId: f.projectId, focusPrompt: true });
      props.onNavigate();
      return;
    }
    nav.toPluginPanel("folders", { subPath: `chat/${f.projectId}/${f.id}` });
    props.onNavigate();
  };
  const rows = (ts: readonly PluginSidebarThread[], group: string) => {
    const sorted = sortChats(ts, listSettings.sort, language);
    const shown = expanded[group]
      ? sorted
      : sorted.slice(0, listSettings.limit);
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
        {sorted.length > listSettings.limit && (
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
  const node = (f: Folder, root = false): React.ReactNode => {
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
    return (
      <div key={f.id} className={root ? "pf-project" : "pf-folder"}>
        <div
          className={
            "pf-heading" + (dropTarget === f.id ? " pf-drop-target" : "")
          }
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
              void moveChat(draggedChat, f, root);
          }}
        >
          <button
            className="pf-label"
            onClick={() => toggle(f.id)}
            title={f.path}
          >
            <Icon
              name={closed[f.id] ? "ChevronRight" : "ChevronDown"}
              className="pf-chevron"
            />
            <Icon name="Folder" />
            <span>{f.name}</span>
          </button>
          <button
            className="pf-icon"
            title={t("Новый чат")}
            aria-label={`${t("Новый чат")}: ${f.name}`}

            onClick={() => void open(f, root)}
          >
            <Icon name="MessageCirclePlus" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="pf-icon"
                aria-label={`${t("Действия чата")}: ${f.name}`}
              >
                <Icon name="MoreHorizontal" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {root && (
                <DropdownMenuItem onSelect={() => setNewProject(true)}>
                  <Icon name="FolderPlus" />
                  {t("Новый проект")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onSelect={() =>
                  setModal({ action: "create", target, folder: f })
                }
              >
                <Icon name="SectionAdd" />
                {t("Новый раздел")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <ChatSortMenu />
              {root && (
                <DropdownMenuItem onSelect={() => setMovingProject(f)}>
                  <Icon name="Folder" />
                  {t("Перенести")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  setModal({ action: "rules", target, folder: f })
                }
              >
                <Icon name="Settings" />
                {t("Правила работы")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  setModal({ action: "rename", target, folder: f })
                }
              >
                <Icon name="Edit" />
                {t("Переименовать")}
              </DropdownMenuItem>
              {!root && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() =>
                      setModal({ action: "forget", target, folder: f })
                    }
                  >
                    <Icon name="Archive" />
                    {t("Архивировать")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {!closed[f.id] && (
          <div className="pf-children">
            {children.map((c) => node(c))}
            {rows(ts, f.id)}
          </div>
        )}
      </div>
    );
  };
  return (
    <div className="pf pf-tree" dir={direction()}>
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
      {data.roots.map((f) => node(f, true))}
      {projects
        .filter((p) => !data.roots.some((r) => r.projectId === p.id))
        .map((p) => (
          <div className="pf-project" key={p.id}>
            <div className="pf-heading">
              <button className="pf-label" onClick={() => toggle(p.id)}>
                <Icon name={closed[p.id] ? "ChevronRight" : "ChevronDown"} />
                <span>{p.isPersonal ? t("Без проекта") : p.name}</span>
              </button>
              <button
                className="pf-icon"
                aria-label={t("Новый чат без проекта")}
                onClick={() => {
                  actions.openNewThread({ projectId: p.id, focusPrompt: true });
                  props.onNavigate();
                }}
              >
                <Icon name="MessageCirclePlus" />
              </button>
            </div>
            {!closed[p.id] && (
              <div className="pf-children">
                {rows(
                  threads.filter((t) => t.projectId === p.id),
                  p.id,
                )}
              </div>
            )}
          </div>
        ))}
      <button
        className="pf-manage"
        onClick={() => nav.toPluginPanel("folders")}
      >
        {t("Управление разделами")}
      </button>
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
                  <button
                    className="pf-move-target"
                    style={{ paddingInlineStart: 12 + depth * 18 }}
                    disabled={moveBusy || !canMove(movingChat, folder)}
                    onClick={() => {
                      if (movingChat) void moveChat(movingChat, folder, root);
                    }}
                    title={folder.path}
                  >
                    <Icon name="Folder" />
                    <span>{folder.name}</span>
                  </button>
                  {data.folders
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
          {moveBusy && <p role="status">{t("Перенос чата…")}</p>}
        </DialogContent>
      </Dialog>
      <MoveDialog
        folder={movingProject}
        onClose={() => setMovingProject(null)}
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
    </div>
  );
}
function ArchiveList() {
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
  return (
    <section className="pf-card">
      <h2>{t("Архив разделов")}</h2>
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      {!items.length && (
        <p className="text-muted-foreground">{t("Архив пуст")}</p>
      )}
      {items.map((a) => (
        <div key={a.id} className="border-t py-3 mt-3">
          <div className="flex justify-between items-center gap-3">
            <strong>{a.folder.name}</strong>
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
          <p className="pf-folder-path">{a.folder.path}</p>
          <p className="text-sm text-muted-foreground">
            {new Date(a.createdAt).toLocaleString()} · {a.members.length}{" "}
            {t("разделов ·")}
            {a.threadIds.length} {t("чатов")}
          </p>
          {a.error && (
            <p role="alert" className="text-destructive text-sm">
              {a.error}
            </p>
          )}
        </div>
      ))}
    </section>
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
  const nav = useBbNavigate();
  const [action, projectId, folderId] = (subPath || "")
    .replace(/^\//, "")
    .split("/");
  const f =
    data.folders.find((f) => f.id === folderId && f.projectId === projectId) ??
    data.roots.find(
      (r) => r.projectId === projectId && folderId === `root:${r.hostId}`,
    );
  const rootSelected = folderId?.startsWith("root:") ?? false;
  const sectionMenu = (r: Folder, depth = 0): React.ReactNode => (
    <div key={`${r.id}:${r.hostId}`}>
      <DropdownMenuItem
        onSelect={() => {
          setSubmitError("");
          nav.toPluginPanel("folders", {
            subPath: `chat/${r.projectId}/${depth === 0 ? `root:${r.hostId}` : r.id}`,
          });
        }}
        style={{ paddingInlineStart: 12 + depth * 18 }}
      >
        <Icon name="Folder" />
        {r.name}
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
  const card = (r: Folder, root = false): React.ReactNode => (
    <div className={root ? "pf-card" : "border-l pl-4 mt-4"} key={r.id}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2>{r.name}</h2>
        <div className="flex flex-wrap gap-1">
          <Button
            variant="ghost"
            onClick={() =>
              setModal({
                action: "rules",
                target: {
                  projectId: r.projectId,
                  folderId: root ? null : r.id,
                },
                folder: r,
              })
            }
          >
            <Icon name="Settings" />
            {t("Правила")}
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setModal({
                action: "rename",
                target: {
                  projectId: r.projectId,
                  folderId: root ? null : r.id,
                },
                folder: r,
              })
            }
          >
            <Icon name="Edit" />
            {t("Переименовать")}
          </Button>
          {root && (
            <Button variant="ghost" onClick={() => setMovingProject(r)}>
              <Icon name="Folder" />
              {t("Перенести")}
            </Button>
          )}
          {!root && (
            <Button
              variant="ghost"
              onClick={() =>
                setModal({
                  action: "forget",
                  target: { projectId: r.projectId, folderId: r.id },
                  folder: r,
                })
              }
            >
              <Icon name="Archive" />
              {t("В архив")}
            </Button>
          )}
        </div>
      </div>
      <p className="pf-folder-path">{r.path}</p>
      <Button
        variant="outline"
        onClick={() =>
          setModal({
            action: "create",
            target: { projectId: r.projectId, folderId: root ? null : r.id },
            folder: r,
          })
        }
      >
        <Icon name="SectionAdd" />
        {t("Новый раздел")}
      </Button>
      {data.folders
        .filter(
          (f) =>
            f.projectId === r.projectId && f.parentId === (root ? null : r.id),
        )
        .map((f) => card(f))}
    </div>
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
              setSubmitError(e instanceof Error ? e.message : String(e));
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
      <div className="flex items-center justify-between gap-4">
        <h1>{t("Проекты и разделы")}</h1>
        <LanguagePicker />
        <Button onClick={() => setNewProject(true)}>
          <Icon name="FolderPlus" />
          {t("Новый проект")}
        </Button>
      </div>
      <p>
        {t(
          "Разделы — папки проекта. Переписка и служебные материалы хранятся в скрытой папке",
        )}{" "}
        <code>.bb/chats/</code> {t("каждого раздела.")}
      </p>
      {data.roots.map((r) => card(r, true))}
      <section className="pf-card">
        <h2>{t("Настройки списка")}</h2>
        <ChatSettings />
      </section>
      <PendingMoves />
      <ArchiveList />
      {[error, ...data.errors].filter(Boolean).map((e, i) => (
        <p className="text-destructive" role="alert" key={i}>
          {e}
        </p>
      ))}
      <MoveDialog
        folder={movingProject}
        onClose={() => setMovingProject(null)}
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
});
