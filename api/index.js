import cors from 'cors';
import path from 'path';
import express from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import {fileURLToPath} from 'url';
import router from './routes/index.js';
import {notFound, errorHandler} from './middleware/errorMiddleware.js';

dotenv.config();

const app = express();

// -------------------- CORS POLICY --------------------- //

const allowedOrigins = [
    'https://outlook-add-in-ui.onrender.com',
    'https://outlook-add-in-kdr8.onrender.com',
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:4000'
]

const checkCorsOrigin = function (req, callback) {
    const origin = req.header('Origin');
    let corsOptions;
    if (allowedOrigins.includes(origin)) {
        corsOptions = {origin: true};  // Allow
    } else {
        corsOptions = {origin: false}; // Decline
    }
    callback(null, corsOptions);
};
app.use(cors(checkCorsOrigin));

// --------------- BODY PARSER MIDDLEWARE ---------------- //
app.use(express.urlencoded({extended: false}));
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
app.use('/', router);

// -------------------- Error Handling ------------------- //
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(
    PORT,
    () => console.log(`Server running in ${process.env.NODE_ENV} mode, on port ${PORT}`)
);

export default app;

