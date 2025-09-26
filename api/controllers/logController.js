/**
 * Pipeline Orchestrator Controller
 * ---------------------------------------------------------------------------
 * This controller sequences the planned Ingest ➜ Retrieve ➜ Generate ➜ Verify
 * flow for the Outlook add-in. Once the stage controllers are fully
 * implemented, the orchestrator will:
 *
 * 1. Ensure the normalized payload and vector-store metadata produced during
 *    ingestion are threaded through retrieval so the correct OpenAI file
 *    collections are exposed to the Responses API.
 * 2. Coordinate the single `POST /v1/responses` call (with `file_search`) that
 *    drafts three variants, capturing tool-call telemetry and handling retries
 *    or fallbacks when OpenAI throttles.
 * 3. Hand off the raw model output to verification so schema validation,
 *    citation mapping, and safety checks complete before anything is returned to
 *    the client.
 *
 * For now the controller simply invokes the scaffolds to document the intended
 * data flow. As functionality arrives, this file becomes the authoritative entry
 * point that glues the stages together and centralizes cross-cutting concerns
 * like tracing, error handling, and latency measurement.
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
        const retrievalPlan = await retrieveContextForEmail(ingestResult.normalizedEmail);
        const generationPlan = await generateCandidateResponses(retrievalPlan);
        const verificationPlan = await verifyCandidateResponses(generationPlan);

        res.status(200).json({
            message: 'Pipeline scaffold executed',
            pipeline: {
                ingest: ingestResult,
                retrieve: retrievalPlan,
                generate: generationPlan,
                verify: verificationPlan,
            },
        });
    }),
};
