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
import { runSinglePassQuestionPlan } from './singlePassWorkflow.js';
import { runTwoPassQuestionPlan } from './twoPassWorkflow.js';

const DEBUG_LOGS_ENABLED = process.env.PIPELINE_DEBUG_LOGS === 'true';
const WORKFLOW_MODES = {
    SINGLE_PASS: 'single-pass',
    TWO_PASS: 'two-pass',
};
const WORKFLOW_SELECTION = process.env.OPENAI_QUESTION_PLAN_WORKFLOW;
const ACTIVE_WORKFLOW =
    WORKFLOW_SELECTION === WORKFLOW_MODES.TWO_PASS
        ? WORKFLOW_MODES.TWO_PASS
        : WORKFLOW_MODES.SINGLE_PASS;
const SINGLE_PASS_MODEL = process.env.OPENAI_SINGLE_PASS_MODEL || process.env.OPENAI_VECTOR_PASS_MODEL;
const VECTOR_PASS_MODEL = process.env.OPENAI_VECTOR_PASS_MODEL;
const RESEARCH_PASS_MODEL = process.env.OPENAI_RESEARCH_PASS_MODEL;

export const getQuestionResponsePlan = async (normalizedEmail, options = {}) => {
    if (!normalizedEmail || typeof normalizedEmail !== 'object') {
        throw new ApiError(400, 'Normalized email payload missing.');
    }

    try {
        // ============================|| Client Acquisition ||============================ //
        // Grab the singleton SDK client so each call reuses connection pooling + auth setup.
        const client = getResponsesClient();

        // ===========================|| Workflow Selection ||=========================== //
        // Keep both workflows wired up and default to the single-pass path for now.
        const retrievalPlan = options?.retrievalPlan || null;

        const useTwoPassWorkflow = ACTIVE_WORKFLOW === WORKFLOW_MODES.TWO_PASS;

        const { finalPlan, vectorOnlyDraft, researchAugmentation } = useTwoPassWorkflow
            ? await runTwoPassQuestionPlan({
                  client,
                  normalizedEmail,
                  retrievalPlan,
                  debugLogsEnabled: DEBUG_LOGS_ENABLED,
                  modelOptions: {
                      vectorPassModel: VECTOR_PASS_MODEL,
                      researchPassModel: RESEARCH_PASS_MODEL,
                  },
              })
            : await runSinglePassQuestionPlan({
                  client,
                  normalizedEmail,
                  retrievalPlan,
                  debugLogsEnabled: DEBUG_LOGS_ENABLED,
                  modelOptions: {
                      singlePassModel: SINGLE_PASS_MODEL,
                      vectorPassModel: VECTOR_PASS_MODEL,
                      researchPassModel: RESEARCH_PASS_MODEL,
                  },
              });

        return {
            ...finalPlan,
            approvedQuestions: APPROVED_QUESTIONS,
            vectorOnlyDraft,
            researchAugmentation,
            questionPlanWorkflow: ACTIVE_WORKFLOW,
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
