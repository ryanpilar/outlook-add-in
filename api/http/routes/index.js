import express from 'express';

import pipelineRoutes from './pipeline.js';
import exampleRoutes from './example.js';

const router = express.Router();

// ==============================|| Routes - Index ||============================== //

router.use('/', pipelineRoutes);
router.use('/', exampleRoutes);

export default router;
