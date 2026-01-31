import { getUserIdByToken } from './auth';

// Mock jsonwebtoken module
const mockVerify = jest.fn();
jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: {
    verify: (...args: any[]) => mockVerify(...args),
  },
  verify: (...args: any[]) => mockVerify(...args),
}));

// Mock the config module
jest.mock('./config', () => ({
  __esModule: true,
  default: {
    privateKey: 'test-secret-key',
  },
}));

// Mock the logger module
jest.mock('./logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('auth', () => {
  describe('getUserIdByToken', () => {
    const testUserId = 'user-123';

    beforeEach(() => {
      mockVerify.mockClear();
    });

    it('should return user_id from valid token', async () => {
      mockVerify.mockImplementation((token, secret, callback) => {
        callback(null, { user_id: testUserId });
      });

      const userId = await getUserIdByToken('valid-token');
      expect(userId).toBe(testUserId);
      expect(mockVerify).toHaveBeenCalled();
    });

    it('should throw error when token is empty', async () => {
      await expect(getUserIdByToken('')).rejects.toThrow('Authentication token is missing');
    });

    it('should throw error when token is invalid', async () => {
      mockVerify.mockImplementation((token, secret, callback) => {
        callback(new Error('invalid token'));
      });

      await expect(getUserIdByToken('invalid-token')).rejects.toThrow();
    });

    it('should throw error when token verification fails', async () => {
      mockVerify.mockImplementation((token, secret, callback) => {
        const error: any = new Error('jwt malformed');
        error.name = 'JsonWebTokenError';
        callback(error);
      });

      await expect(getUserIdByToken('malformed-token')).rejects.toThrow();
    });

    it('should throw error when token does not contain user_id', async () => {
      mockVerify.mockImplementation((token, secret, callback) => {
        callback(null, { other_field: 'value' });
      });

      await expect(getUserIdByToken('token-without-userid')).rejects.toThrow('Token does not contain user_id');
    });

    it('should throw error when token is expired', async () => {
      mockVerify.mockImplementation((token, secret, callback) => {
        const error: any = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        error.expiredAt = new Date();
        callback(error);
      });

      await expect(getUserIdByToken('expired-token')).rejects.toThrow();
    });
  });
});
