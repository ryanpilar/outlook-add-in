/**
 * Pipeline Logging Utilities
 * ---------------------------------------------------------------------------
 * Provides shared helpers for the orchestrator so the main control flow stays
 * focused on stage orchestration while we centralize console output patterns.
 */

const stageCopy = {
    ingest: {
        label: 'Ingest',
        waiting: '⏳  Waiting for ingest service to normalize payload…',
        completion: '✅  Ingest stage complete. Transitioning to retrieval…',
    },
    retrieve: {
        label: 'Retrieve',
        waiting: '⏳  Waiting on retrieval service to assemble context hints…',
        completion: '✅  Retrieval stage complete. Transitioning to generation…',
    },
    generate: {
        label: 'Generate',
        waiting: '⏳  Waiting for generation service to draft assistant plan…',
        completion: '✅  Generation stage complete. Transitioning to verification…',
    },
    verify: {
        label: 'Verify',
        waiting: '⏳  Waiting for verification service to review candidate plan…',
        completion: '✅  Verification stage complete. Preparing Outlook response payload…',
    },
};

const getStageTimerLabel = (stageLabel) => `⏱️  ${stageLabel} stage duration`;

export const runStageWithLogging = async (stageKey, executor) => {
    const stage = stageCopy[stageKey];

    if (!stage) {
        throw new Error(`Unknown pipeline stage: ${stageKey}`);
    }

    const { label, waiting, completion } = stage;

    console.info(`🚦  Pipeline stage: ${label} ➜ queued`);

    const timerLabel = getStageTimerLabel(label);
    console.time(timerLabel);

    if (waiting) {
        console.info(waiting);
    }

    let stageSucceeded = false;

    try {
        const result = await executor();
        stageSucceeded = true;
        return result;
    } finally {
        console.timeEnd(timerLabel);

        if (stageSucceeded && completion) {
            console.info(completion);
        }
    }
};

export const logEmailIntakeDetails = (normalizedEmail = {}, ingestResult = {}) => {
    const {
        body: normalizedBody,
        metadata: { subject, sender } = {},
    } = normalizedEmail;

    const senderLabel = sender?.displayName || sender?.emailAddress || 'Unknown sender';
    const normalizedBodyText = typeof normalizedBody === 'string' ? normalizedBody : '';
    const preview = normalizedBodyText.replace(/\s+/g, ' ').trim().slice(0, 200);
    const hasOverflow = normalizedBodyText.length > 200;

    console.info('📬  Email submission received from Outlook add-in');
    console.info(`     From   : ${senderLabel}`);
    console.info(`     Subject: ${subject || '(no subject)'}`);
    console.info(`     Preview: ${preview || '(empty body)'}${hasOverflow ? '…' : ''}`);

    if (ingestResult.ingestTelemetry) {
        console.info('🧾  Ingest telemetry snapshot:');
        console.dir(ingestResult.ingestTelemetry, { depth: null });
    }

    if (Array.isArray(ingestResult.vectorStoreIndex)) {
        console.info(
            `📚  Indexed vector store handles: ${ingestResult.vectorStoreIndex.length}`
        );
    }
};

export const logRetrievalPlanSummary = (retrievalPlan = {}) => {
    console.info('🧠  Retrieval plan hints:');
    console.dir(
        {
            vectorStoreHandles: retrievalPlan.vectorStoreHandles || [],
            searchHints: retrievalPlan.searchHints || {},
        },
        { depth: null }
    );
};

export const logGenerationInsights = (questionPlan) => {
    if (!questionPlan) {
        console.info('🤖  Question classification result: unavailable');
        return;
    }

    const { match, assistantPlan } = questionPlan;

    console.info('🤖  Question classification result:');
    console.dir(
        {
            isApprovedQuestion: match?.isApprovedQuestion || false,
            questionId: match?.questionId || null,
            matchedQuestions: match?.matchedQuestions || [],
            confidence: match?.confidence || null,
            reasoning: match?.reasoning || null,
            emailReply: assistantPlan?.emailReply || null,
            sourceCitations: assistantPlan?.sourceCitations || [],
        },
        { depth: null }
    );
};

export default {
    runStageWithLogging,
    logEmailIntakeDetails,
    logRetrievalPlanSummary,
    logGenerationInsights,
};
