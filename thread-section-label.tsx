import { useCallback, useEffect, useRef, useState } from "react";
import {
  useRpc,
  useRealtime,
  type PluginThreadHeaderActionProps,
} from "@get-bb/plugin-sdk/app";
import type { rpcContract } from "./server";

type SectionLabel = {
  label: string;
  compactLabel: string;
  path: string;
  projectName: string;
};

function paintedText(section: SectionLabel, compact: boolean): string {
  return compact ? section.compactLabel : section.label;
}

// Per-pane ownership keeps split conversations independent. Only the existing
// project label is decorated; no extra control or workspace mutation is added.
export function ThreadSectionLabel({
  threadId,
}: PluginThreadHeaderActionProps) {
  const marker = useRef<HTMLSpanElement>(null);
  const rpc = useRpc<typeof rpcContract>();
  const [section, setSection] = useState<SectionLabel | null>(null);
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
    const chipOriginals = new Map<HTMLElement, string | null>();
    const paint = () => {
      for (const display of Array.from(
        pane.querySelectorAll<HTMLElement>("[data-option-display]"),
      )) {
        const full = display.querySelector<HTMLElement>(
          "[data-promptbox-full-label]",
        );
        if (
          !full ||
          (full.textContent !== section.projectName &&
            full.textContent !== section.label &&
            !originals.has(full))
        )
          continue;
        if (!chipOriginals.has(display))
          chipOriginals.set(
            display,
            display.getAttribute("data-pf-section-chip"),
          );
        display.setAttribute("data-pf-section-chip", "");
        display.title = section.label;
        for (const label of Array.from(
          display.querySelectorAll<HTMLElement>(
            "[data-promptbox-full-label], [data-promptbox-compact-label]",
          ),
        )) {
          const compact = label.hasAttribute("data-promptbox-compact-label");
          const next = paintedText(section, compact);
          if (!originals.has(label))
            originals.set(label, label.textContent ?? "");
          if (label.textContent !== next) label.textContent = next;
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
        const painted =
          label.textContent === section.label ||
          label.textContent === section.compactLabel;
        if (painted) label.textContent = original;
      }
      for (const [chip, original] of chipOriginals) {
        if (original === null) chip.removeAttribute("data-pf-section-chip");
        else chip.setAttribute("data-pf-section-chip", original);
        if (chip.title === section.label) chip.removeAttribute("title");
      }
    };
  }, [section]);
  return <span ref={marker} hidden aria-hidden="true" />;
}
