// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it } from "vitest";
import { cleanup, waitFor } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
import { installTestMatchMedia } from "./test-match-media";

let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  installTestMatchMedia();
  app = await loadPluginApp(() => import("./app"));
});
afterEach(() => {
  document.body.removeAttribute("data-split-pane-id");
  cleanup();
});

it("paints the full section path on the wide label and the folder name on the compact one", async () => {
  document.body.setAttribute("data-split-pane-id", "pane");
  const chip = document.createElement("div");
  chip.setAttribute("data-option-display", "");
  chip.innerHTML =
    '<span data-promptbox-full-label="">Launch</span><span data-promptbox-compact-label="">Launch</span>';
  document.body.prepend(chip);
  const view = renderSlot(
    app.threadHeaderActions[0]!,
    { threadId: "t1", projectId: "p1", isCompactViewport: true },
    {
      rpc: {
        thread_section: () => ({
          section: {
            label: "Launch / Website / Design",
            compactLabel: "Design",
            path: "/work/Website/Design",
            projectName: "Launch",
          },
          pending: false,
        }),
      },
    },
  );
  await waitFor(() => {
    expect(chip.querySelector("[data-promptbox-full-label]")?.textContent).toBe(
      "Launch / Website / Design",
    );
    expect(
      chip.querySelector("[data-promptbox-compact-label]")?.textContent,
    ).toBe("Design");
    expect(chip.getAttribute("data-pf-section-chip")).toBe("");
  });
  view.lifecycle.unmount();
  chip.remove();
});

it("keeps asking while the chat has no workspace yet, then paints", async () => {
  // A chat handed off to a new thread is created before its environment.
  document.body.setAttribute("data-split-pane-id", "pane");
  const chip = document.createElement("div");
  chip.setAttribute("data-option-display", "");
  chip.innerHTML =
    '<span data-promptbox-full-label="">Launch</span><span data-promptbox-compact-label="">Launch</span>';
  document.body.prepend(chip);
  let answered = 0;
  const view = renderSlot(
    app.threadHeaderActions[0]!,
    { threadId: "t1", projectId: "p1", isCompactViewport: false },
    {
      rpc: {
        thread_section: () => {
          answered += 1;
          return answered < 2
            ? { section: null, pending: true }
            : {
                section: {
                  label: "Launch / Website",
                  compactLabel: "Website",
                  path: "/work/Website",
                  projectName: "Launch",
                },
                pending: false,
              };
        },
      },
    },
  );
  await waitFor(
    () =>
      expect(
        chip.querySelector("[data-promptbox-full-label]")?.textContent,
      ).toBe("Launch / Website"),
    { timeout: 4000 },
  );
  view.lifecycle.unmount();
  chip.remove();
});
