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

type TaskpaneVisibilityHandlers = {
  onTaskpaneVisible?: () => void | Promise<void>;
  onTaskpaneHidden?: () => void | Promise<void>;
};

/**
 * Registers handlers that run whenever the task pane visibility changes.
 * Returns a function that can be used to remove the handler.
 */
export const registerTaskpaneVisibilityHandler = async (
  handlers: TaskpaneVisibilityHandlers
): Promise<() => Promise<void>> => {
  if (!Office.addin || typeof Office.addin.onVisibilityModeChanged !== "function") {
    return async () => {};
  }

  const { onTaskpaneVisible, onTaskpaneHidden } = handlers;

  try {
    const removeHandler = await Office.addin.onVisibilityModeChanged(async (args) => {
      try {
        if (args.visibilityMode === Office.VisibilityMode.taskpane) {
          if (onTaskpaneVisible) {
            await onTaskpaneVisible();
          }
        } else if (args.visibilityMode === Office.VisibilityMode.hidden) {
          if (onTaskpaneHidden) {
            await onTaskpaneHidden();
          }
        }
      } catch (handlerError) {
        console.warn("[Taskpane] Visibility handler threw an error.", handlerError);
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

export const showTaskpane = async (): Promise<void> => {
  if (!Office.addin || typeof Office.addin.showAsTaskpane !== "function") {
    return;
  }

  try {
    await Office.addin.showAsTaskpane();
  } catch (error) {
    console.warn("[Taskpane] Failed to show the task pane programmatically.", error);
  }
};
