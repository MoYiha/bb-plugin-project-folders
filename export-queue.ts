export function makeExportQueue(options: {
  run: (id: string) => Promise<void>;
  settled: (id: string) => void;
  failed: (id: string, error: unknown) => void;
  delayMs?: number;
  cooldownMs?: number;
}) {
  const pending = new Map<string, number>();
  const recent = new Map<string, number>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  let stopped = false;
  const delay = options.delayMs ?? 2_000;
  const cooldown = options.cooldownMs ?? 30_000;

  function arm() {
    if (stopped || active || !pending.size) return;
    if (timer) clearTimeout(timer);
    const due = Math.min(...pending.values());
    timer = setTimeout(
      () => {
        timer = undefined;
        const entry = [...pending].find(([, at]) => at <= Date.now());
        if (!entry) return arm();
        const [id] = entry;
        pending.delete(id);
        active = Promise.resolve()
          .then(() => options.run(id))
          .then(() => {
            if (!pending.has(id)) options.settled(id);
          })
          .catch((error) => {
            options.failed(id, error);
            pending.set(id, Date.now() + Math.max(cooldown, 60_000));
          })
          .finally(() => {
            const next = Date.now() + cooldown;
            recent.set(id, next);
            for (const [key, at] of recent)
              if (at < Date.now()) recent.delete(key);
            if (pending.has(id))
              pending.set(id, Math.max(pending.get(id)!, next));
            active = undefined;
            arm();
          });
      },
      Math.max(0, due - Date.now()),
    );
    timer.unref?.();
  }

  return {
    enqueue(id: string) {
      if (stopped || pending.has(id)) return;
      pending.set(id, Math.max(Date.now() + delay, recent.get(id) ?? 0));
      arm();
    },
    async stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      await active;
    },
  };
}
