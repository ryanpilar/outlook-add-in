/**
 * Pipeline Controller Bridge
 * ---------------------------------------------------------------------------
 * Thin HTTP adapter that delegates Outlook add-in submissions to the domain
 * pipeline orchestrator. Centralizing orchestration inside `api/pipeline`
 * keeps this controller focused on transport concerns while still exposing the
 * full Ingest ➜ Retrieve ➜ Generate ➜ Verify flow to clients.
 */

import asyncHandler from '../middleware/asyncHandler.js';
import { runPipeline } from '../../pipeline/orchestrator.js';

// ==============================|| Controller - Pipeline ||============================== //

export default {
    // @desc       Run the pipeline scaffold for posted text
    // @route      POST /log-text
    // @access     Public
    logText: asyncHandler(async (req, res) => {
        const { responsePayload } = await runPipeline(req.body);

        res.status(200).json(responsePayload);
    }),
};
