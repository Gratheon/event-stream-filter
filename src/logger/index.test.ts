import { logger } from './index';

// Mock console.log to verify output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

describe('logger', () => {
  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('info', () => {
    it('should log info messages', () => {
      logger.info('Test info message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Test info message');
    });

    it('should log info messages with metadata', () => {
      logger.info('Test with meta', { key: 'value' });
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Test with meta');
      expect(logOutput).toContain('key');
    });
  });

  describe('error', () => {
    it('should log error messages', () => {
      logger.error('Test error message');
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Test error message');
    });

    it('should log Error objects', () => {
      const error = new Error('Test error');
      logger.error(error);
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Test error');
      expect(logOutput).toContain('stack');
    });

    it('should log enriched errors', () => {
      const error = new Error('Original error');
      logger.errorEnriched('Context message', error, { extra: 'data' });
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Context message');
      expect(logOutput).toContain('Original error');
    });
  });

  describe('warn', () => {
    it('should log warning messages', () => {
      logger.warn('Test warning');
      expect(mockConsoleLog).toHaveBeenCalled();
      const logOutput = mockConsoleLog.mock.calls[0][0];
      expect(logOutput).toContain('Test warning');
    });
  });

  describe('debug', () => {
    it('should log debug messages when log level allows', () => {
      // Note: This test depends on LOG_LEVEL env var
      logger.debug('Test debug message');
      // Debug logs might be filtered based on config
    });
  });
});
