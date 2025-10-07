/**
 * Pipeline Orchestrator Controller
 * ---------------------------------------------------------------------------
 * This controller sequences the planned Ingest ➜ Retrieve ➜ Generate ➜ Verify
 * flow for the Outlook add-in. Once the stage controllers are fully
 * implemented, the orchestrator will:
 *
 * 1. Ensure the normalized payload and vector-store metadata (file IDs + label map)
 *    produced during ingestion are threaded through retrieval so the correct
 *    OpenAI file collections are exposed to the Responses API, and citations can
 *    resolve back to human-friendly labels.
 *          File Search guide: https://platform.openai.com/docs/guides/tools-file-search
 *
 * 2. Coordinate the single `POST /v1/responses` call with File Search enabled,
 *    attaching the chosen vector store IDs, capturing tool-call telemetry, and
 *    handling retries/backoff on 429s.
 *          Responses API: https://platform.openai.com/docs/api-reference/responses
 *          Rate limits: https://platform.openai.com/docs/guides/rate-limits
 *          Migration: https://platform.openai.com/docs/guides/migrate-to-responses
 *
 * 3. Hand off the raw model output to verification so schema validation, citation
 *    mapping, and safety checks complete before anything is returned to the client.
 */

import asyncHandler from '../middleware/asyncHandler.js';
import { ingestEmailSubmission } from './ingestController.js';
import { retrieveContextForEmail } from './retrieveController.js';
import { generateCandidateResponses } from './generateController.js';
import { verifyCandidateResponses } from './verifyController.js';
import { createPipelineLogger } from '../utils/pipelineLogger.js';

const createPipelineId = () => `pipe_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;

// ==============================|| Controller - Pipeline ||============================== //

export default {
    // @desc       Run the pipeline scaffold for posted text
    // @route      POST /log-text
    // @access     Public
    logText: asyncHandler(async (req, res) => {
        const pipelineLogger = createPipelineLogger({
            pipelineId: createPipelineId(),
            requestId: req.headers['x-request-id'] || req.body?.requestId || null,
        });

        pipelineLogger.info('Pipeline request received', {
            route: req.originalUrl,
            method: req.method,
            ip: req.ip,
            userAgent: req.get('user-agent') || null,
        }, '👀');

        const ingestStage = pipelineLogger.stage('Ingest');
        ingestStage.queued();
        const ingestResult = await ingestStage.run(
            () => ingestEmailSubmission(req.body),
            {
                waitMessage: 'Waiting for ingest service to normalize payload…',
                waitEmoji: '🫸',
                successMessage: 'Ingest stage complete. Moving on to retrieval…',
                successEmoji: '✔️',
                timerEmoji: '⏲️',
            },
        );

        const {
            body: normalizedBody,
            metadata: { subject, sender },
        } = ingestResult.normalizedEmail;

        const senderLabel = sender?.displayName || sender?.emailAddress || 'Unknown sender';
        const preview = normalizedBody.replace(/\s+/g, ' ').trim().slice(0, 200);

        pipelineLogger.emailSummary({
            from: senderLabel,
            subject: subject || '(no subject)',
            preview: `${preview}${normalizedBody.length > 200 ? '…' : ''}`,
            totalCharacters: normalizedBody.length,
        });

        if (ingestResult?.ingestTelemetry) {
            pipelineLogger.telemetrySnapshot('Ingest telemetry snapshot', ingestResult.ingestTelemetry);
        }

        if (Array.isArray(ingestResult?.vectorStoreIndex)) {
            pipelineLogger.vectorStoreIndex(ingestResult.vectorStoreIndex);
        }

        const retrievalStage = pipelineLogger.stage('Retrieve');
        retrievalStage.queued();
        const retrievalPlan = await retrievalStage.run(
            () => retrieveContextForEmail(ingestResult.normalizedEmail),
            {
                waitMessage: 'Waiting on retrieval service to assemble context hints…',
                waitEmoji: '⏳',
                successMessage: 'Retrieval stage complete. Now waiting on generation…',
            },
        );

        pipelineLogger.retrievalHints({
            vectorStoreHandles: retrievalPlan?.vectorStoreHandles || [],
            searchHints: retrievalPlan?.searchHints || {},
        });

        const generationStage = pipelineLogger.stage('Generate');
        generationStage.queued();
        const generationPlan = await generationStage.run(
            () => generateCandidateResponses(retrievalPlan),
            {
                waitMessage: 'Waiting for generation service to draft assistant plan…',
                waitEmoji: '⏳',
                successMessage: 'Generation stage complete. Transitioning to verification…',
            },
        );

        pipelineLogger.questionClassification(generationPlan?.questionPlan || null);

        const verificationStage = pipelineLogger.stage('Verify');
        verificationStage.queued();
        const verificationPlan = await verificationStage.run(
            () => verifyCandidateResponses(generationPlan),
            {
                waitMessage: 'Waiting for verification service to review candidate plan…',
                waitEmoji: '⏳',
                successMessage: 'Verification stage complete. Preparing Outlook response payload…',
            },
        );

        const questionPlan = verificationPlan?.questionPlan || null;
        const assistantPlan = questionPlan?.assistantPlan || null;

        const emailResponse = typeof assistantPlan?.emailReply === 'string'
            ? assistantPlan.emailReply
            : null;

        const sourceCitations = Array.isArray(assistantPlan?.sourceCitations)
            ? assistantPlan.sourceCitations.map((citation = {}) => ({
                  url: typeof citation.url === 'string' ? citation.url : null,
                  title: typeof citation.title === 'string' ? citation.title : null,
              }))
            : [];

        pipelineLogger.responsePrepared({ emailResponse, sourceCitations });

        const responsePayload = {
            message: 'Pipeline scaffold executed',
            questionMatch: questionPlan?.match || null,
            assistantResponse: {
                emailResponse,
                sourceCitations,
            },
        };

        res.status(200).json(responsePayload);
    }),
};
