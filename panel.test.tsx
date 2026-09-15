// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
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

const root = {
  id: "p1",
  projectId: "p1",
  hostId: "h1",
  parentId: null,
  path: "/work",
  name: "Project",
};
const section = { ...root, id: "f1", path: "/work/Section", name: "Section" };
const rpc = {
  list: () => ({
    folders: [section],
    roots: [root],
    bindings: {},
    errors: [],
    machines: [{ id: "h1", name: "Mac Mini", connected: true }],
  }),
  archive_list: () => ({ archives: [] }),
};

it("renders the management page as a sidebar tree with a settings pane", async () => {
  const view = renderSlot(app.navPanels[0]!, { subPath: "" }, { rpc });
  await view.findByText("Project");
  expect(view.baseElement.querySelector(".pf-layout")).toBeTruthy();
  expect(view.baseElement.querySelector(".pf-side .pf-side-row")).toBeTruthy();
  expect(view.baseElement.textContent).toContain("Settings");
  view.lifecycle.unmount();
});

it("shows the selected section details with allowed actions", async () => {
  const view = renderSlot(app.navPanels[0]!, { subPath: "" }, { rpc });
  await view.findByText("Project");
  view.getByText("Section").click();
  await view.findByText("/work/Section");
  expect(view.baseElement.textContent).toContain("New section");
  expect(view.baseElement.textContent).toContain("Rules");
  expect(view.baseElement.textContent).toContain("Archive");
  view.lifecycle.unmount();
});

it("shows one project entry even when the project has copies on several devices", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const copySection = {
    ...copy,
    id: "f2",
    path: "/srv/project/Server",
    name: "Server",
  };
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [section, copySection],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: [
            { id: "h1", name: "Mac Mini", connected: true },
            { id: "h2", name: "OVH", connected: true },
          ],
        }),
      },
    },
  );
  await view.findAllByText("Project");
  expect(
    view.baseElement.querySelectorAll(".pf-side .pf-side-project"),
  ).toHaveLength(1);
  // Sections of every device stay visible under the single project entry.
  expect(view.baseElement.textContent).toContain("Section");
  expect(view.baseElement.textContent).toContain("Server");
  view.lifecycle.unmount();
});

it("opens the working copies dialog from the root details", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: [
            { id: "h1", name: "Mac Mini", connected: true },
            { id: "h2", name: "OVH", connected: true },
          ],
        }),
        machines: () => ({
          machines: [
            { id: "h1", name: "Mac Mini", connected: true },
            { id: "h2", name: "OVH", connected: true },
          ],
        }),
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  const copiesButton = await view.findByRole("button", {
    name: /Working copies/,
  });
  copiesButton.click();
  await view.findByText(/Each device can hold its own working copy/);
  expect(view.baseElement.textContent).toContain("Mac Mini");
  expect(view.getByDisplayValue("/srv/project")).toBeTruthy();
  view.lifecycle.unmount();
});
it("switches device tabs on the project card and edits that copy's AGENTS.md", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const machinesList = [
    { id: "h1", name: "Mac Mini", connected: true },
    { id: "h2", name: "OVH", connected: true },
  ];
  const reads: { hostId?: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: machinesList,
        }),
        machines: () => ({ machines: machinesList }),
        rules_read: (input: { hostId?: string }) => {
          reads.push(input);
          return Promise.resolve({
            content: `rules for ${input.hostId ?? "default"}`,
            claude: `claude for ${input.hostId ?? "default"}`,
            sha: null,
            path: "/AGENTS.md",
            mode: "manual",
            template: "",
            projectTemplate: "",
            custom: "",
            customTarget: "session" as const,
            startup: "",
            suggestedSection: "",
            suggestedProject: "",
          });
        },
        rules_save: () => Promise.resolve({ ok: true as const }),
        rules_settings_save: () => Promise.resolve({ ok: true as const }),
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  const tabs = await view.findAllByRole("tab", { name: /Mac Mini|OVH/ });
  expect(tabs).toHaveLength(2);
  const editor = await view.findByRole("textbox", {
    name: /AGENTS.md contents/,
  });
  expect((editor as HTMLTextAreaElement).value).toBe("rules for h1");
  expect(view.baseElement.textContent).toContain("claude for h1");
  tabs[1].click();
  await view.findByRole("textbox", { name: /AGENTS.md contents — OVH/ });
  expect(
    (
      view.getByRole("textbox", {
        name: /AGENTS.md contents — OVH/,
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("rules for h2");
  expect(
    (
      view.getByRole("textbox", {
        name: /CLAUDE.md — OVH/,
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("claude for h2");
  expect(reads.at(-1)).toMatchObject({ hostId: "h2" });
  view.lifecycle.unmount();
});

it("switches device tabs on the project card and previews that copy's rules", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const machinesList = [
    { id: "h1", name: "Mac Mini", connected: true },
    { id: "h2", name: "OVH", connected: true },
  ];
  const reads: { hostId?: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: machinesList,
        }),
        machines: () => ({ machines: machinesList }),
        rules_read: (input: { hostId?: string }) => {
          reads.push(input);
          return Promise.resolve({
            content: `rules for ${input.hostId ?? "default"}`,
            sha: null,
            path: "/AGENTS.md",
            mode: "manual",
            template: "",
            projectTemplate: "",
            custom: "",
            customTarget: "session" as const,
            startup: "",
            suggestedSection: "",
            suggestedProject: "",
          });
        },
        rules_settings_save: () => Promise.resolve({ ok: true as const }),
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  const tabs = await view.findAllByRole("tab", { name: /Mac Mini|OVH/ });
  expect(tabs).toHaveLength(2);
  expect(
    (
      view.getByRole("textbox", {
        name: /AGENTS.md contents/,
      }) as HTMLTextAreaElement
    ).value,
  ).toBe("rules for h1");
  tabs[1].click();
  await view.findByDisplayValue("rules for h2");
  expect(reads.at(-1)).toMatchObject({ hostId: "h2" });
  view.lifecycle.unmount();
});

it("switches the project between inherited and custom rules with the mode tabs", async () => {
  const saves: { mode?: string; projectTemplate?: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        rules_read: () =>
          Promise.resolve({
            content: "file rules",
            claude: null,
            sha: null,
            path: "/work/AGENTS.md",
            mode: "manual",
            template: "",
            projectTemplate: "",
            custom: "",
            customTarget: "session" as const,
            startup: "",
            suggestedSection: "section template",
            suggestedProject: "project template",
          }),
        rules_settings_save: (input: { mode?: string }) => {
          saves.push(input);
          return Promise.resolve({ ok: true as const });
        },
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  // A file without the plugin markers opens on its own tab, not on a template.
  await view.findByRole("textbox", { name: /AGENTS.md contents/ });
  expect(view.baseElement.textContent).not.toContain("Section template");
  const custom = await view.findByRole("tab", { name: "Custom template" });
  custom.click();
  // The open tab is the mode: its fields are prefilled from the inherited block.
  expect(
    ((await view.findByDisplayValue("project template")) as HTMLTextAreaElement)
      .tagName,
  ).toBe("TEXTAREA");
  expect(view.getByDisplayValue("section template")).toBeTruthy();
  expect(view.queryByRole("textbox", { name: /AGENTS.md contents/ })).toBe(
    null,
  );
  view.getByRole("button", { name: /Save/ }).click();
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0]).toMatchObject({
    mode: "custom",
    projectTemplate: "project template",
  });
  // Three modes, and the file tab brings the editors back.
  expect(view.getAllByRole("tab").map((b) => b.textContent)).toEqual([
    "Default",
    "Custom template",
    "Own file",
  ]);
  view.getByRole("tab", { name: "Own file" }).click();
  await view.findByRole("textbox", { name: /AGENTS.md contents/ });
  view.lifecycle.unmount();
});

it("offers a tab for a machine that has no copy of the project yet", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const machinesList = [
    { id: "h1", name: "Mac Mini", connected: true },
    { id: "h2", name: "OVH", connected: true },
    { id: "h3", name: "MacBook", connected: true },
  ];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: machinesList,
        }),
        machines: () => ({ machines: machinesList }),
        rules_read: () =>
          Promise.resolve({
            content: "file rules",
            claude: null,
            sha: null,
            path: "/work/AGENTS.md",
            mode: "manual",
            template: "",
            projectTemplate: "",
            custom: "",
            customTarget: "session" as const,
            startup: "",
            suggestedSection: "",
            suggestedProject: "",
          }),
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  const tabs = await view.findAllByRole("tab", {
    name: /Mac Mini|OVH|MacBook/,
  });
  expect(tabs.map((b) => b.textContent)).toEqual([
    "Mac Mini",
    "OVH",
    "MacBook",
  ]);
  // The machine without a copy explains itself and offers to add one.
  view.getByRole("tab", { name: "MacBook" }).click();
  // Said once, next to the device tabs, and not repeated in the rules block.
  expect(
    await view.findAllByText("The project has no copy on this device"),
  ).toHaveLength(1);
  expect(view.getByRole("button", { name: /Add copy/ })).toBeTruthy();
  view.lifecycle.unmount();
});

it("hands a copy to the folder picker and moves the files there", async () => {
  const copy = { ...root, hostId: "h2", path: "/srv/project" };
  const machinesList = [
    { id: "h1", name: "Mac Mini", connected: true },
    { id: "h2", name: "OVH", connected: true },
  ];
  const browsed: { hostId: string; path?: string }[] = [];
  const moves: { hostId: string; destination: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        list: () => ({
          folders: [],
          roots: [root, copy],
          bindings: {},
          errors: [],
          machines: machinesList,
        }),
        machines: () => ({ machines: machinesList }),
        project_browse: (input: { hostId: string; path?: string }) => {
          browsed.push(input);
          return Promise.resolve({
            path: "/Users/kirill/Projects",
            parent: "/Users/kirill",
            directories: [
              { name: "other", path: "/Users/kirill/Projects/other" },
            ],
          });
        },
        project_move: (input: { hostId: string; destination: string }) => {
          moves.push(input);
          return Promise.resolve({
            destination: input.destination,
            complete: true,
          });
        },
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  (await view.findByRole("button", { name: /Working copies/ })).click();
  // Each copy shows its path read-only; the folder button opens the picker.
  const pickers = await view.findAllByRole("button", { name: /Choose folder/ });
  expect(view.getByDisplayValue("/srv/project")).toBeTruthy();
  pickers[0].click();
  const browseButton = await view.findByRole("button", {
    name: /Choose folder/,
  });
  browseButton.click();
  await waitFor(() => expect(browsed.at(-1)).toMatchObject({ hostId: "h1" }));
  (await view.findByRole("button", { name: "Choose folder" })).click();
  // The project folder keeps its name inside the chosen parent.
  await view.findByDisplayValue("/Users/kirill/Projects/work");
  (await view.findByRole("button", { name: /^Move$/ })).click();
  await waitFor(() => expect(moves).toHaveLength(1));
  expect(moves[0]).toMatchObject({
    hostId: "h1",
    destination: "/Users/kirill/Projects/work",
  });
  view.lifecycle.unmount();
});

it("adopts an existing folder instead of moving the files", async () => {
  const edits: { hostId: string; path: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        project_browse: () =>
          Promise.resolve({
            path: "/Users/kirill/Clients",
            parent: "/Users/kirill",
            // The project folder is already sitting in the chosen parent.
            directories: [{ name: "work", path: "/Users/kirill/Clients/work" }],
          }),
        copy_edit: (input: { hostId: string; path: string }) => {
          edits.push(input);
          return Promise.resolve({ ok: true as const });
        },
      },
    },
  );
  await view.findAllByText("Project");
  view.getAllByText("Project")[0].click();
  (await view.findByRole("button", { name: /Choose folder/ })).click();
  await view.findByText("Move project");
  (await view.findByRole("button", { name: /Choose folder/ })).click();
  await view.findByText("/Users/kirill/Clients");
  (await view.findByRole("button", { name: "Choose folder" })).click();
  await view.findByText(/A folder with this name already exists/);
  (await view.findByRole("button", { name: /Use this folder/ })).click();
  await waitFor(() => expect(edits).toHaveLength(1));
  expect(edits[0]).toMatchObject({ path: "/Users/kirill/Clients/work" });
  view.lifecycle.unmount();
});

it("saves custom rules for BB sessions and a startup instruction", async () => {
  const saves: { customTarget?: string; startup?: string }[] = [];
  const view = renderSlot(
    app.navPanels[0]!,
    { subPath: "" },
    {
      rpc: {
        ...rpc,
        rules_read: () =>
          Promise.resolve({
            content: "",
            claude: null,
            sha: null,
            path: "/work/Section/AGENTS.md",
            mode: "inherit" as const,
            template: "",
            projectTemplate: "",
            custom: "",
            customTarget: "session" as const,
            startup: "",
            suggestedSection: "",
            suggestedProject: "",
          }),
        rules_settings_save: (input: { customTarget?: string }) => {
          saves.push(input);
          return Promise.resolve({ ok: true as const });
        },
      },
    },
  );
  await view.findByText("Project");
  view.getByText("Section").click();
  const rules = await view.findByRole("textbox", { name: /Custom rules/ });
  const startup = view.getByRole("textbox", { name: /Startup instruction/ });
  // Both fields sit outside the mode tabs and explain themselves.
  expect(
    view.getAllByRole("button", { name: /Standing rules for this place/ }),
  ).not.toHaveLength(0);
  fireEvent.change(rules, { target: { value: "Ads go to the agency" } });
  fireEvent.change(startup, { target: { value: "Run the tasks skill" } });
  view.getByRole("button", { name: /^Save$/ }).click();
  await waitFor(() => expect(saves).toHaveLength(1));
  expect(saves[0]).toMatchObject({
    customTarget: "session",
    startup: "Run the tasks skill",
    custom: "Ads go to the agency",
  });
  view.lifecycle.unmount();
});
