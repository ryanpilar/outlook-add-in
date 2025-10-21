import cors from 'cors';
import path from 'path';
import express from 'express';
import morgan from 'morgan';
import { fileURLToPath } from 'url';

import router from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';
import { checkCorsOrigin } from './config/corsPolicy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicAssetsPath = path.join(__dirname, '../public');

export const createHttpApp = () => {
    const app = express();

    // -------------------- CORS POLICY ---------------------- //
    app.use(cors(checkCorsOrigin));

    // --------------- BODY PARSER MIDDLEWARE ---------------- //
    app.use(express.urlencoded({ extended: false }));
    app.use(express.json());

    // ----------------- LOGGING MIDDLEWARE ------------------ //
    if (process.env.NODE_ENV === 'development') {
        app.use(morgan('dev'));
    }

    // -------------------- Static Assets -------------------- //
    app.use(express.static(publicAssetsPath));

    // ------------------------ Routes ----------------------- //
    app.use('/', router);

    // -------------------- Error Handling ------------------- //
    app.use(notFound);
    app.use(errorHandler);

    return app;
};

export default createHttpApp;
