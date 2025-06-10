#!/bin/sh
# Git hooks installation script
# This script installs the pre-commit hook for all team members

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
PRE_COMMIT_HOOK="$HOOKS_DIR/pre-commit"
SOURCE_HOOK="$SCRIPT_DIR/pre-commit-hook.sh"

# Colors for output
print_red() { printf '\033[0;31m%s\033[0m\n' "$1"; }
print_green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
print_yellow() { printf '\033[1;33m%s\033[0m\n' "$1"; }

print_yellow "🔧 Installing Git pre-commit hook..."

# Check if we're in a git repository
if [ ! -d "$HOOKS_DIR" ]; then
    print_red "❌ Error: Not in a Git repository or .git/hooks directory not found"
    exit 1
fi

# Check if source hook exists
if [ ! -f "$SOURCE_HOOK" ]; then
    print_red "❌ Error: Source hook not found at $SOURCE_HOOK"
    exit 1
fi

# Backup existing pre-commit hook if it exists
if [ -f "$PRE_COMMIT_HOOK" ]; then
    BACKUP_FILE="$PRE_COMMIT_HOOK.backup.$(date +%Y%m%d_%H%M%S)"
    print_yellow "📄 Backing up existing pre-commit hook to: $BACKUP_FILE"
    cp "$PRE_COMMIT_HOOK" "$BACKUP_FILE"
fi

# Copy the hook
print_yellow "📋 Copying pre-commit hook..."
cp "$SOURCE_HOOK" "$PRE_COMMIT_HOOK"

# Make the hook executable
print_yellow "🔐 Making hook executable..."
chmod +x "$PRE_COMMIT_HOOK"

# Verify installation
if [ -x "$PRE_COMMIT_HOOK" ]; then
    print_green "✅ Pre-commit hook installed successfully!"
    print_green "🎯 The hook will now automatically format your code before each commit."
    print_yellow "💡 To test the hook, try committing a file with poor formatting."
else
    print_red "❌ Error: Failed to install pre-commit hook"
    exit 1
fi
