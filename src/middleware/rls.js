// بعد الـ auth middleware، الـ user بقى في req.user من الـ JWT
// بس لو في dev mode وفيش token، هيستخدم الـ DEV values
function rlsMiddleware(req, res, next) {
  // req.user جاي من auth.js middleware
  // مش محتاجين نعمل حاجة تانية
  next();
}

module.exports = rlsMiddleware;