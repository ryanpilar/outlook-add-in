/* global Office */
/**
 * Mailbox Item Tracking Hook
 * ---------------------------------------------------------------------------
 * Outlook replaces the task pane's webview whenever the user opens a different
 * message, so React state needs a stable identifier to decide which snapshot to
 * hydrate. This hook reads the current mailbox item, listens for navigation
 * events, and supplies a fallback key until Outlook issues a permanent id.
 *
 * - Subscribes to `Office.EventType.ItemChanged` so downstream state follows the
 *   host's active item without extra plumbing.
 * - Issues a temporary compose key when `itemId` is still pending, keeping
 *   persistence hooks responsive without over-engineering the compose path.
 * - Removes the registered handler on cleanup; classic desktop hosts otherwise
 *   accumulate listeners across navigation.
 */
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";

// Compose windows occasionally start without a permanent itemId. In those cases
// we generate a temporary key so the task pane can still store state until the
// real identifier arrives.
const generateFallbackKey = (): string =>
  `compose:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;

const getCurrentItemKey = (
  composeFallbackRef: MutableRefObject<string | null>
): string | null => {
  const mailbox = Office.context?.mailbox;
  const item = mailbox?.item;

  if (!item) {
    return null;
  }

  const itemWithId = item as Office.Item & { itemId?: string | null };
  const itemId = itemWithId.itemId ?? null;

  // Reading itemId is safe in both read and compose surfaces. When Outlook has
  // already provided a concrete id we prefer it over the fallback.
  if (typeof itemId === "string" && itemId.length > 0) {
    composeFallbackRef.current = null;
    return itemId;
  }

  if (!composeFallbackRef.current) {
    composeFallbackRef.current = generateFallbackKey();
  }

  return composeFallbackRef.current;
};

export const useMailboxItemId = (): { itemId: string | null; isFallbackId: boolean } => {
  const composeFallbackRef = useRef<string | null>(null);
  const [itemId, setItemId] = useState<string | null>(() => getCurrentItemKey(composeFallbackRef));
  const isMountedRef = useRef(true);

  useEffect(() => {
    // Track whether the hook is still active so async callbacks avoid touching
    // state after unmount.
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refreshItemId = useCallback(() => {
    const nextItemId = getCurrentItemKey(composeFallbackRef);

    if (isMountedRef.current) {
      setItemId((current) => (current === nextItemId ? current : nextItemId));
    }
  }, []);

  useEffect(() => {
    const mailbox = Office.context?.mailbox;

    if (!mailbox) {
      return undefined;
    }

    // Prime the state with the current item so the UI has a key even if the
    // ItemChanged event fires later (common in OWA).
    refreshItemId();

    mailbox.addHandlerAsync(Office.EventType.ItemChanged, refreshItemId, (asyncResult) => {
      if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) {
        console.error("Failed to subscribe to mailbox item changes", asyncResult.error);
      }
    });

    return () => {
      mailbox.removeHandlerAsync(
        Office.EventType.ItemChanged,
        // Cast to opt into the overload that targets a specific handler. This is
        // supported by the runtime even though the TypeScript definitions omit it.
        { handler: refreshItemId } as unknown as Office.AsyncContextOptions,
        (asyncResult) => {
          if (asyncResult.status !== Office.AsyncResultStatus.Succeeded) {
            console.error("Failed to remove mailbox item change handler", asyncResult.error);
          }
        }
      );
    };
  }, [refreshItemId]);

  const isFallbackId = useMemo(() => {
    // Consumers occasionally need to know whether the key is temporary so they
    // can skip persistence until Outlook provides a real id.
    return composeFallbackRef.current !== null && composeFallbackRef.current === itemId;
  }, [itemId]);

  return { itemId, isFallbackId };
};
