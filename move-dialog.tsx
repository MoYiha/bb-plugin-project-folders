import { useState, useEffect, useCallback } from "react";
import { useRpc, useRealtime } from "@get-bb/plugin-sdk/app";
import type { rpcContract, Folder } from "./server";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./components/ui/dialog";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { Icon } from "./components/ui/icon";
import { t, direction } from "./i18n";
export function MoveDialog({
  folder,
  onClose,
  onMoved,
}: {
  folder: Folder | null;
  onClose: () => void;
  onMoved: () => void;
}) {
  const rpc = useRpc<typeof rpcContract>();
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listing, setListing] = useState<{
    path: string;
    parent: string | null;
    directories: { name: string; path: string }[];
  } | null>(null);
  useEffect(() => {
    setDestination("");
    setError("");
    setListing(null);
  }, [folder]);
  async function browse(path?: string) {
    if (!folder) return;
    setBusy(true);
    setError("");
    try {
      setListing(
        await rpc.call("project_browse", { hostId: folder.hostId, path }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function move() {
    if (!folder) return;
    setBusy(true);
    setError("");
    try {
      await rpc.call("project_move", {
        projectId: folder.projectId,
        hostId: folder.hostId,
        destination,
      });
      onMoved();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open={!!folder}
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
    >
      <DialogContent className="pf-dialog" dir={direction()}>
        <DialogHeader>
          <DialogTitle>{t("Перенести проект")}</DialogTitle>
          <DialogDescription>{folder?.name}</DialogDescription>
        </DialogHeader>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <p className="pf-folder-path">{folder?.path}</p>
        {listing ? (
          <>
            <p className="pf-folder-path">{listing.path}</p>
            <div className="pf-folder-picker">
              {listing.parent && (
                <button
                  disabled={busy}
                  onClick={() => void browse(listing.parent!)}
                >
                  <Icon name="ChevronLeft" />
                  {t("На уровень выше")}
                </button>
              )}
              {listing.directories.map((d) => (
                <button
                  disabled={busy}
                  key={d.path}
                  onClick={() => void browse(d.path)}
                >
                  <Icon name="Folder" />
                  {d.name}
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => setListing(null)}
              >
                {t("Назад")}
              </Button>
              <Button
                disabled={busy}
                onClick={() => {
                  setDestination(
                    listing.path.replace(/\/$/, "") +
                      "/" +
                      folder!.path.split("/").at(-1),
                  );
                  setListing(null);
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
              void move();
            }}
          >
            <label className="pf-field">
              {t("Новый путь проекта")}
              <div className="pf-path-control">
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  required
                  disabled={busy}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void browse()}
                  aria-label={t("Выбрать папку")}
                >
                  <Icon name="Folder" />
                </Button>
              </div>
            </label>
            <p className="text-sm text-muted-foreground mb-3">
              {t(
                "Вся папка переедет вместе со скрытыми файлами и архивом. Старый путь останется ссылкой для существующих чатов. История в базе BB остаётся в BB.",
              )}
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              {t(
                "Выберите новый, ещё не существующий путь на том же диске. Работающие чаты нужно завершить.",
              )}
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onClose}
              >
                {t("Отмена")}
              </Button>
              <Button disabled={busy || !destination}>
                {busy ? t("Выполняю…") : t("Перенести")}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
export function PendingMoves() {
  const rpc = useRpc<typeof rpcContract>();
  const [items, setItems] = useState<
    {
      projectId: string;
      hostId: string;
      destination: string;
      error: string | null;
    }[]
  >([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(() => {
    rpc.call("pending_moves").then(setItems, (e) => setError(String(e)));
  }, [rpc]);
  useEffect(refresh, [refresh]);
  useRealtime("changed", refresh);
  if (!items.length && !error) return null;
  return (
    <section className="pf-card">
      <h2>{t("Незавершённые переносы")}</h2>
      {error && <p role="alert">{error}</p>}
      {items.map((m) => (
        <div key={m.projectId}>
          <p className="pf-folder-path">{m.destination}</p>
          {m.error && <p className="text-destructive text-sm">{m.error}</p>}
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await rpc.call("project_move", m);
                refresh();
              } catch (e) {
                setError(String(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("Повторить")}
          </Button>
        </div>
      ))}
    </section>
  );
}
