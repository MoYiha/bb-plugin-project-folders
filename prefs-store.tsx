import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRealtime, useRpc } from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";
import {
  defaultPrefs,
  isEmptyItem,
  parseItemStyles,
  parsePrefs,
  type ItemStyle,
  type ItemStyles,
  type Prefs,
} from "./preferences";
import { parseSettings } from "./chat-list";

type Rpc = ReturnType<typeof useRpc<typeof rpcContract>>;
type State = { prefs: Prefs; items: ItemStyles; loaded: boolean };
/** One copy per page: the sidebar tree, the panel and the settings page share it. */
let state: State = { prefs: defaultPrefs, items: {}, loaded: false };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const set = (next: State) => {
  state = next;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Chat list settings used to live in this browser only (before 0.4.0). */
const legacyKey = "project-folders:chat-list";

function load(rpc: Rpc) {
  loading = rpc
    .call("prefs_get", null)
    .then(
      async (r) => {
        let prefs = parsePrefs(r.prefs);
        const items = parseItemStyles(r.items);
        let legacy: string | null = null;
        try {
          legacy = localStorage.getItem(legacyKey);
        } catch {}
        if (!r.stored && legacy) {
          const old = parseSettings(legacy);
          prefs = { ...prefs, chatList: { ...prefs.chatList, ...old } };
          await rpc.call("prefs_save", { prefs }).catch(() => undefined);
        }
        set({ prefs, items, loaded: true });
      },
      () => set({ ...state, loaded: true }),
    )
    .finally(() => {
      loading = null;
    });
  return loading;
}

export function usePrefs() {
  const rpc = useRpc<typeof rpcContract>();
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  useEffect(() => {
    if (!state.loaded && !loading) void load(rpc);
  }, [rpc]);
  useRealtime("prefs", () => void load(rpc));
  const savePrefs = useCallback(
    async (next: Prefs, items?: ItemStyles) => {
      const previous = state;
      set({ ...state, prefs: next, items: items ?? state.items });
      try {
        await rpc.call(
          "prefs_save",
          items ? { prefs: next, items } : { prefs: next },
        );
      } catch (e) {
        set(previous);
        throw e;
      }
    },
    [rpc],
  );
  const saveItem = useCallback(
    async (key: string, style: ItemStyle | null) => {
      const previous = state;
      const items = { ...state.items };
      if (style && !isEmptyItem(style)) items[key] = style;
      else delete items[key];
      set({ ...state, items });
      try {
        await rpc.call("item_style_save", {
          key,
          style: style && !isEmptyItem(style) ? style : null,
        });
      } catch (e) {
        set(previous);
        throw e;
      }
    },
    [rpc],
  );
  return { ...snap, savePrefs, saveItem };
}
