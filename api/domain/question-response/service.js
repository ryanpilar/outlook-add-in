/**
 * ============================|| Question Response Service ||============================
 *
 * Examines a normalized Outlook email payload, determines whether the resident is asking
 * one of the condo board-approved questions, and requests a structured answer plan from
 * OpenAI's Responses API. The goal is to bootstrap a reliable flow that will scale as the
 * application begins handling richer question sets.
 *
 * Responsibilities:
 *  1. Guard inputs – the downstream prompt expects a normalized email object.
 *  2. Assemble the reusable prompt + schema wrappers for the Responses API call.
 *  3. Parse the model output into a predictable payload shape, falling back to a
 *     deterministic response if the API is unavailable or returns malformed data.
 */

import ApiError from '../../http/errors/ApiError.js';
import getResponsesClient from '../../integrations/openai/client.js';
import { APPROVED_QUESTIONS } from './approvedQuestions.js';
import { buildFallbackPayload } from './fallbackPlans.js';
import {
    buildResponsesRequestPayload,
    parseResponsesOutput,
    prepareRetrievalToolkit,
} from './serviceHelpers.js';

const DEBUG_LOGS_ENABLED = process.env.PIPELINE_DEBUG_LOGS === 'true';

export const getQuestionResponsePlan = async (normalizedEmail, options = {}) => {
    if (!normalizedEmail || typeof normalizedEmail !== 'object') {
        throw new ApiError(400, 'Normalized email payload missing.');
    }

    try {
        // ============================|| Client Acquisition ||============================ //
        // Grab the singleton SDK client so each call reuses connection pooling + auth setup.
        const client = getResponsesClient();

        // ==============================|| Retrieval Prep ||============================= //
        // Lift the retrieval wiring into helpers so the service can read top-down while we still
        // attach File Search handles and optional web search tools when the environment toggles demand it.
        const retrievalPlan = options?.retrievalPlan || null;

        const { toolDefinitions, retrievalSummary, toolDiagnostics } = await prepareRetrievalToolkit({
            client,
            retrievalPlan,
            debugLogsEnabled: DEBUG_LOGS_ENABLED,
        });

        // ================================|| Prompt Prep ||=============================== //
        // Build the structured message array + JSON schema before hitting the wire. Keeping these
        // helpers pure makes it trivial to unit test prompt changes in isolation.
        const payload = buildResponsesRequestPayload({
            normalizedEmail,
            retrievalSummary,
            toolDefinitions,
        });

        // ============================|| API Invocation ||============================ //
        // Call the Responses API (SDK v5.23.2). When File Search or tool outputs are enabled the SDK
        // returns a content array, so always guard against mixed output formats as documented at
        // https://platform.openai.com/docs/api-reference/responses.
        const response = await client.responses.create(payload);

        // ==============================|| Parse & Return ||============================== //
        // The schema guarantees a consistent object shape. Attach the catalog for the UI so it can
        // surface "other questions you can ask" without another import.
        const { parsed, normalizedMatch } = parseResponsesOutput(response);

        return {
            ...parsed,
            match: normalizedMatch,
            approvedQuestions: APPROVED_QUESTIONS,
            retrievalSummary,
            toolDiagnostics,
        };
    } catch (error) {
        // ===============================|| Fallback Path ||============================== //
        console.error('OpenAI Responses API call failed:', error?.response?.data || error.message);
        return buildFallbackPayload(error);
    }
};

export default {
    getQuestionResponsePlan,
};
