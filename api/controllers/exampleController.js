/**
 * Example controller placeholder within the staged pipeline architecture
 * ---------------------------------------------------------------------------
 * This module currently exposes a trivial echo endpoint, but it will evolve
 * into the home for auxiliary pipeline capabilities that support the
 * Ingest ➜ Retrieve ➜ Generate ➜ Verify flow. The intent is to demonstrate how
 * controllers in this service should:
 *
 * - Wrap business logic with the shared async error handler so that every stage
 *   reports failures consistently back to the add-in.
 * - Validate inputs up front, mirroring the future ingest contract before work
 *   fans out to retrieval or generation services.
 * - Provide lightweight diagnostic endpoints that exercise the same middleware
 *   stack as the production pipeline, giving us a safe place to probe health,
 *   configuration, or sample prompt scaffolds without touching the core
 *   orchestration controller.
 *
 * As the main log controller gains the retrieval/generation/verification stages,
 * this file will house supporting endpoints (status checks, dry runs, etc.) that
 * keep the pipeline observable and debuggable.
 */
import asyncHandler from '../middleware/asyncHandler.js';
import ApiError from '../utils/ApiError.js';

// ==============================|| Controller - Example ||============================== //

export default {
    // @desc       Simple example endpoint
    // @route      GET /get-example
    // @access     Public
    getExample: asyncHandler(async (req, res) => {
        if (!req.query.ok) { // Demonstrate tossing a 400 when data is missing
            throw new ApiError(400, 'Missing required query parameter: ok');
        }
        res.json({ message: 'Example response' }); // Happy path
    }),
};

