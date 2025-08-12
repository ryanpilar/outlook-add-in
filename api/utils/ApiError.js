
/** ================|| ApiError - Custom Error Class ||================
 *
 * Represents an application-specific error for API responses.
 *
 * Extends the native Error object with:
 *  - An HTTP status code for client responses
 *  - A cleaner stack trace that omits the constructor itself
 *
 * Useful for throwing errors in routes or services where both a message
 * and HTTP status need to be returned.
 */

// Helper that carries an HTTP status code alongside the message
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);

    // Preserve the intended HTTP status
    this.statusCode = statusCode;

    // Exclude constructor from stack
    Error.captureStackTrace(this, this.constructor);
  }
}

export default ApiError;
