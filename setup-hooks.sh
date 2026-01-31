# Setup Script for Git Hooks

echo "🔧 Setting up git hooks..."

# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/.githooks"

# Check if .githooks directory exists
if [ ! -d "$HOOKS_DIR" ]; then
    echo "❌ Error: .githooks directory not found"
    exit 1
fi

# Make hooks executable
chmod +x "$HOOKS_DIR"/*

# Configure git to use the custom hooks directory
git config core.hooksPath .githooks

echo "✅ Git hooks installed successfully!"
echo ""
echo "Pre-commit hook will now run automatically before each commit."
echo "It will check:"
echo "  - TypeScript type checking"
echo "  - Unit tests for changed files"
echo ""
echo "To bypass the hooks (not recommended), use: git commit --no-verify"
