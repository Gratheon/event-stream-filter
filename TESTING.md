# Testing Guide

This document describes the testing infrastructure for the event-stream-filter service.

## Overview

The project includes comprehensive tests to ensure that dependency updates and code changes don't break the service. Tests are automatically run in CI/CD pipelines and can be run locally.

## Test Structure

```
├── src/
│   ├── auth.test.ts              # Unit tests for authentication
│   ├── config/index.test.ts      # Unit tests for configuration
│   ├── logger/index.test.ts      # Unit tests for logging
│   └── schema.test.ts            # GraphQL schema tests
├── test/
│   ├── integration.test.ts       # Build and module loading tests
│   └── health.test.ts            # Health endpoint tests
└── jest.config.js                # Jest configuration
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage
```bash
npm run test:coverage
```

### Run only specific tests
```bash
npm test -- auth.test.ts
```

### Run tests for changed files
```bash
npm test -- --findRelatedTests src/auth.ts
```

## What Tests Cover

### Unit Tests
- **Authentication** (auth.test.ts): JWT token validation, error handling
- **Configuration** (config/index.test.ts): Config loading, environment variables
- **Logger** (logger/index.test.ts): Log levels, error formatting, metadata

### Integration Tests
- **Build verification**: Ensures TypeScript compiles without errors
- **Module loading**: Verifies all dependencies can be imported
- **GraphQL schema**: Tests schema creation and query execution
- **Health endpoint**: Validates HTTP health check functionality

## CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/ci.yml` workflow runs on every push and pull request:

1. **Test Job**: 
   - TypeScript type checking
   - Unit and integration tests
   - Code coverage reporting

2. **Build Job**: 
   - Builds the application
   - Verifies dist output exists

3. **Deploy Job** (main branch only):
   - Runs only if tests and build pass
   - Deploys to production

### Deployment Protection

The deployment will **fail** if:
- Any test fails
- TypeScript type checking fails
- Build process fails
- Build output is missing

## Git Hooks

### Pre-commit Hook

A lightweight pre-commit hook runs automatically before each commit:

```bash
# Setup hooks (one-time)
./setup-hooks.sh
```

The hook runs:
- TypeScript type checking (no compilation, fast)
- Tests for files being committed
- No Docker container testing (kept fast)

### Bypass hooks (not recommended)
```bash
git commit --no-verify
```

## Test Configuration

### jest.config.js

Key settings:
- Uses `ts-jest` for TypeScript support
- 10-second timeout for tests
- Coverage collection from `src/**/*.ts`
- Excludes main entry point (covered by integration tests)

### Coverage Thresholds

Coverage reports are generated but not enforced. To add enforcement, update `jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  }
}
```

## Adding New Tests

### Unit Test Example

```typescript
// src/mymodule.test.ts
describe('MyModule', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Integration Test Example

```typescript
// test/myfeature.test.ts
describe('MyFeature Integration', () => {
  it('should integrate correctly', async () => {
    const result = await someAsyncOperation();
    expect(result).toBeDefined();
  });
});
```

## Debugging Tests

### Run with verbose output
```bash
npm test -- --verbose
```

### Run specific test with debugging
```bash
node --inspect-brk node_modules/.bin/jest --runInBand auth.test.ts
```

### See test coverage for specific file
```bash
npm test -- --coverage --collectCoverageFrom=src/auth.ts
```

## Dependencies

Test-related dependencies:
- `jest`: Test runner
- `ts-jest`: TypeScript preprocessor for Jest
- `@types/jest`: TypeScript types for Jest
- `supertest`: HTTP assertions for testing Express
- `@types/supertest`: TypeScript types for supertest

## Troubleshooting

### Tests fail locally but pass in CI
- Ensure dependencies are installed: `npm ci`
- Check Node.js version matches CI (v18)

### Type checking fails
- Run `npm run lint` to see TypeScript errors
- Update TypeScript types: `npm install --save-dev @types/[package]`

### Coverage reports not generated
- Ensure `coverage` directory is not in `.gitignore`
- Run with `--coverage` flag explicitly

## Best Practices

1. **Write tests for new features**: All new code should have corresponding tests
2. **Update tests when changing code**: Keep tests in sync with implementation
3. **Test edge cases**: Include error cases and boundary conditions
4. **Keep tests fast**: Mock external dependencies (Redis, databases)
5. **Use descriptive test names**: Test names should explain what is being tested
6. **Don't skip CI**: Never merge PRs with failing tests

## Future Improvements

Potential enhancements:
- Add E2E tests with real WebSocket connections
- Add performance/load tests
- Add mutation testing
- Increase coverage thresholds
- Add visual regression testing for GraphiQL UI
