import ApiError from '../errors/ApiError.js';

// Catch unhandled routes and forward to the error handler
export const notFound = (req, res, next) => {
  next(new ApiError(404, `Not Found - ${req.originalUrl}`));
};

// Shape all error responses in one place
export const errorHandler = (err, req, res, next) => {
  const status = err.statusCode || res.statusCode || 500;
  res.status(status); // set the final status code
  res.json({
    status,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'production' ? null : { stack: err.stack }), // stack traces only in dev
  });
};
