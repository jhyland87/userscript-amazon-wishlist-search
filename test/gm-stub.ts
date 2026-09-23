// Stand-in for `vite-plugin-monkey/dist/client` under Node (aliased in
// vitest.config.ts). The real module reads the userscript manager's globals at
// import time, which don't exist here.
//
// State lives on `globalThis` so every copy of this module shares it — tests
// call `vi.resetModules()`, which would otherwise give the code under test a
// different instance from the one the test file imported.

type ChangeListener = (
  name: string,
  oldValue?: unknown,
  newValue?: unknown,
  remote?: boolean,
) => void;

interface MenuCommand {
  caption: string;
  onClick: () => void;
}

interface GmFake {
  store: Map<string, unknown>;
  menu: Map<string | number, MenuCommand>;
  listeners: Map<string, ChangeListener[]>;
  unsafeWindow: Record<string, unknown>;
}

const holder = globalThis as typeof globalThis & { __gmFake?: GmFake };
holder.__gmFake ??= {
  store: new Map(),
  menu: new Map(),
  listeners: new Map(),
  unsafeWindow: {},
};
const fake = holder.__gmFake;

/** The in-memory GM value store. */
export const gmStore = fake.store;

/** Registered menu commands, keyed by id (or caption when no id is given). */
export const gmMenu = fake.menu;

/** Clear stored values, listeners and anything installed on `unsafeWindow`. */
export const resetGm = (): void => {
  fake.store.clear();
  fake.listeners.clear();
  fake.menu.clear();
  for (const key of Object.keys(fake.unsafeWindow)) delete fake.unsafeWindow[key];
};

/** Simulate another tab writing `key` (fires listeners with `remote: true`). */
export const emitRemoteChange = (key: string, value: unknown): void => {
  const old = fake.store.get(key);
  if (value === undefined) fake.store.delete(key);
  else fake.store.set(key, value);
  for (const listener of fake.listeners.get(key) ?? []) listener(key, old, value, true);
};

export const GM = {
  getValue: async (key: string, defaultValue?: unknown): Promise<unknown> =>
    fake.store.has(key) ? fake.store.get(key) : defaultValue,
  setValue: async (key: string, value: unknown): Promise<void> => {
    fake.store.set(key, value);
  },
  deleteValue: async (key: string): Promise<void> => {
    fake.store.delete(key);
  },
  listValues: async (): Promise<string[]> => Array.from(fake.store.keys()),
  addValueChangeListener: async (key: string, listener: ChangeListener): Promise<number> => {
    const list = fake.listeners.get(key) ?? [];
    list.push(listener);
    fake.listeners.set(key, list);
    return list.length;
  },
  addStyle: (css: string): unknown => ({ textContent: css }),
  // Like Tampermonkey: registering an existing id replaces that entry.
  registerMenuCommand: async (
    caption: string,
    onClick: () => void,
    options?: { id?: string | number },
  ): Promise<string | number> => {
    const id = options?.id ?? caption;
    fake.menu.set(id, { caption, onClick });
    return id;
  },
  unregisterMenuCommand: (id: string | number): void => {
    fake.menu.delete(id);
  },
};

/** Minimal `GM_addElement`: create, set attributes, append to the parent. */
export const GM_addElement = <K extends keyof HTMLElementTagNameMap>(
  parent: Node,
  tag: K,
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.appendChild(node);
  return node;
};

export const unsafeWindow = fake.unsafeWindow as unknown as Window;
