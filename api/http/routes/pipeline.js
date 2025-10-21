import express from 'express';
import pipelineController from '../controllers/logController.js';

const router = express.Router();

// ==============================|| Routes - Pipeline ||============================== //

router.post('/log-text', pipelineController.logText);

export default router;
