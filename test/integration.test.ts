/**
 * Integration tests for build and startup
 * These tests ensure the service can build and basic functionality works
 */

describe('Build and Start Integration', () => {
  it('should import main modules without errors', async () => {
    // Test that core modules can be imported
    expect(() => require('../src/auth')).not.toThrow();
    expect(() => require('../src/config')).not.toThrow();
    expect(() => require('../src/logger')).not.toThrow();
  });

  it('should have all required dependencies available', () => {
    // Test critical dependencies can be loaded
    expect(() => require('express')).not.toThrow();
    expect(() => require('graphql')).not.toThrow();
    expect(() => require('jsonwebtoken')).not.toThrow();
    expect(() => require('@graphql-tools/schema')).not.toThrow();
  });

  it('should export required functions from auth module', () => {
    const auth = require('../src/auth');
    expect(typeof auth.getUserIdByToken).toBe('function');
  });

  it('should export logger with required methods', () => {
    const { logger } = require('../src/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.errorEnriched).toBe('function');
  });

  it('should export config object', () => {
    const config = require('../src/config').default;
    expect(config).toBeDefined();
    expect(config).toHaveProperty('privateKey');
    expect(config).toHaveProperty('sentryDsn');
    expect(config).toHaveProperty('logLevel');
  });
});
