/**
 * useStore — React hook adapter for workspace stores.
 *
 * Connects Store instances to React component lifecycle.
 * Supports selector pattern for fine-grained re-renders.
 */

import { useSyncExternalStore, useCallback } from "react";
import type { Store } from "./index";

/**
 * Subscribe a React component to a Store instance.
 * Optionally pass a selector for partial state subscription.
 *
 * @example
 *   const theme = useStore(workspaceStore, s => s.theme);
 *   const { view, tab } = useStore(workspaceStore);
 */
export function useStore<T extends object>(store: Store<T>): Readonly<T>;
export function useStore<T extends object, S>(store: Store<T>, selector: (state: Readonly<T>) => S): S;
export function useStore<T extends object, S>(store: Store<T>, selector?: (state: Readonly<T>) => S): Readonly<T> | S {
  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store],
  );

  const getSnapshot = useCallback(() => {
    const state = store.getState();
    return selector ? selector(state) : state;
  }, [store, selector]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
