export const allowedOrigins = [
    'https://outlook-add-in-ui.onrender.com',
    'https://outlook-add-in-kdr8.onrender.com',
    'http://localhost:5173',
    'https://localhost:5173',
    'http://localhost:3000',
    'https://localhost:3000',
    'http://localhost:4000'
];

export const checkCorsOrigin = function (req, callback) {
    const origin = req.header('Origin');
    let corsOptions;
    if (allowedOrigins.includes(origin)) {
        corsOptions = {origin: true};  // Allow
    } else {
        corsOptions = {origin: false}; // Decline
    }
    callback(null, corsOptions);
};
