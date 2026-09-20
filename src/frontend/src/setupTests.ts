import '@testing-library/jest-dom';

// Node 26 exposes a global `localStorage` accessor that is undefined unless
// the process was started with --localstorage-file, and it shadows the one
// jsdom installs. Anything under test that reads or writes storage then
// throws "Cannot read properties of undefined", which is a property of the
// Node version rather than of the code.
//
// Install an in-memory Storage when the environment has not provided a
// working one. The methods go on `Storage.prototype` (jsdom's class, when it
// is present) rather than on the instance, so tests that simulate a refusing
// store with `vi.spyOn(Storage.prototype, 'setItem')` still intercept the
// call — an own method on the instance would shadow the spy.
const backing = new WeakMap<object, Map<string, string>>();

const storeFor = (instance: object): Map<string, string> => {
  let store = backing.get(instance);
  if (!store) {
    store = new Map<string, string>();
    backing.set(instance, store);
  }
  return store;
};

const createMemoryStorage = (): Storage => {
  const StorageCtor = (globalThis as { Storage?: { prototype: Storage } }).Storage;
  const proto: object = StorageCtor ? StorageCtor.prototype : Object.prototype;
  const instance = Object.create(proto) as Storage;

  const methods: Record<string, (this: object, ...args: never[]) => unknown> = {
    getItem(this: object, name: string) {
      const store = storeFor(this);
      return store.has(String(name)) ? store.get(String(name))! : null;
    },
    setItem(this: object, name: string, value: string) {
      storeFor(this).set(String(name), String(value));
    },
    removeItem(this: object, name: string) {
      storeFor(this).delete(String(name));
    },
    clear(this: object) {
      storeFor(this).clear();
    },
    key(this: object, index: number) {
      return [...storeFor(this).keys()][index] ?? null;
    },
  } as unknown as Record<string, (this: object, ...args: never[]) => unknown>;

  const target = StorageCtor ? proto : instance;
  Object.entries(methods).forEach(([name, fn]) => {
    Object.defineProperty(target, name, { configurable: true, writable: true, value: fn });
  });
  Object.defineProperty(StorageCtor ? proto : instance, 'length', {
    configurable: true,
    get(this: object) {
      return storeFor(this).size;
    },
  });

  return instance;
};

const installStorage = (key: 'localStorage' | 'sessionStorage') => {
  let existing: Storage | undefined;
  try {
    existing = (globalThis as Record<string, unknown>)[key] as Storage | undefined;
  } catch {
    existing = undefined;
  }
  if (existing && typeof existing.setItem === 'function') return;

  const memoryStorage = createMemoryStorage();
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: memoryStorage,
  });
  if (typeof window !== 'undefined' && window !== (globalThis as unknown as Window)) {
    Object.defineProperty(window, key, {
      configurable: true,
      writable: true,
      value: memoryStorage,
    });
  }
};

installStorage('localStorage');
installStorage('sessionStorage');
