/**
 * ========================|| Workflow Two-Pass Question Response Flow ||========================
 *
 * Encapsulates the sequential vector-only ➜ research-augmented Responses API calls.
 * Keeping this orchestration isolated lets the service layer stay concise while we wire
 * richer prompt hand-offs. The first pass tries to satisfy the resident using only
 * File Search/vector store context. When that answer is insufficient, a second pass
 * reuses the earlier draft, enables web_search, and asks the model to close any gaps.
 */

import {
    WEB_SEARCH_MODES,
    buildResponsesRequestPayload,
    parseResponsesOutput,
    prepareRetrievalToolkit,
    DEFAULT_RESPONSE_VERBOSITY,
    DEFAULT_REASONING_EFFORT,
} from './serviceHelpers.js';

const DEFAULT_MODEL = 'gpt-5-mini';

const buildVectorOnlyDraft = async ({
    client,
    normalizedEmail,
    retrievalPlan,
    debugLogsEnabled,
    model,
}) => {
    const toolkit = await prepareRetrievalToolkit({
        client,
        retrievalPlan,
        debugLogsEnabled,
        webSearchMode: WEB_SEARCH_MODES.DISABLED,
    });

    const payload = buildResponsesRequestPayload({
        normalizedEmail,
        retrievalSummary: toolkit.retrievalSummary,
        toolDefinitions: toolkit.toolDefinitions,
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

    const toolDiagnostics = {
        ...toolkit.toolDiagnostics,
        model,
    };

    return {
        plan: {
            ...parsed,
            match: normalizedMatch,
            retrievalSummary: toolkit.retrievalSummary,
            toolDiagnostics,
        },
        payload,
        toolkit,
    };
};

const buildResearchAugmentedPlan = async ({
    client,
    normalizedEmail,
    retrievalPlan,
    debugLogsEnabled,
    model,
    vectorOnlyPlan,
}) => {
    const toolkit = await prepareRetrievalToolkit({
        client,
        retrievalPlan,
        debugLogsEnabled,
        webSearchMode: WEB_SEARCH_MODES.ENABLED,
    });

    const payload = buildResponsesRequestPayload({
        normalizedEmail,
        retrievalSummary: toolkit.retrievalSummary,
        toolDefinitions: toolkit.toolDefinitions,
        model,
        promptOptions: {
            generationMode: 'research-augmented',
            vectorAnswerMetadata: vectorOnlyPlan?.responseMetadata?.vectorAnswer,
            previousAssistantPlan: vectorOnlyPlan?.assistantPlan,
        },
        responseTuning: {
            verbosity: DEFAULT_RESPONSE_VERBOSITY,
            reasoningEffort: DEFAULT_REASONING_EFFORT,
        },
    });

    const response = await client.responses.create(payload);
    const { parsed, normalizedMatch } = parseResponsesOutput(response);

    const toolDiagnostics = {
        ...toolkit.toolDiagnostics,
        model,
    };

    return {
        plan: {
            ...parsed,
            match: normalizedMatch,
            retrievalSummary: toolkit.retrievalSummary,
            toolDiagnostics,
            vectorOnlyContext: {
                assistantPlan: vectorOnlyPlan?.assistantPlan || null,
                responseMetadata: vectorOnlyPlan?.responseMetadata || null,
                retrievalSummary: vectorOnlyPlan?.retrievalSummary || null,
                toolDiagnostics: vectorOnlyPlan?.toolDiagnostics || null,
            },
        },
        payload,
        toolkit,
    };
};

export const runWorkflowTwoPassQuestionPlan = async ({
    client,
    normalizedEmail,
    retrievalPlan,
    debugLogsEnabled,
    modelOptions = {},
}) => {
    const vectorPassModelCandidate =
        typeof modelOptions.vectorPassModel === 'string'
            ? modelOptions.vectorPassModel.trim()
            : '';
    const researchPassModelCandidate =
        typeof modelOptions.researchPassModel === 'string'
            ? modelOptions.researchPassModel.trim()
            : '';

    const vectorPassModel = vectorPassModelCandidate || DEFAULT_MODEL;
    const researchPassModel = researchPassModelCandidate || DEFAULT_MODEL;

    const vectorDraft = await buildVectorOnlyDraft({
        client,
        normalizedEmail,
        retrievalPlan,
        debugLogsEnabled,
        model: vectorPassModel,
    });

    const vectorPlan = vectorDraft.plan;
    const isVectorSufficient = Boolean(
        vectorPlan?.responseMetadata?.vectorAnswer?.isVectorAnswerSufficient,
    );

    if (isVectorSufficient) {
        return {
            finalPlan: vectorPlan,
            vectorOnlyDraft: {
                assistantPlan: vectorPlan.assistantPlan,
                responseMetadata: vectorPlan.responseMetadata,
                retrievalSummary: vectorPlan.retrievalSummary,
                toolDiagnostics: vectorPlan.toolDiagnostics,
                model: vectorPassModel,
            },
            researchAugmentation: null,
            modelSelections: {
                vectorPassModel,
                researchPassModel,
            },
        };
    }

    const researchPlanResult = await buildResearchAugmentedPlan({
        client,
        normalizedEmail,
        retrievalPlan,
        debugLogsEnabled,
        model: researchPassModel,
        vectorOnlyPlan: vectorPlan,
    });

    return {
        finalPlan: researchPlanResult.plan,
        vectorOnlyDraft: {
            assistantPlan: vectorPlan.assistantPlan,
            responseMetadata: vectorPlan.responseMetadata,
            retrievalSummary: vectorPlan.retrievalSummary,
            toolDiagnostics: vectorPlan.toolDiagnostics,
            model: vectorPassModel,
        },
        researchAugmentation: {
            toolDiagnostics: researchPlanResult.plan.toolDiagnostics,
            retrievalSummary: researchPlanResult.plan.retrievalSummary,
            model: researchPassModel,
        },
        modelSelections: {
            vectorPassModel,
            researchPassModel,
        },
    };
};

export default {
    runWorkflowTwoPassQuestionPlan,
};
