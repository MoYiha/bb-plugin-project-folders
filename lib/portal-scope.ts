declare const __BB_PLUGIN_ID__: string | undefined;

export function usePortalScopeProps(): {
  "data-bb-portaled-overlay": "";
  "data-bb-plugin-root"?: "";
  "data-bb-plugin"?: string;
  "data-bb-ru-skip": "";
} {
  const pluginId =
    typeof __BB_PLUGIN_ID__ === "string" ? __BB_PLUGIN_ID__ : undefined;
  return {
    "data-bb-portaled-overlay": "",
    "data-bb-plugin-root": "",
    // The plugin localizes itself; BB-wide DOM translators must leave it alone.
    "data-bb-ru-skip": "",
    ...(pluginId !== undefined ? { "data-bb-plugin": pluginId } : {}),
  };
}
