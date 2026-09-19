/** Shared jsdom matchMedia so compact-viewport tests can toggle without a stale cache. */
let compactViewport = false;

export function setCompactViewport(value: boolean): void {
  compactViewport = value;
}

export function installTestMatchMedia(): void {
  window.matchMedia = (query: string) =>
    ({
      get matches() {
        return compactViewport && String(query).includes("max-width: 767px");
      },
      media: String(query),
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }) as MediaQueryList;
}
