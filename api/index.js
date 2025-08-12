import cors from 'cors';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorMiddleware.js';

dotenv.config(); // Pull in environment variables

const app = express(); // Kick off Express

const corsOptionsDelegate = function (req, callback) {
    let corsOptions;
    if (req.header('Origin') === process.env.CLIENT_URL) {
        corsOptions = { origin: true }; // Allow only the configured client
    } else {
        corsOptions = { origin: false }; // Deny strangers
    }
    callback(null, corsOptions);
};

app.use(cors(corsOptionsDelegate)); // Enforce CORS per request

// --------------- BODY PARSER MIDDLEWARE ---------------- //
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ----------------- LOGGING MIDDLEWARE ------------------ //
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// -------------------- Static Assets -------------------- //
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, 'public')));

// ------------------------ Routes ----------------------- //
app.use('/', router); // Mount all API routes here

// ----------------------- Error Handling ----------------------- //
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(
    PORT,
    () => console.log(`Server running in ${process.env.NODE_ENV} mode, on port ${PORT}`)
);

export default app;

