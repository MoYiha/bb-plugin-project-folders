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

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  integer = true,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  onCommit: (value: number) => void;
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        className="block w-full border rounded-md bg-background p-2 mt-1"
        type="number"
        min={min}
        max={max}
        step={step}
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
    </label>
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
      <div className="pf-chat-settings">
        <label className="block text-sm">
          {t("Сортировка чатов")}
          <select
            className="block w-full border rounded-md bg-background p-2 mt-1"
            value={settings.sort}
            onChange={(e) =>
              update({ sort: e.target.value as ChatList["sort"] })
            }
          >
            <option value="activity">{t("По активности")}</option>
            <option value="title">{t("По алфавиту")}</option>
            <option value="created">{t("Сначала новые")}</option>
          </select>
        </label>
        <NumberField
          label={t("Чатов в каждом разделе")}
          value={settings.limit}
          min={1}
          max={100}
          onCommit={(limit) => update({ limit })}
        />
        <NumberField
          label={t("Сворачивать разделы без активности, часов")}
          value={settings.inactiveHours}
          min={0.25}
          max={720}
          step={0.25}
          integer={false}
          onCommit={(inactiveHours) => update({ inactiveHours })}
        />
        <label className="block text-sm">
          {t("Плотность списка")}
          <select
            className="block w-full border rounded-md bg-background p-2 mt-1"
            value={prefs.view.density}
            onChange={(e) =>
              view({ density: e.target.value as Prefs["view"]["density"] })
            }
          >
            <option value="comfortable">{t("Обычная")}</option>
            <option value="compact">{t("Компактная")}</option>
          </select>
        </label>
        <NumberField
          label={t("Отступ вложенных разделов, px")}
          value={prefs.view.indent}
          min={0}
          max={32}
          onCommit={(indent) => view({ indent })}
        />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer mt-3">
        <input
          type="checkbox"
          className="rounded border"
          checked={settings.autoCollapseInactive}
          onChange={(e) => update({ autoCollapseInactive: e.target.checked })}
        />
        <span>{t("Сворачивать неактивные разделы автоматически")}</span>
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
        <input
          type="checkbox"
          className="rounded border"
          checked={settings.boldUnread}
          onChange={(e) => update({ boldUnread: e.target.checked })}
        />
        <span>{t("Выделять жирным разделы с непрочитанными чатами")}</span>
      </label>
      <p className="text-xs text-muted-foreground mt-2">
        {t(
          "Закреплённые чаты сверху. Настройки общие для всех устройств; сортировку и число чатов можно изменить для отдельного раздела в его «Оформлении».",
        )}
      </p>
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
