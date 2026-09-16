// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it } from "vitest";
import { fireEvent, waitFor, cleanup } from "@testing-library/react";
import { loadPluginApp, renderSlot } from "@get-bb/plugin-sdk/testing/app";
let app: Awaited<ReturnType<typeof loadPluginApp>>;
beforeAll(async () => {
  window.matchMedia = () =>
    ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }) as unknown as MediaQueryList;
  app = await loadPluginApp(() => import("./app"));
});
afterEach(cleanup);

const agentsConfig = () => ({
  autoCreate: true,
  customTarget: "file",
  startup: "",
  template: "",
  projectTemplate: "",
  custom: "",
});
const openRules = async (view: ReturnType<typeof renderSlot>) =>
  fireEvent.click(await view.findByRole("button", { name: "AGENTS.md rules" }));

it("exposes the shared settings with the AGENTS.md rules and managed markers", async () => {
  expect(app.settingsSections).toHaveLength(1);
  expect(app.settingsSections[0]!.id).toBe("settings");
  const view = renderSlot(
    app.settingsSections[0]!,
    {},
    {
      rpc: { agents_config: agentsConfig },
    },
  );
  expect(await view.findByRole("button", { name: "Chat list" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Appearance" })).toBeTruthy();
  expect(view.getByRole("button", { name: "Section archive" })).toBeTruthy();
  await openRules(view);
  expect(
    await view.findByText(/Projects get the project template/),
  ).toBeTruthy();
  expect(view.baseElement.textContent).toContain(
    "<!-- bb-project-folders:agents:start -->",
  );
  view.lifecycle.unmount();
});

it("applies the template through rpc and reports the outcome", async () => {
  let calls = 0;
  const view = renderSlot(
    app.settingsSections[0]!,
    {},
    {
      rpc: {
        agents_config: agentsConfig,
        agents_apply: () => {
          calls++;
          return { updated: 2, unchanged: 1, failed: 0, error: null };
        },
      },
    },
  );
  await openRules(view);
  fireEvent.click(
    await view.findByRole("button", { name: /Apply to existing sections/ }),
  );
  await waitFor(() =>
    expect(view.baseElement.textContent).toContain("Updated: 2"),
  );
  expect(view.baseElement.textContent).toContain("unchanged: 1");
  expect(calls).toBe(1);
  view.lifecycle.unmount();
});

it("shows rpc failures instead of a fake success", async () => {
  const view = renderSlot(
    app.settingsSections[0]!,
    {},
    {
      rpc: {
        agents_config: agentsConfig,
        agents_apply: () => {
          throw new Error("the device is offline");
        },
      },
    },
  );
  await openRules(view);
  fireEvent.click(
    await view.findByRole("button", { name: /Apply to existing sections/ }),
  );
  await waitFor(() =>
    expect(view.baseElement.textContent).toContain("the device is offline"),
  );
  expect(view.baseElement.textContent).not.toContain("Updated:");
  view.lifecycle.unmount();
});
