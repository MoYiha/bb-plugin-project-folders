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
import { useSyncExternalStore } from "react";
import { t } from "./i18n";
import { parseSettings, type ChatListSettings } from "./chat-list";
const key = "project-folders:chat-list";
function read() {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(key, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(key, listener);
  };
}
export function useChatSettings() {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  return [
    parseSettings(raw),
    (patch: Partial<ChatListSettings>) => {
      localStorage.setItem(
        key,
        JSON.stringify({ ...parseSettings(read()), ...patch }),
      );
      window.dispatchEvent(new Event(key));
    },
  ] as const;
}
export function ChatSettings() {
  const [settings, update] = useChatSettings();
  return (
    <div className="pf-chat-settings">
      <label className="block text-sm">
        {t("Сортировка чатов")}
        <select
          className="block w-full border rounded-md bg-background p-2 mt-1"
          value={settings.sort}
          onChange={(e) =>
            update({ sort: e.target.value as ChatListSettings["sort"] })
          }
        >
          <option value="activity">{t("По активности")}</option>
          <option value="title">{t("По алфавиту")}</option>
          <option value="created">{t("Сначала новые")}</option>
        </select>
      </label>
      <label className="block text-sm">
        {t("Чатов в каждом разделе")}
        <input
          className="block w-full border rounded-md bg-background p-2 mt-1"
          type="number"
          min={1}
          max={100}
          defaultValue={settings.limit}
          key={settings.limit}
          onBlur={(e) => {
            const limit = Number(e.target.value);
            if (Number.isInteger(limit) && limit >= 1 && limit <= 100)
              update({ limit });
            else e.target.value = String(settings.limit);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
      </label>
      <label className="flex items-center gap-2 text-sm cursor-pointer mt-2">
        <input
          type="checkbox"
          className="rounded border"
          checked={settings.autoCollapseInactive}
          onChange={(e) => update({ autoCollapseInactive: e.target.checked })}
        />
        <span>{t("Сворачивать разделы без активности больше 2 часов")}</span>
      </label>
      <p className="text-xs text-muted-foreground">
        {t("Закреплённые чаты сверху. Настройки сохраняются в этом браузере.")}
      </p>
    </div>
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
          onValueChange={(sort) =>
            update({ sort: sort as ChatListSettings["sort"] })
          }
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
          {t("Сворачивать неактивные (> 2 часов)")}
        </DropdownMenuCheckboxItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
