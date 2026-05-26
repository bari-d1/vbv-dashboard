module.exports = function vbvRoleMiddleware(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.vbvUser?.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
};
