import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute window

function getClientIdentifier(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const email = (req.body && req.body.email) ? req.body.email.trim().toLowerCase() : '';
  return `${ip}::${email}`;
}

/**
 * Middleware to check if client has exceeded allowed failed login attempts
 */
export function checkLoginRateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getClientIdentifier(req);
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (record) {
    if (now > record.resetAt) {
      // Window expired, reset
      loginAttempts.delete(key);
    } else if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      const waitSeconds = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        error: `Too many failed login attempts. Please wait ${waitSeconds} seconds before trying again.`,
        retryAfter: waitSeconds,
      });
    }
  }

  next();
}

/**
 * Record a failed login attempt
 */
export function recordFailedLogin(req: Request) {
  const key = getClientIdentifier(req);
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { attempts: 1, resetAt: now + WINDOW_MS });
  } else {
    record.attempts += 1;
  }
}

/**
 * Clear failed login attempts upon successful authentication
 */
export function clearLoginAttempts(req: Request) {
  const key = getClientIdentifier(req);
  loginAttempts.delete(key);
}

/**
 * Reset all rate limits (useful for test suites)
 */
export function resetRateLimits() {
  loginAttempts.clear();
}
