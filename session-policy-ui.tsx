import { useCallback, useEffect, useMemo, useState } from "react";
import { useRpc } from "@get-bb/plugin-sdk/app";
import type { ExecutionScope, rpcContract } from "./server";
import {
  normalizeSessionPolicy,
  SESSION_POLICY_GROUPS,
  type PolicyOrigin,
  type ResolvedSessionPolicy,
  type SessionFilter,
  type SessionPolicy,
  type SessionPolicyGroup,
} from "./session-policy";
import { t } from "./i18n";
import { Button } from "./components/ui/button";
import { Checkbox } from "./components/ui/checkbox";
import { Icon } from "./components/ui/icon";
import { Input } from "./components/ui/input";

type Loaded = {
  own: SessionPolicy;
  inherited: ResolvedSessionPolicy;
  effective: ResolvedSessionPolicy;
};
type Inventory = Partial<
  Record<SessionPolicyGroup, { name: string; label: string }[]>
>;
const INHERIT = "__inherit";

/**
 * Whether the running BB can enforce session rules. Asked once per page:
 * the answer only changes when BB itself is replaced.
 */
let availability: Promise<boolean> | null = null;
export function useSessionPolicyAvailable(): boolean {
  const rpc = useRpc<typeof rpcContract>();
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    let live = true;
    availability ??= rpc
      .call("session_policy_capability", null)
      .then((r) => (r as { available: boolean }).available)
      .catch(() => {
        availability = null;
        return false;
      });
    void availability.then((value) => {
      if (live) setAvailable(value);
    });
    return () => {
      live = false;
    };
  }, [rpc]);
  return available;
}

const groupMeta = (group: SessionPolicyGroup) =>
  ({
    bbPlugins: {
      title: t("Плагины BB"),
      hint: t("Инструкции, инструменты и навыки плагинов BB."),
    },
    skills: {
      title: t("Навыки"),
      hint: t("Навыки BB и собственные навыки CLI по имени."),
    },
    mcpServers: {
      title: t("MCP-серверы"),
      hint: t("Серверы из настроек CLI на машине."),
    },
    nativePlugins: {
      title: t("Плагины CLI"),
      hint: t("Плагины Claude Code и Codex."),
    },
  })[group];

function originLabel(origin: PolicyOrigin | undefined, scope: ExecutionScope) {
  if (!origin) return t("как в BB");
  if (origin.scope === "global") return t("из настроек плагина");
  if (origin.scope === "project") return t("из проекта");
  return scope.kind === "folder" && origin.folderId === scope.folderId
    ? t("отсюда")
    : t("из раздела выше");
}

function modeLabel(filter: SessionFilter | undefined) {
  if (!filter || filter.mode === "all") return t("Все");
  return filter.mode === "allow"
    ? t("Только выбранные: {n}").replace("{n}", String(filter.names.length))
    : t("Все, кроме: {n}").replace("{n}", String(filter.names.length));
}

/**
 * What an agent session started here loads: BB plugins, skills, MCP servers
 * and CLI plugins. Every group inherits until it is set here, like the
 * provider and model defaults next to it.
 */
export function SessionPolicyEditor({ scope }: { scope: ExecutionScope }) {
  const rpc = useRpc<typeof rpcContract>();
  const [state, setState] = useState<Loaded | null>(null);
  const [draft, setDraft] = useState<SessionPolicy>({});
  const [inventory, setInventory] = useState<Inventory>({});
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const key =
    scope.kind === "folder"
      ? `f:${scope.folderId}`
      : scope.kind === "project"
        ? `p:${scope.projectId}`
        : "g";
  const load = useCallback(async () => {
    const value = (await rpc.call("session_policy_read", { scope })) as Loaded;
    setState(value);
    setDraft(value.own);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rpc, key]);
  useEffect(() => {
    let live = true;
    setState(null);
    setError("");
    setSaved(false);
    load().catch((e) => {
      if (live) setError(String(e));
    });
    rpc
      .call("session_policy_inventory", { scope })
      .then((r) => {
        if (live) setInventory(r as Inventory);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);
  if (error && !state)
    return (
      <p role="alert" className="text-destructive text-sm">
        {error}
      </p>
    );
  if (!state) return <p className="pf-agents-hint">{t("Загрузка…")}</p>;

  const patch = (next: Partial<SessionPolicy>) => {
    setDraft((current) => ({ ...current, ...next }));
    setSaved(false);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await rpc.call("session_policy_save", {
        scope,
        value: normalizeSessionPolicy(draft),
      });
      await load();
      setSaved(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const inheritedInstructions = state.inherited.userInstructions;
  return (
    <div className="pf-exec-rows pf-session-rows">
      {SESSION_POLICY_GROUPS.map((group) => (
        <GroupRow
          key={group}
          group={group}
          scope={scope}
          own={draft[group]}
          inherited={state.inherited[group]}
          items={inventory[group] ?? []}
          disabled={busy}
          onChange={(value) => patch({ [group]: value })}
        />
      ))}
      <div className="pf-exec-row">
        <div className="pf-exec-text pf-exec-text-switchless">
          <span>{t("Личные правила BB")}</span>
          <span className="pf-exec-from">
            {draft.userInstructions === undefined
              ? originLabel(inheritedInstructions?.origin, scope)
              : ""}
          </span>
        </div>
        <select
          className="pf-select"
          aria-label={t("Личные правила BB")}
          disabled={busy}
          value={
            draft.userInstructions === undefined
              ? INHERIT
              : draft.userInstructions
                ? "on"
                : "off"
          }
          onChange={(e) =>
            patch({
              userInstructions:
                e.target.value === INHERIT
                  ? undefined
                  : e.target.value === "on",
            })
          }
        >
          <option value={INHERIT}>{t("Наследовать")}</option>
          <option value="on">{t("Подключать")}</option>
          <option value="off">{t("Не подключать")}</option>
        </select>
      </div>
      <p className="pf-agents-hint">
        {t(
          "Действует для новых сессий. Claude Code и Codex соблюдают все группы, OpenCode — всё, кроме плагинов CLI, Cursor — только плагины BB.",
        )}
      </p>
      <div className="pf-agents-actions">
        <Button disabled={busy} onClick={() => void save()}>
          <Icon name={saved ? "CircleCheck" : "Settings"} />
          {saved ? t("Сохранено") : t("Сохранить")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

function GroupRow({
  group,
  scope,
  own,
  inherited,
  items,
  disabled,
  onChange,
}: {
  group: SessionPolicyGroup;
  scope: ExecutionScope;
  own: SessionFilter | undefined;
  inherited: ResolvedSessionPolicy[SessionPolicyGroup];
  items: { name: string; label: string }[];
  disabled: boolean;
  onChange: (value: SessionFilter | undefined) => void;
}) {
  const meta = groupMeta(group);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const names = own?.names ?? [];
  const listed = useMemo(() => {
    const known = new Map(items.map((i) => [i.name, i.label]));
    for (const name of names) if (!known.has(name)) known.set(name, name);
    const q = query.trim().toLowerCase();
    return [...known]
      .filter(([name, label]) =>
        q ? `${name} ${label}`.toLowerCase().includes(q) : true,
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }, [items, names, query]);
  const toggle = (name: string, on: boolean) =>
    onChange({
      mode: own!.mode,
      names: on ? [...names, name] : names.filter((n) => n !== name),
    });
  const addCustom = () => {
    const name = custom.trim();
    if (!name || !own || names.includes(name)) return;
    onChange({ mode: own.mode, names: [...names, name] });
    setCustom("");
  };
  return (
    <div className="pf-session-group">
      <div className="pf-exec-row">
        <div className="pf-exec-text pf-exec-text-switchless">
          <span>{meta.title}</span>
          <span className="pf-exec-from">
            {own
              ? meta.hint
              : `${modeLabel(inherited?.value)} · ${originLabel(inherited?.origin, scope)}`}
          </span>
        </div>
        <select
          className="pf-select"
          aria-label={meta.title}
          disabled={disabled}
          value={own?.mode ?? INHERIT}
          onChange={(e) => {
            const mode = e.target.value;
            onChange(
              mode === INHERIT
                ? undefined
                : {
                    mode: mode as SessionFilter["mode"],
                    names: mode === "all" ? [] : names,
                  },
            );
          }}
        >
          <option value={INHERIT}>{t("Наследовать")}</option>
          <option value="all">{t("Все")}</option>
          <option value="allow">{t("Только выбранные")}</option>
          <option value="deny">{t("Все, кроме выбранных")}</option>
        </select>
      </div>
      {own && own.mode !== "all" && (
        <div className="pf-session-pick">
          <Input
            value={query}
            placeholder={t("Поиск")}
            aria-label={t("Поиск")}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="pf-session-list" role="list">
            {listed.map(([name, label]) => (
              <li key={name}>
                <label>
                  <Checkbox
                    checked={names.includes(name)}
                    disabled={disabled}
                    onCheckedChange={(on) => toggle(name, on === true)}
                  />
                  <span>{label}</span>
                </label>
              </li>
            ))}
            {listed.length === 0 && (
              <li className="pf-agents-hint">{t("Ничего не найдено")}</li>
            )}
          </ul>
          <div className="pf-session-add">
            <Input
              value={custom}
              placeholder={t("Имя или шаблон с * на конце")}
              aria-label={t("Добавить имя")}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={disabled || !custom.trim()}
              onClick={addCustom}
            >
              {t("Добавить имя")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
