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
import {
    buildQuestionResponsePrompt,
    getQuestionResponseSchema,
} from './promptWrappers.js';
import { buildFallbackPayload } from './fallbackPlans.js';

// When enabled, we send the `tools` payload so the model can fetch fresh context before responding.
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

// When enabled, we send the `file_search` payload so the model can access a vector store.
const getFileSearchTools = (store) => {
    if (process.env.OPENAI_ENABLE_FILE_SEARCH !== 'true') {
        return undefined;
    }
    return [
        {
            type: 'file_search',
            vector_store_ids: [store.id]
        },
    ];
};

export const getQuestionResponsePlan = async (normalizedEmail) => {
    if (!normalizedEmail || typeof normalizedEmail !== 'object') {
        throw new ApiError(400, 'Normalized email payload missing.');
    }

    try {
        // ============================|| Client Acquisition ||============================ //
        // Grab the singleton SDK client so each call reuses connection pooling + auth setup.
        const client = getResponsesClient();

        // ================================|| Prompt Prep ||=============================== //
        const inputMessages = buildQuestionResponsePrompt(normalizedEmail);
        // const { name: schemaName, strict, schema } = getQuestionResponseSchema();
        const textFormat = {
            type: 'json_schema',
            ...getQuestionResponseSchema(),

        };

        const payload = {
            model: 'gpt-5-mini',
            input: inputMessages,
            text: {
                format: textFormat,
            },
            // reasoning: {
            //     effort: 'medium'
            // }
            // temperature: 0.2,
        };

        const webSearchTools = getWebSearchTools();

        if (webSearchTools) {
            payload.tools = webSearchTools;
            payload.tool_choice = 'auto';
        }

        // ========================|| Initialize File Search ||======================== //

        const FILES = [
            {
                name: 'condolawalberta.ca-CondoLawAlberta_1_.pdf',
                id: 'file-DVJMyiSa2o6W1CNwG2RMPx'
            }
        ]

        const vectorStore = await client.vectorStores.create({
            name: "peka-master-store",
            file_ids: FILES.map( file => file.id),
        })

        getFileSearchTools(vectorStore)

        // ============================|| API Invocation ||============================ //
        // Call the Responses API (SDK v5.23.2). When File Search or tool outputs are
        // enabled the SDK returns a content array, so always guard against mixed output
        // formats as documented at https://platform.openai.com/docs/api-reference/responses.
        const response = await client.responses.create(payload);

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

        const parsed = JSON.parse(outputText);

        const normalizedMatch = {
            ...parsed.match,
            matchedQuestions: Array.isArray(parsed?.match?.matchedQuestions)
                ? parsed.match.matchedQuestions
                : [],
        };

        // Always echo the latest approved question metadata with the response
        return {
            ...parsed,
            match: normalizedMatch,
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
