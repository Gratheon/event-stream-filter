import jwt from 'jsonwebtoken';

import config from './config';
import { logger } from './logger';

// security check
export async function getUserIdByToken(token: string): Promise<string> {
  // Validate token is provided
  if (!token) {
    const error = new Error('Authentication token is missing');
    logger.error('JWT authentication failed: No token provided');
    throw error;
  }

  try {
    const decoded = await (new Promise<{ user_id: string }>((resolve, reject) => jwt.verify(
      token,
      config.privateKey,
      function (err, decoded) {
        if (err) {
          reject(err);
        }
        resolve(decoded as { user_id: string });
      })));

    if (!decoded?.user_id) {
      const error = new Error('Token does not contain user_id');
      logger.error('JWT authentication failed: Token missing user_id', { decoded });
      throw error;
    }

    return decoded.user_id as string;
  } catch (err: any) {
    // Log JWT-specific errors with more context
    if (err.name === 'JsonWebTokenError') {
      logger.error('JWT verification failed', { error: err.message, tokenProvided: !!token });
    } else if (err.name === 'TokenExpiredError') {
      logger.error('JWT token expired', { expiredAt: err.expiredAt });
    } else if (err.message && !err.message.includes('Token does not contain user_id') && !err.message.includes('Authentication token is missing')) {
      logger.error('JWT authentication error', { error: err.message, name: err.name });
    }
    throw err;
  }
}