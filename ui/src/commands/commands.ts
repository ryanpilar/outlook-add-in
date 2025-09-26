/*
 * Copyright (c) Microsoft Corporation. All rights reserved. Licensed under the MIT license.
 * See LICENSE in the project root for license information.
 */

/* global Office */

Office.onReady(() => {
  if (Office && Office.addin && typeof Office.addin.showAsTaskpane === "function") {
    Office.addin
      .showAsTaskpane()
      .then(() => {
        if (
          Office.context &&
          Office.context.ui &&
          typeof Office.context.ui.closeContainer === "function"
        ) {
          Office.context.ui.closeContainer();
        }
      })
      .catch(() => {
        // no-op: if the host does not support showAsTaskpane we leave the default behavior
      });
  }
});
