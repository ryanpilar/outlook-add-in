// Funnel async errors to Express so we don't litter routes with try/catch
const asyncHandler = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (err) {
    next(err); // Hand off to the centralized error middleware
  }
};

export default asyncHandler;
