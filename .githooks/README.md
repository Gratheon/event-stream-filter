# Git Hooks

This directory contains git hooks for the project.

## Setup

To enable these hooks, run:

```bash
git config core.hooksPath .githooks
```

Or if you prefer to copy them to `.git/hooks/`:

```bash
cp .githooks/* .git/hooks/
chmod +x .git/hooks/*
```

## Available Hooks

### pre-commit

Runs lightweight checks before each commit:
- TypeScript type checking (no compilation)
- Unit tests for changed files only
- No Docker container testing (fast execution)

This ensures that commits don't break the build or tests without being too slow.

## Manual Installation

If the hooks are not being executed:

1. Make sure the hooks are executable:
   ```bash
   chmod +x .githooks/pre-commit
   ```

2. Configure git to use the custom hooks directory:
   ```bash
   git config core.hooksPath .githooks
   ```

## Bypassing Hooks

If you need to bypass the hooks (not recommended):
```bash
git commit --no-verify
```
