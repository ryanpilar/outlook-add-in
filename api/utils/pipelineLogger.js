import { createLogger } from './logger.js';

const DEFAULT_STAGE_EMOJIS = {
    queued: '🚦',
    wait: '⏳',
    timer: '⏱️',
    success: '✅',
    failure: '💥',
};

const normalizeError = (error) => {
    if (!error) {
        return null;
    }

    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    if (typeof error === 'string') {
        return { message: error };
    }

    return { value: error };
};

const toSeconds = (durationMs) => Number((durationMs / 1000).toFixed(2));

export const createPipelineLogger = ({
    pipelineId,
    requestId,
    scope = 'Pipeline',
} = {}) => {
    const baseLogger = createLogger(scope, {
        pipelineId,
        requestId,
    });

    const stage = (stageName) => {
        const stageLogger = baseLogger.child({ stage: stageName });

        const queued = (metadata = {}) =>
            stageLogger.info(`Pipeline stage: ${stageName} ➜ queued`, {
                ...metadata,
                state: 'queued',
            }, DEFAULT_STAGE_EMOJIS.queued);

        const run = async (operation, {
            waitMessage,
            waitEmoji = DEFAULT_STAGE_EMOJIS.wait,
            successMessage,
            successEmoji = DEFAULT_STAGE_EMOJIS.success,
            failureMessage,
            failureEmoji = DEFAULT_STAGE_EMOJIS.failure,
            timerEmoji = DEFAULT_STAGE_EMOJIS.timer,
            metadata = {},
        } = {}) => {
            if (waitMessage) {
                stageLogger.info(waitMessage, {
                    ...metadata,
                    state: 'waiting',
                }, waitEmoji);
            }

            const startedAt = Date.now();

            try {
                const result = await operation();
                const durationMs = Date.now() - startedAt;

                stageLogger.info(`${stageName} stage duration`, {
                    ...metadata,
                    state: 'timing',
                    durationMs,
                    durationSeconds: toSeconds(durationMs),
                }, timerEmoji);

                if (successMessage) {
                    stageLogger.info(successMessage, {
                        ...metadata,
                        state: 'completed',
                        durationMs,
                        durationSeconds: toSeconds(durationMs),
                    }, successEmoji);
                }

                return result;
            } catch (error) {
                const durationMs = Date.now() - startedAt;

                stageLogger.error(
                    failureMessage || `${stageName} stage failed`,
                    {
                        ...metadata,
                        state: 'failed',
                        durationMs,
                        durationSeconds: toSeconds(durationMs),
                        error: normalizeError(error),
                    },
                    failureEmoji,
                );

                throw error;
            }
        };

        return {
            queued,
            run,
        };
    };

    const emailSummary = ({
        from,
        subject,
        preview,
        totalCharacters,
    }) => {
        baseLogger.info('Email submission received from Outlook add-in', {
            from,
            subject,
            preview,
            totalCharacters,
        }, '📬');
    };

    const telemetrySnapshot = (label, telemetry) => {
        baseLogger.info(label, {
            telemetry,
        }, '🧾');
    };

    const vectorStoreIndex = (handles = []) => {
        baseLogger.info('Indexed vector store handles detected', {
            handles,
            total: handles.length,
        }, '📚');
    };

    const retrievalHints = ({ vectorStoreHandles = [], searchHints = {} } = {}) => {
        baseLogger.info('Retrieval plan hints', {
            vectorStoreHandles,
            searchHints,
        }, '🧠');
    };

    const questionClassification = (questionPlan) => {
        if (!questionPlan) {
            baseLogger.info('Question classification result unavailable', {}, '🤖');
            return;
        }

        const { match, assistantPlan } = questionPlan;

        baseLogger.info('Question classification result', {
            isApprovedQuestion: match?.isApprovedQuestion ?? false,
            questionId: match?.questionId ?? null,
            matchedQuestions: match?.matchedQuestions ?? [],
            confidence: match?.confidence ?? null,
            reasoning: match?.reasoning ?? null,
            emailReply: assistantPlan?.emailReply ?? null,
            sourceCitations: assistantPlan?.sourceCitations ?? [],
        }, '🤖');
    };

    const responsePrepared = ({ emailResponse, sourceCitations }) => {
        baseLogger.info('Verification completed. Outlook response prepared.', {
            hasEmailResponse: Boolean(emailResponse),
            sourceCitationCount: Array.isArray(sourceCitations) ? sourceCitations.length : 0,
        }, '✅');
    };

    return {
        stage,
        emailSummary,
        telemetrySnapshot,
        vectorStoreIndex,
        retrievalHints,
        questionClassification,
        responsePrepared,
        info: baseLogger.info,
        warn: baseLogger.warn,
        error: baseLogger.error,
        debug: baseLogger.debug,
    };
};
