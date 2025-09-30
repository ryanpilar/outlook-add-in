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

import ApiError from '../utils/ApiError.js';
import getResponsesClient from '../utils/responsesClient.js';
import { APPROVED_QUESTIONS } from '../utils/approvedQuestions.js';
import {
    buildQuestionResponsePrompt,
    getQuestionResponseSchema,
} from '../utils/promptWrappers.js';

// Opt-in support for OpenAI's web_search tool. When the environment flag is
// enabled we send the documented `tools` payload so the model can fetch fresh
// context before responding. Keeping this logic isolated makes it obvious how
// to wire additional tool configuration without touching the core prompt flow.
const getWebSearchTools = () => {
    if (process.env.OPENAI_ENABLE_WEB_SEARCH !== 'true') {
        return undefined;
    }

    return [
        {
            type: 'web_search',
        },
    ];
};

// Provide a friendly manual-review plan so front-end messaging stays consistent even when
// we cannot reach OpenAI. This mirrors the schema returned by the happy path call.
const DEFAULT_ASSISTANT_PLAN = {
    answerSummary:
        'We received your email and a teammate will review it shortly because the automated assistant is unavailable.',
    recommendedActions: [
        {
            title: 'Route to concierge team',
            details: 'Assign the message to the condo concierge queue for manual follow-up.',
        },
        {
            title: 'Acknowledge resident',
            details: 'Let the resident know that we are reviewing their question and will respond soon.',
        },
    ],
    suggestedFollowUps: [
        'Provide the resident with an estimated response time once an agent has reviewed the message.',
    ],
    knowledgeConfidence: 'low',
};

// Compose the deterministic fallback payload that mirrors the model response. We expose the
// error reasoning so downstream logging (or the UI) can explain why we skipped automation.
const buildFallbackPayload = (error) => ({
    match: {
        isApprovedQuestion: false,
        questionId: null,
        questionTitle: null,
        confidence: 'low',
        reasoning: `Fell back to manual handling: ${error.message}`,
    },
    assistantPlan: DEFAULT_ASSISTANT_PLAN,
    approvedQuestions: APPROVED_QUESTIONS,
});

export const getQuestionResponsePlan = async (normalizedEmail) => {
    if (!normalizedEmail || typeof normalizedEmail !== 'object') {
        throw new ApiError(400, 'Normalized email payload missing.');
    }

    try {
        // ============================|| Client Acquisition ||============================ //
        // Grab the singleton SDK client so each call reuses connection pooling + auth setup.
        const client = getResponsesClient();

        // ================================|| Prompt Prep ||=============================== //
        // Build the structured message array + JSON schema before hitting the wire. Keeping
        // these helpers pure makes it trivial to unit test prompt changes in isolation.
        const inputMessages = buildQuestionResponsePrompt(normalizedEmail);
        const textFormat = {
            type: 'json_schema',
            json_schema: getQuestionResponseSchema(),
        };

        const payload = {
            model: process.env.OPENAI_RESPONSES_MODEL || 'gpt-5',
            input: inputMessages,
            text: {
                format: textFormat,
            },
            temperature: 0.2,
        };

        const webSearchTools = getWebSearchTools();

        if (webSearchTools) {
            payload.tools = webSearchTools;
            payload.tool_choice = 'auto';
        }

        // ============================|| API Invocation ||============================ //
        // Call the Responses API (SDK v5.23.2). When File Search or tool outputs are
        // enabled the SDK returns a content array, so always guard against mixed output
        // formats as documented at https://platform.openai.com/docs/api-reference/responses.
        const response = await client.responses.create(payload);

        // Prefer the convenience helper, but defensively read the content array if needed.
        // Some SDK versions populate `output` with granular content blocks (future tool
        // outputs, multiple text segments, etc.), so we gather anything explicitly marked as
        // model text and stitch it back together.
        const fallbackSegments = Array.isArray(response?.output)
            ? response.output.flatMap((item) =>
                Array.isArray(item?.content)
                    ? item.content
                        .filter((contentItem) => contentItem?.type === 'output_text')
                        .map((contentItem) => contentItem?.text || '')
                    : [])
            : [];

        const outputText = response?.output_text ?? fallbackSegments.join('');

        if (!outputText.trim()) {
            throw new Error('OpenAI response missing output_text.');
        }

        // ==============================|| Parse & Return ||============================== //
        // The schema guarantees a consistent object shape. Attach the catalog for the UI so
        // it can surface "other questions you can ask" without another import.
        const parsed = JSON.parse(outputText);

        // Always echo the latest approved question metadata with the response to simplify
        // front-end rendering and keep a single source of truth for the catalog.

        return {
            ...parsed,
            approvedQuestions: APPROVED_QUESTIONS,
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
