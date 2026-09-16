import {
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "./components/ui/dropdown-menu";
import { Icon } from "./components/ui/icon";
import { t } from "./i18n";
import { usePrefs } from "./prefs-store";
import type { Prefs } from "./preferences";
import { SettingRow, SettingsGroup, Switch } from "./settings-ui";

type ChatList = Prefs["chatList"];
/** Chat list settings, shared by every device through the plugin server. */
export function useChatSettings() {
  const { prefs, savePrefs } = usePrefs();
  return [
    prefs.chatList,
    (patch: Partial<ChatList>) =>
      void savePrefs({
        ...prefs,
        chatList: { ...prefs.chatList, ...patch },
      }).catch(() => undefined),
  ] as const;
}

function NumberInput({
  id,
  value,
  min,
  max,
  step = 1,
  integer = true,
  disabled,
  onCommit,
}: {
  id: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <input
      id={id}
      className="pf-sinput pf-sinput-number"
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      defaultValue={value}
      key={value}
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (
          Number.isFinite(next) &&
          (!integer || Number.isInteger(next)) &&
          next >= min &&
          next <= max
        ) {
          if (next !== value) onCommit(next);
        } else e.target.value = String(value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function ChatSettings() {
  const { prefs, savePrefs } = usePrefs();
  const settings = prefs.chatList;
  const update = (patch: Partial<ChatList>) =>
    void savePrefs({ ...prefs, chatList: { ...settings, ...patch } }).catch(
      () => undefined,
    );
  const view = (patch: Partial<Prefs["view"]>) =>
    void savePrefs({ ...prefs, view: { ...prefs.view, ...patch } }).catch(
      () => undefined,
    );
  return (
    <>
      <SettingsGroup
        title={t("Порядок чатов")}
        hint={t(
          "Закреплённые чаты всегда сверху. Для отдельного раздела порядок и число чатов меняются в его «Оформлении».",
        )}
      >
        <SettingRow label={t("Сортировка чатов")} htmlFor="pf-set-sort">
          <select
            id="pf-set-sort"
            className="pf-sinput"
            value={settings.sort}
            onChange={(e) =>
              update({ sort: e.target.value as ChatList["sort"] })
            }
          >
            <option value="activity">{t("По активности")}</option>
            <option value="title">{t("По алфавиту")}</option>
            <option value="created">{t("Сначала новые")}</option>
          </select>
        </SettingRow>
        <SettingRow
          label={t("Чатов в каждом разделе")}
          hint={t("Остальные открываются кнопкой «Показать все».")}
          htmlFor="pf-set-limit"
        >
          <NumberInput
            id="pf-set-limit"
            value={settings.limit}
            min={1}
            max={100}
            onCommit={(limit) => update({ limit })}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup title={t("Сворачивание разделов")}>
        <SettingRow
          label={t("Сворачивать неактивные разделы автоматически")}
          hint={t(
            "Раздел открыт, пока в нём работает агент или открыт чат. Свёрнутый вручную раздел остаётся свёрнутым.",
          )}
          htmlFor="pf-set-collapse"
        >
          <Switch
            id="pf-set-collapse"
            label={t("Сворачивать неактивные разделы автоматически")}
            checked={settings.autoCollapseInactive}
            onChange={(autoCollapseInactive) =>
              update({ autoCollapseInactive })
            }
          />
        </SettingRow>
        <SettingRow
          label={t("Сворачивать разделы без активности, часов")}
          htmlFor="pf-set-hours"
          disabled={!settings.autoCollapseInactive}
        >
          <NumberInput
            id="pf-set-hours"
            value={settings.inactiveHours}
            min={0.25}
            max={720}
            step={0.25}
            integer={false}
            disabled={!settings.autoCollapseInactive}
            onCommit={(inactiveHours) => update({ inactiveHours })}
          />
        </SettingRow>
      </SettingsGroup>
      <SettingsGroup
        title={t("Вид дерева")}
        hint={t("Настройки общие для всех устройств.")}
      >
        <SettingRow label={t("Плотность списка")} htmlFor="pf-set-density">
          <select
            id="pf-set-density"
            className="pf-sinput"
            value={prefs.view.density}
            onChange={(e) =>
              view({ density: e.target.value as Prefs["view"]["density"] })
            }
          >
            <option value="comfortable">{t("Обычная")}</option>
            <option value="compact">{t("Компактная")}</option>
          </select>
        </SettingRow>
        <SettingRow
          label={t("Отступ вложенных разделов, px")}
          htmlFor="pf-set-indent"
        >
          <NumberInput
            id="pf-set-indent"
            value={prefs.view.indent}
            min={0}
            max={32}
            onCommit={(indent) => view({ indent })}
          />
        </SettingRow>
        <SettingRow
          label={t("Выделять жирным разделы с непрочитанными чатами")}
          htmlFor="pf-set-bold"
        >
          <Switch
            id="pf-set-bold"
            label={t("Выделять жирным разделы с непрочитанными чатами")}
            checked={settings.boldUnread}
            onChange={(boldUnread) => update({ boldUnread })}
          />
        </SettingRow>
      </SettingsGroup>
    </>
  );
}

export function ChatSortMenu() {
  const [settings, update] = useChatSettings();
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <Icon name="Settings" />
        {t("Сортировка чатов")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={settings.sort}
          onValueChange={(sort) => update({ sort: sort as ChatList["sort"] })}
        >
          <DropdownMenuRadioItem value="activity">
            {t("По активности")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="title">
            {t("По алфавиту")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="created">
            {t("Сначала новые")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={settings.autoCollapseInactive}
          onCheckedChange={(checked) =>
            update({ autoCollapseInactive: Boolean(checked) })
          }
        >
          {t("Сворачивать неактивные разделы автоматически")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
