import express from 'express'
import exampleController from "../controllers/exampleController.js";

const router = express.Router()

// ==============================|| Routes - Index ||============================== //


router.get('/get-example', exampleController.getExample);

export default router
