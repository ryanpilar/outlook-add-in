/**
 * =======================|| Single-Pass Question Workflow ||=======================
 *
 * Executes the streamlined planning strategy that gathers File Search tooling,
 * feeds the approved-question catalog plus the normalized email into the prompt,
 * and asks GPT for the structured response payload in one Responses API call.
 * The model receives the same JSON schema we expose to downstream services so the
 * assistant plan, vector sufficiency analysis, and citations arrive in a single
 * round-trip without waiting for a research augmentation step.
 */

import {
    buildResponsesRequestPayload,
    parseResponsesOutput,
    prepareRetrievalToolkit,
    DEFAULT_RESPONSE_VERBOSITY,
    DEFAULT_REASONING_EFFORT,
} from './serviceHelpers.js';

const DEFAULT_MODEL = 'gpt-5-mini';

export const runSinglePassQuestionPlan = async ({
    client,
    normalizedEmail,
    retrievalPlan,
    debugLogsEnabled,
    modelOptions = {},
}) => {
    const preferredModel = [
        modelOptions.singlePassModel,
        modelOptions.vectorPassModel,
        modelOptions.researchPassModel,
    ]
        .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
        .find((candidate) => candidate.length > 0);

    const model = preferredModel || DEFAULT_MODEL;

    const { toolDefinitions, retrievalSummary, toolDiagnostics } = await prepareRetrievalToolkit({
        client,
        retrievalPlan,
        debugLogsEnabled,
    });

    const payload = buildResponsesRequestPayload({
        normalizedEmail,
        retrievalSummary,
        toolDefinitions,
        model,
        promptOptions: {
            generationMode: 'vector-only',
        },
        responseTuning: {
            verbosity: DEFAULT_RESPONSE_VERBOSITY,
            reasoningEffort: DEFAULT_REASONING_EFFORT,
        },
    });

    const response = await client.responses.create(payload);
    const { parsed, normalizedMatch } = parseResponsesOutput(response);

    const finalPlan = {
        ...parsed,
        match: normalizedMatch,
        retrievalSummary,
        toolDiagnostics: {
            ...toolDiagnostics,
            model,
        },
    };

    return {
        finalPlan,
        vectorOnlyDraft: null,
        researchAugmentation: null,
        modelSelections: {
            singlePassModel: model,
        },
    };
};

export default {
    runSinglePassQuestionPlan,
};
