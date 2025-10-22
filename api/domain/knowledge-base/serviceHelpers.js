/**
 * Helper utilities for knowledge base selection. Each function keeps a single
 * responsibility so the service orchestration can read like a checklist.
 */

import { APPROVED_QUESTIONS } from '../question-response/approvedQuestions.js';

// Normalize question identifiers once so every comparison and log references the
// same trimmed values.
export const normalizeQuestionIdList = (questionIds = []) =>
    questionIds
        .filter((id) => typeof id === 'string')
        .map((id) => id.trim())
        .filter((id) => id.length > 0);

// Create safe-to-mutate snapshots of catalog file contexts. Downstream stages may
// tack on runtime metadata and we do not want that leaking back into the catalog
// singletons.
export const cloneFileContexts = (fileContexts = []) =>
    fileContexts
        .filter((context) => context && typeof context === 'object')
        .map((context) => ({
            title: typeof context.title === 'string' ? context.title : null,
            url: typeof context.url === 'string' ? context.url : null,
            summary: typeof context.summary === 'string' ? context.summary : null,
            fileId: typeof context.fileId === 'string' ? context.fileId : null,
            questionIds: Array.isArray(context.questionIds)
                ? context.questionIds.filter((id) => typeof id === 'string')
                : [],
        }));

// Snapshot the knowledge base entry itself so filtering logic never mutates the
// catalog definition shared across requests.
export const cloneKnowledgeBaseEntry = (entry) => ({
    ...entry,
    questionIds: Array.isArray(entry.questionIds) ? [...entry.questionIds] : [],
    fileContexts: cloneFileContexts(entry.fileContexts),
    notes: Array.isArray(entry.notes) ? [...entry.notes] : [],
});

// Convert the approved question catalog into file-context descriptors so we can
// attach question-specific uploads (e.g., Condo Law Alberta articles) without
// hard-coding them inside the knowledge-base catalog itself.
const buildQuestionFileContexts = () =>
    APPROVED_QUESTIONS.flatMap((question) => {
        if (!Array.isArray(question.fileSearchContexts) || question.fileSearchContexts.length === 0) {
            return [];
        }

        return question.fileSearchContexts
            .filter((context) => context && typeof context === 'object')
            .map((context) => {
                const handle =
                    typeof context.vectorStoreHandle === 'string' && context.vectorStoreHandle.trim().length > 0
                        ? context.vectorStoreHandle.trim()
                        : null;

                if (!handle) {
                    return null;
                }

                const title = typeof context.title === 'string' ? context.title.trim() : '';
                const url = typeof context.url === 'string' ? context.url.trim() : '';
                const summary = typeof context.summary === 'string' ? context.summary.trim() : '';
                const fileId = typeof context.fileId === 'string' ? context.fileId.trim() : '';

                return {
                    handle,
                    questionId: question.id,
                    title: title || null,
                    url: url || null,
                    summary: summary || null,
                    fileId: fileId || null,
                };
            })
            .filter(Boolean);
    });

const QUESTION_FILE_CONTEXTS = buildQuestionFileContexts();

// Group question-derived file contexts by vector-store handle so each
// knowledge-base entry can pull only the contexts that belong to its handle.
export const groupQuestionContextsByHandle = (allowedIdSet) => {
    const groups = new Map();

    const eligibleContexts = allowedIdSet
        ? QUESTION_FILE_CONTEXTS.filter((context) => allowedIdSet.has(context.questionId))
        : QUESTION_FILE_CONTEXTS;

    eligibleContexts.forEach((context) => {
        if (!groups.has(context.handle)) {
            groups.set(context.handle, []);
        }

        groups.get(context.handle).push(context);
    });

    return groups;
};

// Merge static catalog contexts with question-derived contexts while avoiding
// duplicate references to the same file or URL.
export const mergeFileContexts = (baseContexts = [], questionContexts = []) => {
    const merged = [...baseContexts];
    const seen = new Set(
        baseContexts.map((context) => {
            if (context?.fileId) {
                return `file:${context.fileId}`;
            }

            if (context?.url) {
                return `url:${context.url}`;
            }

            return null;
        }),
    );

    questionContexts.forEach((context) => {
        const signature = context.fileId ? `file:${context.fileId}` : context.url ? `url:${context.url}` : null;

        if (signature && seen.has(signature)) {
            return;
        }

        if (signature) {
            seen.add(signature);
        }

        merged.push({
            title: context.title,
            url: context.url,
            summary: context.summary,
            fileId: context.fileId,
            questionIds: [context.questionId],
        });
    });

    return merged;
};

// Determine whether a knowledge base should accompany the request given the
// approved-question filter.
export const shouldIncludeKnowledgeBase = (knowledgeBase, allowedIdSet) => {
    if (!allowedIdSet || allowedIdSet.size === 0) {
        return true;
    }

    const normalizedIds = normalizeQuestionIdList(knowledgeBase.questionIds);

    if (normalizedIds.length === 0) {
        return true;
    }

    return normalizedIds.some((id) => allowedIdSet.has(id));
};

// Create a sanitized snapshot of the knowledge base entry, merging in
// question-specific contexts and stripping empty vector-store identifiers.
export const buildKnowledgeBaseSnapshot = (entry, allowedIdSet, questionContextGroups) => {
    const clonedEntry = cloneKnowledgeBaseEntry(entry);

    const filteredFileContexts = allowedIdSet
        ? clonedEntry.fileContexts.filter((context) => {
              if (!Array.isArray(context.questionIds) || context.questionIds.length === 0) {
                  return true;
              }

              return context.questionIds.some((id) => allowedIdSet.has(id));
          })
        : clonedEntry.fileContexts;

    const questionSpecificContexts = questionContextGroups.get(clonedEntry.handle) || [];
    const mergedFileContexts = mergeFileContexts(filteredFileContexts, questionSpecificContexts);

    return {
        ...clonedEntry,
        fileContexts: mergedFileContexts,
        vectorStoreId:
            typeof clonedEntry.vectorStoreId === 'string' && clonedEntry.vectorStoreId.trim().length > 0
                ? clonedEntry.vectorStoreId.trim()
                : null,
    };
};

// Debug helper so the service can announce which knowledge bases rode along.
export const logKnowledgeBaseSelection = (debugEnabled, { allowedQuestionIds, selected }) => {
    if (!debugEnabled) {
        return;
    }

    console.log('[knowledge-base] Runtime vector store resolution', {
        requestedQuestionIds: allowedQuestionIds,
        resolvedEntries: selected.map((entry) => ({
            handle: entry.handle,
            vectorStoreId: entry.vectorStoreId,
        })),
    });

    console.log(
        '[knowledge-base] Selected knowledge bases for email',
        selected.map((entry) => ({
            handle: entry.handle,
            vectorStoreId: entry.vectorStoreId,
            questionIds: normalizeQuestionIdList(entry.questionIds),
            fileContextCount: Array.isArray(entry.fileContexts) ? entry.fileContexts.length : 0,
        })),
    );
};
