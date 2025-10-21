import express from 'express';
import exampleController from '../../controllers/exampleController.js';
import logController from '../../controllers/logController.js';

const router = express.Router();

// ==============================|| Routes - Index ||============================== //

router.get('/get-example', exampleController.getExample);
router.post('/log-text', logController.logText);

export default router;
