import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRpc,
  useRealtime,
  type PluginThreadHeaderActionProps,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";

// Per-pane ownership keeps split conversations independent. Only the existing
// project label is decorated; no extra control or workspace mutation is added.
export function ThreadSectionLabel({
  threadId,
}: PluginThreadHeaderActionProps) {
  const marker = useRef<HTMLSpanElement>(null);
  const rpc = useRpc<typeof rpcContract>();
  const [section, setSection] = useState<{
    label: string;
    path: string;
    projectName: string;
  } | null>(null);
  const requestVersion = useRef(0);
  const refresh = useCallback(() => {
    const version = ++requestVersion.current;
    rpc.call("thread_section", { threadId }).then(
      (value) => {
        if (version === requestVersion.current) setSection(value);
      },
      () => {
        if (version === requestVersion.current) setSection(null);
      },
    );
    return () => {
      ++requestVersion.current;
    };
  }, [rpc, threadId]);
  useEffect(refresh, [refresh]);
  useRealtime("changed", refresh);
  useEffect(() => {
    if (!section) return;
    const pane = marker.current?.closest<HTMLElement>(
      "[data-conversation-collapsed], [data-split-pane-id]",
    );
    if (!pane) return;
    const originals = new Map<HTMLElement, string>();
    const paint = () => {
      for (const display of Array.from(
        pane.querySelectorAll<HTMLElement>("[data-option-display]"),
      )) {
        const full = display.querySelector<HTMLElement>(
          "[data-promptbox-full-label]",
        );
        if (
          !full ||
          (full.textContent !== section.projectName && !originals.has(full))
        )
          continue;
        for (const label of Array.from(
          display.querySelectorAll<HTMLElement>(
            "[data-promptbox-full-label], [data-promptbox-compact-label]",
          ),
        )) {
          if (!originals.has(label))
            originals.set(label, label.textContent ?? "");
          if (label.textContent !== section.label)
            label.textContent = section.label;
        }
      }
    };
    paint();
    const observer = new MutationObserver(paint);
    observer.observe(pane, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      observer.disconnect();
      for (const [label, original] of originals) {
        if (label.textContent === section.label) label.textContent = original;
      }
    };
  }, [section]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
