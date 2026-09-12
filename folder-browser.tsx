import { useState, useEffect, useRef } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Icon } from "./components/ui/icon";
import { t } from "./i18n";

export function FolderBrowser({
  hostId,
  path,
  parent,
  directories,
  loading,
  navigate,
  refresh,
  onBusyChange,
}: {
  hostId: string;
  path: string;
  parent: string | null;
  directories: { name: string; path: string }[];
  loading: boolean;
  navigate: (path: string) => void;
  refresh: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [remove, setRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pane = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (creating || remove !== null)
      if (pane.current) pane.current.scrollTop = 0;
  }, [creating, remove]);
  const disabled = loading || busy;
  const edit = async (action: "create" | "delete", name: string) => {
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      await rpc.call("folder_edit", { hostId, parent: path, name, action });
      setCreating(false);
      setRemove(null);
      setName("");
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };
  return (
    <div className="pf-native-browser">
      <div className="pf-browser-toolbar">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled || !parent}
          aria-label={t("На уровень выше")}
          onClick={() => parent && navigate(parent)}
        >
          <Icon name="ArrowUp" />
        </Button>
        <span className="pf-browser-location" title={path}>
          {path}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={t("Новая папка")}
          onClick={() => {
            setCreating(true);
            setName("");
            setRemove(null);
            setError("");
          }}
        >
          <Icon name="FolderPlus" />
        </Button>
      </div>
      <div className="pf-browser-entries" ref={pane}>
        {creating && (
          <div className="pf-browser-row">
            <Icon name="Folder" />
            <Input
              autoFocus
              aria-label={t("Название папки")}
              placeholder={t("Название папки")}
              value={name}
              disabled={disabled}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (name.trim() && !disabled)
                    void edit("create", name.trim());
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!busy) setCreating(false);
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("Создать")}
              disabled={disabled || !name.trim()}
              onClick={() => void edit("create", name.trim())}
            >
              <Icon name="Check" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={t("Отмена")}
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              <Icon name="X" />
            </Button>
          </div>
        )}
        {loading ? (
          <p>{t("Загрузка…")}</p>
        ) : (
          remove === null &&
          directories.map((d) => (
            <div className="pf-browser-row" key={d.path}>
              <button
                type="button"
                className="pf-browser-enter"
                disabled={disabled}
                onClick={() => navigate(d.path)}
              >
                <Icon name="Folder" />
                <span>{d.name}</span>
                <Icon name="ChevronRight" />
              </button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`${t("Удалить пустую папку")}: ${d.name}`}
                disabled={disabled}
                onClick={() => {
                  setRemove(d.name);
                  setCreating(false);
                  setError("");
                }}
              >
                <Icon name="Trash2" />
              </Button>
            </div>
          ))
        )}
        {!loading && !directories.length && <p>{t("Нет вложенных папок")}</p>}
        {remove !== null && (
          <div
            className="pf-browser-confirm"
            role="group"
            aria-label={t("Удалить пустую папку")}
          >
            <p>
              {t("Удалить пустую папку")} «{remove}»?
            </p>
            <p>
              {t(
                "Папки с файлами не удаляются. Для разделов используйте архив.",
              )}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRemove(null)}
            >
              {t("Отмена")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => void edit("delete", remove)}
            >
              {t("Удалить")}
            </Button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
