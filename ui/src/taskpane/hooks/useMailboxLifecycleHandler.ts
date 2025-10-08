import * as React from "react";
import { registerTaskpaneVisibilityHandler } from "../helpers/outlook-runtime";

interface UseMailboxLifecycleHandlerOptions {
  refreshFromCurrentItem: () => Promise<void>;
  isMountedRef: React.MutableRefObject<boolean>;
  visibilityCleanupRef: React.MutableRefObject<(() => Promise<void>) | null>;
}

export const useMailboxLifecycleHandler = ({
  refreshFromCurrentItem,
  isMountedRef,
  visibilityCleanupRef,
}: UseMailboxLifecycleHandlerOptions): void => {
  React.useEffect(() => {
    isMountedRef.current = true;
    console.info("[Taskpane] Task pane mounted. Initializing lifecycle handlers.");

    const initialize = async () => {
      await refreshFromCurrentItem();
      visibilityCleanupRef.current =
        await registerTaskpaneVisibilityHandler(refreshFromCurrentItem);
    };

    void initialize();

    const mailbox = Office.context.mailbox;
    const itemChangedHandler = () => {
      console.info("[Taskpane] Office item changed event received. Triggering refresh.");
      void refreshFromCurrentItem();
    };

    if (mailbox?.addHandlerAsync) {
      mailbox.addHandlerAsync(Office.EventType.ItemChanged, itemChangedHandler, (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded) {
          console.warn("[Taskpane] Failed to register ItemChanged handler.", result.error);
        } else {
          console.info("[Taskpane] ItemChanged handler registered.");
        }
      });
    }

    return () => {
      isMountedRef.current = false;
      console.info("[Taskpane] Task pane unmounted. Cleaning up handlers.");

      if (visibilityCleanupRef.current) {
        void visibilityCleanupRef.current();
        visibilityCleanupRef.current = null;
      }

      if (mailbox?.removeHandlerAsync) {
        mailbox.removeHandlerAsync(Office.EventType.ItemChanged, (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            console.warn("[Taskpane] Failed to remove ItemChanged handler.", result.error);
          } else {
            console.info("[Taskpane] ItemChanged handler removed.");
          }
        });
      }
    };
  }, [refreshFromCurrentItem]);
};
