/**
 * ============================|| Knowledge Base Service ||=============================
 *
 * Helps the retrieve stage decide which libraries should ride along with a request and
 * hands back safe-to-mutate copies. The catalog exports shared definitions; cloning them
 * here prevents one request from quietly rewriting data the next request would inherit.
 */

import { KNOWLEDGE_BASES } from './catalog.js';
import {
    buildKnowledgeBaseSnapshot,
    groupQuestionContextsByHandle,
    logKnowledgeBaseSelection,
    normalizeQuestionIdList,
    shouldIncludeKnowledgeBase,
} from './serviceHelpers.js';

const DEBUG_LOGS_ENABLED = process.env.PIPELINE_DEBUG_LOGS === 'true';

export const selectKnowledgeBasesForEmail = (_normalizedEmail, options = {}) => {
    // =============================|| Approved Question Filter ||============================= //
    // Trim the caller-supplied question list so downstream filters compare against predictable ids.
    const allowedQuestionIds = normalizeQuestionIdList(options.allowedQuestionIds);
    const allowedIdSet = allowedQuestionIds.length > 0 ? new Set(allowedQuestionIds) : null;

    // =============================|| Question Context Merge ||============================= //
    // Group question-scoped file contexts by handle so each knowledge base can append the matching uploads.
    const questionContextGroups = groupQuestionContextsByHandle(allowedIdSet);

    // ==============================|| Snapshot Cloning ||============================== //
    // Clone each catalog entry before filtering so request-specific tweaks never bleed into shared definitions.
    const snapshots = KNOWLEDGE_BASES.map((entry) =>
        buildKnowledgeBaseSnapshot(entry, allowedIdSet, questionContextGroups),
    );

    // ==============================|| Inclusion Filter ||============================== //
    // Drop any libraries that are irrelevant to the approved-question filter, keeping the payload lean.
    const selected = snapshots.filter((entry) => shouldIncludeKnowledgeBase(entry, allowedIdSet));

    // ===============================|| Debug Logging ||=============================== //
    // Announce which libraries rode along so manual testing can confirm the expected handles.
    logKnowledgeBaseSelection(DEBUG_LOGS_ENABLED, { allowedQuestionIds, selected });

    return selected;
};

export default {
    selectKnowledgeBasesForEmail,
};
