#!/bin/sh

# Pre-commit hook to format code before committing
# This hook will run Prettier on staged files and re-stage them if formatting changes are made

echo "🔍 Running pre-commit formatting checks..."

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed. Skipping formatting."
    exit 1
fi

# Get list of staged JavaScript/TypeScript files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|ts|json|md)$')

if [ -z "$STAGED_FILES" ]; then
    echo "✅ No relevant files to format."
    exit 0
fi

echo "📝 Found files to format:"
echo "$STAGED_FILES"

# Store the current working directory
ORIGINAL_DIR=$(pwd)

# Run Prettier on staged files
echo "🎨 Running Prettier..."
if npm run format >/dev/null 2>&1; then
    echo "✅ Prettier formatting completed successfully."
else
    echo "❌ Prettier formatting failed. Please fix the issues and try again."
    exit 1
fi

# Check if any files were modified by Prettier
MODIFIED_FILES=""
for FILE in $STAGED_FILES; do
    if [ -f "$FILE" ]; then
        # Check if the file was modified by comparing timestamps or git status
        if git diff --name-only | grep -q "^$FILE$"; then
            MODIFIED_FILES="$MODIFIED_FILES $FILE"
        fi
    fi
done

# If files were modified, re-stage them
if [ -n "$MODIFIED_FILES" ]; then
    echo "📥 Re-staging formatted files:"
    for FILE in $MODIFIED_FILES; do
        echo "   - $FILE"
        git add "$FILE"
    done
    echo "✅ Formatted files have been re-staged."
else
    echo "✅ No formatting changes needed."
fi

echo "🚀 Pre-commit hook completed successfully!"
exit 0
