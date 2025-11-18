const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (err) {
      // Future Task: centralized logging
      console.error('Controller error:', err);
      next(err);
    }
  };
};

module.exports = { asyncHandler };
