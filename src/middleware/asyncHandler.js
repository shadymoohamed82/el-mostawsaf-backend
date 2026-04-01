/**
 * Wraps async controller functions to automatically
 * catch errors and forward them to errorHandler middleware
 * 
 * بدله من كتابة try/catch في كل controller
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;