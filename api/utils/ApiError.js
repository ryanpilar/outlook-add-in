// Tiny helper that carries an HTTP status code alongside the message
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode; // preserve the intended HTTP status
    Error.captureStackTrace(this, this.constructor); // exclude constructor from stack
  }
}

export default ApiError;
