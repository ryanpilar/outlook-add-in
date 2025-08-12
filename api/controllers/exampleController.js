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

