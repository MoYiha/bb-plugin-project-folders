import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useComposerView,
  useRealtime,
  useRpc,
  type PluginEnvironmentProviderInputsProps,
} from "@get-bb/plugin-sdk/app";
import type { Folder, rpcContract } from "./server";
import {
  composerEnvironmentId,
  environmentLabel,
  sectionOptions,
  SECTION_ENVIRONMENT_ID,
  type SectionTree,
} from "./section-tree";
import { direction, t, useLanguage } from "./i18n";

export { SECTION_ENVIRONMENT_ID };

/** A group holds sections and has no folder a chat could run in. */
const isGroup = (f: Folder) => f.kind === "group";

/**
 * The control BB's own New thread screen renders beside "Project section".
 * A plain select, because it lives inside BB's environment popover: the tree
 * is carried by the indent, not by a second scrolling panel.
 */
export function SectionEnvironmentInputs({
  projectId,
  target,
  value,
  onChange,
}: PluginEnvironmentProviderInputsProps) {
  useLanguage();
  const rpc = useRpc<typeof rpcContract>();
  const [tree, setTree] = useState<SectionTree | null>(null);
  const [error, setError] = useState("");
  const hostId = target.kind === "existing-host" ? target.hostId : null;
  const chosen =
    value && typeof value === "object" && !Array.isArray(value)
      ? String((value as { folderId?: unknown }).folderId ?? "")
      : "";
  useEffect(() => {
    let live = true;
    rpc.call("list", null).then(
      (r) => live && setTree({ folders: r.folders, roots: r.roots }),
      (e) => live && setError(String(e)),
    );
    return () => {
      live = false;
    };
  }, [rpc]);
  const options = useMemo(
    () =>
      tree && projectId && hostId
        ? sectionOptions(tree, projectId, hostId).filter(
            (o) => !isGroup(o.folder),
          )
        : [],
    [tree, projectId, hostId],
  );
  // A chosen section that is gone — archived, moved to another device — must
  // not submit silently under a stale id.
  useEffect(() => {
    if (!tree) return;
    if (chosen && !options.some((o) => o.folder.id === chosen))
      onChange({
        status: "blocked",
        reason: t("Раздел больше не доступен здесь. Выберите другой."),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, chosen, options]);
  if (error)
    return (
      <p role="alert" className="pf-env-inputs-note text-destructive">
        {error}
      </p>
    );
  if (!projectId || !hostId)
    return (
      <p className="pf-env-inputs-note">
        {t("Сначала выберите проект и устройство.")}
      </p>
    );
  if (!tree) return <p className="pf-env-inputs-note">{t("Загрузка…")}</p>;
  if (options.length === 0)
    return (
      <p className="pf-env-inputs-note">
        {t("У проекта нет разделов на этом устройстве.")}
      </p>
    );
  return (
    <div className="pf pf-env-inputs" data-bb-ru-skip="">
      <select
        className="pf-select"
        aria-label={t("Раздел проекта")}
        value={chosen}
        onChange={(e) =>
          onChange(
            e.target.value
              ? { status: "ready", value: { folderId: e.target.value } }
              : { status: "blocked", reason: t("Выберите раздел проекта.") },
          )
        }
      >
        <option value="">{t("Выберите раздел проекта")}</option>
        {options.map(({ folder, depth }) => (
          <option key={folder.id} value={folder.id}>
            {`${"  ".repeat(depth)}${folder.name}`}
          </option>
        ))}
      </select>
      <p className="pf-env-inputs-note">
        {options.find((o) => o.folder.id === chosen)?.folder.path ??
          t("Чат начнёт работу в папке этого раздела.")}
      </p>
    </div>
  );
}

/**
 * A line under BB's own New thread composer naming the section the chat will
 * start in. BB's project chip says the project and stops there, so a chat
 * handed off to a new thread looked like it was starting at the project root
 * when it was really continuing in a section folder.
 */
export function ComposerSectionBanner() {
  useLanguage();
  const rpc = useRpc<typeof rpcContract>();
  const view = useComposerView();
  const projectId =
    view.scope.kind === "new-thread" ? view.scope.projectId : null;
  const [tree, setTree] = useState<
    (SectionTree & { bindings: Record<string, string> }) | null
  >(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const load = useCallback(() => {
    rpc.call("list", null).then(
      (r) =>
        setTree({ folders: r.folders, roots: r.roots, bindings: r.bindings }),
      () => setTree(null),
    );
  }, [rpc]);
  useEffect(load, [load]);
  useRealtime("changed", load);
  // BB owns the environment picker and publishes no event for it, so the
  // selection is polled while the composer is on screen.
  useEffect(() => {
    const read = () =>
      setEnvironmentId(composerEnvironmentId(projectId, sessionStorage));
    read();
    const timer = setInterval(read, 1000);
    return () => clearInterval(timer);
  }, [projectId]);
  const found =
    tree && environmentId ? environmentLabel(tree, environmentId) : null;
  if (!found) return null;
  return (
    <p className="pf pf-composer-section" dir={direction()} title={found.path}>
      <span>{t("Чат начнётся в разделе:")}</span> {found.label}
    </p>
  );
}
