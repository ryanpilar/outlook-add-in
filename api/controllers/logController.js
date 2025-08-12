import asyncHandler from '../middleware/asyncHandler.js';

// ==============================|| Controller - Log ||============================== //

export default {
    // @desc       Log posted text
    // @route      POST /log-text
    // @access     Public
    logText: asyncHandler(async (req, res) => {
        const { text } = req.body;
        console.log('Received text:', text);
        res.status(200).json({ message: 'Text logged' });
    }),
};

