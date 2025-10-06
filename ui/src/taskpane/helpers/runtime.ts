/* global Office, console */

/**
 * Configure the shared runtime so the add-in keeps running when the task pane closes
 * and ensure visibility events repopulate state when the pane is reopened.
 */
export const enableSharedRuntimeFeatures = async (): Promise<void> => {
  if (!Office.addin || typeof Office.addin.setStartupBehavior !== "function") {
    return;
  }

  try {
    await Office.addin.setStartupBehavior(Office.StartupBehavior.load);
  } catch (error) {
    console.warn("[Taskpane] Unable to set startup behavior to load.", error);
  }
};

/**
 * Registers a handler that runs whenever the task pane becomes visible again.
 * Returns a function that can be used to remove the handler.
 */
export const registerTaskpaneVisibilityHandler = async (
  onVisible: () => void | Promise<void>
): Promise<() => Promise<void>> => {
  if (!Office.addin || typeof Office.addin.onVisibilityModeChanged !== "function") {
    return async () => {};
  }

  try {
    const removeHandler = await Office.addin.onVisibilityModeChanged(async (args) => {
      if (args.visibilityMode === Office.VisibilityMode.taskpane) {
        await onVisible();
      }
    });

    return async () => {
      try {
        await removeHandler();
      } catch (error) {
        console.warn("[Taskpane] Failed to deregister the visibility handler.", error);
      }
    };
  } catch (error) {
    console.warn("[Taskpane] Failed to register the visibility handler.", error);
    return async () => {};
  }
};
