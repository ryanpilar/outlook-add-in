import asyncHandler from '../middleware/asyncHandler.js';
import normalizeEmailPayload from '../utils/normalizeEmailPayload.js';

// ==============================|| Controller - Log ||============================== //

export default {
    // @desc       Log posted text
    // @route      POST /log-text
    // @access     Public
    logText: asyncHandler(async (req, res) => {
        // Normalize the incoming email before any downstream processing so every
        // subsequent step (retrieval, generation, persistence) receives a clean,
        // predictable payload shape.
        const normalizedEmail = normalizeEmailPayload(req.body);

        console.log('----- Email payload received from add-in -----');
        console.log(JSON.stringify(normalizedEmail, null, 2));
        console.log('----------------------------------------------');

        res.status(200).json({
            message: 'Email context normalized',
            email: normalizedEmail,
        });
    }),
};

