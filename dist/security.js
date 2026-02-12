// Security middleware and utilities for Forge
import { RateLimiterMemory } from 'rate-limiter-flexible';
// Rate limiter: 100 requests per minute per IP (increased for swarm polling)
const rateLimiter = new RateLimiterMemory({
    points: 100,
    duration: 60,
});
export async function rateLimit(req, res, next) {
    // Skip rate limiting for swarm status/events endpoints (high-frequency polling)
    if (req.path.match(/^\/api\/swarm\/[^/]+\/(status|events)$/)) {
        return next();
    }
    try {
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        await rateLimiter.consume(ip);
        next();
    }
    catch {
        res.status(429).json({ error: 'Too many requests. Slow down.' });
    }
}
// Allowed emails for Cloudflare Access authentication
const ALLOWED_CF_EMAILS = [
    'ryan.helton@gmail.com',
    'ryan.helton@pnmac.com',
];
// Token auth middleware with Cloudflare Access support
export function tokenAuth(validToken) {
    return (req, res, next) => {
        // Skip auth for static files and health check
        if (req.path === '/' || req.path.startsWith('/assets') || req.path === '/api/health') {
            return next();
        }
        // Check Cloudflare Access headers first
        const cfEmail = req.headers['cf-access-authenticated-user-email'];
        if (cfEmail && ALLOWED_CF_EMAILS.includes(cfEmail.toLowerCase())) {
            // Authenticated via Cloudflare Access - trust it
            return next();
        }
        // Fall back to token auth
        const authHeader = req.headers.authorization;
        const queryToken = req.query.token;
        const token = authHeader?.replace('Bearer ', '') || queryToken;
        if (!token || token !== validToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        next();
    };
}
// Input sanitization
export function sanitizeInput(input, maxLength = 10000) {
    if (typeof input !== 'string')
        return '';
    // Trim and limit length
    let sanitized = input.trim().slice(0, maxLength);
    // Remove null bytes and control characters (except newlines/tabs)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return sanitized;
}
// Security headers middleware
export function securityHeaders(req, res, next) {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    // Prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // XSS protection
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Referrer policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'");
    next();
}
// Generate a secure random token
export function generateToken(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const randomValues = new Uint32Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        token += chars[randomValues[i] % chars.length];
    }
    return token;
}
