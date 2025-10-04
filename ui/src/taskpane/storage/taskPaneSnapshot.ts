/**
 * Task Pane Snapshot Model
 * ---------------------------------------------------------------------------
 * The task pane and storage helpers share this schema so persisted state stays
 * predictable as users hop between messages. Centralizing the definition makes
 * it straightforward to evolve the cached data without chasing mismatched
 * shapes throughout the UI.
 *
 * - `TaskPaneSnapshot` mirrors the fields TextInsertion restores on load.
 * - `sanitizePersistedSnapshot` guards against payloads from older builds.
 * - Convenience helpers supply empty/default snapshots and equality checks.
 */
import type { PipelineResponse } from "../taskpane";

export const TASK_PANE_SNAPSHOT_VERSION = 1;

export interface TaskPaneSnapshot {
  statusMessage: string;
  pipelineResponse: PipelineResponse | null;
  isOptionalPromptVisible: boolean;
  optionalPrompt: string;
}

export interface PersistedTaskPaneSnapshot {
  version: number;
  snapshot: TaskPaneSnapshot;
}

export const createEmptyTaskPaneSnapshot = (): TaskPaneSnapshot => ({
  statusMessage: "",
  pipelineResponse: null,
  isOptionalPromptVisible: false,
  optionalPrompt: "",
});

export const snapshotEqualsEmpty = (snapshot: TaskPaneSnapshot): boolean => {
  return (
    snapshot.statusMessage === "" &&
    snapshot.pipelineResponse === null &&
    snapshot.isOptionalPromptVisible === false &&
    snapshot.optionalPrompt === ""
  );
};

// Older builds may have stored data with additional fields. Sanitization trims
// the payload down to the minimum viable snapshot so deserialization is safe.
export const sanitizePersistedSnapshot = (
  value: unknown
): TaskPaneSnapshot | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const maybePersisted = value as Partial<PersistedTaskPaneSnapshot>;

  if (maybePersisted.version !== TASK_PANE_SNAPSHOT_VERSION) {
    return null;
  }

  const snapshot = maybePersisted.snapshot as Partial<TaskPaneSnapshot> | undefined;

  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  return {
    statusMessage: typeof snapshot.statusMessage === "string" ? snapshot.statusMessage : "",
    pipelineResponse: snapshot.pipelineResponse ?? null,
    isOptionalPromptVisible:
      typeof snapshot.isOptionalPromptVisible === "boolean"
        ? snapshot.isOptionalPromptVisible
        : false,
    optionalPrompt: typeof snapshot.optionalPrompt === "string" ? snapshot.optionalPrompt : "",
  };
};
