import { useState } from "react";
import { t } from "./i18n";
import { ChatSettings } from "./chat-settings";
import { AppearanceSettings, TransferSettings } from "./appearance";
import { AgentsMarkersHint, AgentsRulesEditor } from "./agents-apply";

const TABS = ["list", "appearance", "rules", "transfer"] as const;
type Tab = (typeof TABS)[number];
/**
 * The one settings screen of the plugin: rendered both on the management
 * page and on the plugin page of BB settings, so the two never drift apart.
 */
export function PluginSettings({ idPrefix }: { idPrefix: string }) {
  const [tab, setTab] = useState<Tab>("list");
  const label: Record<Tab, string> = {
    list: t("Список чатов"),
    appearance: t("Оформление"),
    rules: t("Правила AGENTS.md"),
    transfer: t("Импорт и экспорт"),
  };
  return (
    <div className="pf-settings">
      <div className="pf-tabs" role="tablist" aria-label={t("Общие настройки")}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`${idPrefix}-panel`}
            className={"pf-tab" + (tab === id ? " pf-selected" : "")}
            onClick={() => setTab(id)}
          >
            {label[id]}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${idPrefix}-panel`}
        aria-labelledby={`${idPrefix}-tab-${tab}`}
        className="pf-settings-panel"
      >
        {tab === "list" && <ChatSettings />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "rules" && (
          <div className="pf-agents-rule pf-agents-rule-flat">
            <p className="pf-agents-hint">
              {t(
                "Разделы первого и второго уровня могут иметь свой шаблон — он задаётся в их диалоге «Правила». Разделы третьего уровня правил не получают.",
              )}
            </p>
            <AgentsMarkersHint />
            <AgentsRulesEditor />
          </div>
        )}
        {tab === "transfer" && <TransferSettings />}
      </div>
    </div>
  );
}
