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

// ==============================|| Controller - Pipeline ||============================== //

export default {
    // @desc       Run the pipeline scaffold for posted text
    // @route      POST /log-text
    // @access     Public
    logText: asyncHandler(async (req, res) => {
        const ingestResult = await ingestEmailSubmission(req.body);

        const {
            body: normalizedBody,
            metadata: { subject, sender },
        } = ingestResult.normalizedEmail;

        const senderLabel = sender?.displayName || sender?.emailAddress || 'Unknown sender';
        const preview = normalizedBody.replace(/\s+/g, ' ').trim().slice(0, 200);

        console.info('📬  Email submission received from Outlook add-in');
        console.info(`     From   : ${senderLabel}`);
        console.info(`     Subject: ${subject || '(no subject)'}`);
        console.info(
            `     Preview: ${preview}${normalizedBody.length > 200 ? '…' : ''}`
        );

        const retrievalPlan = await retrieveContextForEmail(ingestResult.normalizedEmail);
        const generationPlan = await generateCandidateResponses(retrievalPlan);
        const verificationPlan = await verifyCandidateResponses(generationPlan);

        const questionPlan = verificationPlan?.questionPlan || null;

        res.status(200).json({
            message: 'Pipeline scaffold executed',
            questionMatch: questionPlan?.match || null,
            assistantPlan: questionPlan?.assistantPlan || null,
            approvedQuestions: questionPlan?.approvedQuestions || [],
            pipeline: {
                ingest: ingestResult,
                retrieve: retrievalPlan,
                generate: generationPlan,
                verify: verificationPlan,
            },
        });
    }),
};
