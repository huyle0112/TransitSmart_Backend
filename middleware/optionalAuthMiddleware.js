const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not set. Please configure the environment variable.');
}

/**
 * Optional Authentication Middleware
 * - If token is present and valid, populates req.user
 * - If token is missing or invalid, continues without req.user
 * - Does NOT block unauthenticated requests
 */
module.exports = function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    // No token provided - continue without authentication
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Populate req.user if token is valid
        req.user = { ...decoded, isAdmin: Boolean(decoded?.isAdmin) };
    } catch (err) {
        // Token is invalid - continue without authentication
        console.log('Invalid token in optional auth middleware:', err.message);
    }

    next();
};
