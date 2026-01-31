describe('config', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.ENV_ID;
    // Clear the module cache to allow re-importing with different ENV_ID
    jest.resetModules();
  });

  afterEach(() => {
    process.env.ENV_ID = originalEnv;
  });

  it('should load default config when ENV_ID is not set', () => {
    delete process.env.ENV_ID;
    const config = require('./index').default;
    expect(config).toBeDefined();
    expect(config.privateKey).toBeDefined();
    expect(config.sentryDsn).toBeDefined();
    expect(config.logLevel).toBeDefined();
  });

  it('should have correct default values', () => {
    delete process.env.ENV_ID;
    const config = require('./index').default;
    expect(config.privateKey).toBe('');
    expect(config.sentryDsn).toBe('');
    expect(config.logLevel).toBe('info');
  });

  it('should respect LOG_LEVEL environment variable', () => {
    delete process.env.ENV_ID;
    process.env.LOG_LEVEL = 'debug';
    jest.resetModules();
    const config = require('./index').default;
    expect(config.logLevel).toBe('debug');
  });

  it('should export get function', () => {
    const { get } = require('./index');
    expect(typeof get).toBe('function');
  });

  it('should get config values using get function', () => {
    const { get } = require('./index');
    expect(get('logLevel')).toBeDefined();
    expect(get('privateKey')).toBeDefined();
    expect(get('sentryDsn')).toBeDefined();
  });
});
