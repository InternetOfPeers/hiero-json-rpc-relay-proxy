const fs = require('fs');
const path = require('path');

// Colors for console output (cross-platform)
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m',
};

function printColor(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

printColor('yellow', '🔧 Installing Git pre-commit hook...');

// Check if we're in a git repository
const gitDir = path.join(process.cwd(), '.git');
if (!fs.existsSync(gitDir)) {
  printColor('red', '❌ Error: Not in a Git repository');
  process.exit(1);
}

// Create .git/hooks directory if it doesn't exist
const hooksDir = path.join(gitDir, 'hooks');
if (!fs.existsSync(hooksDir)) {
  try {
    fs.mkdirSync(hooksDir, { recursive: true });
    printColor('green', '📁 Created .git/hooks directory');
  } catch (error) {
    printColor('red', `❌ Failed to create hooks directory: ${error.message}`);
    process.exit(1);
  }
}

// Read the pre-commit hook template
const preCommitHookPath = path.join(hooksDir, 'pre-commit');

// Pre-commit hook content
const preCommitHookContent = `#!/bin/sh

# Pre-commit hook to format code before committing
# This hook will run Prettier on staged files and re-stage them if formatting changes are made

echo "🔍 Running pre-commit formatting checks..."

# Check if npm is available
if ! command -v npm >/dev/null 2>&1; then
    echo "❌ npm is not installed. Skipping formatting."
    exit 1
fi

# Get list of staged files (only .js, .ts, .json, .md files)
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|ts|json|md)$')

if [ -z "$STAGED_FILES" ]; then
    echo "✅ No relevant files staged for commit."
    exit 0
fi

echo "📝 Checking format for staged files..."

# Check if prettier would make changes
npm run format:check -- $STAGED_FILES
FORMAT_CHECK_RESULT=$?

if [ $FORMAT_CHECK_RESULT -ne 0 ]; then
    echo "⚠️  Some files are not properly formatted."
    echo "🔧 Running prettier to fix formatting..."
    
    # Format the staged files
    npm run format -- $STAGED_FILES
    
    # Re-stage the formatted files
    echo "📥 Re-staging formatted files..."
    echo "$STAGED_FILES" | xargs git add
    
    echo "✅ Files have been formatted and re-staged."
    echo "💡 Please review the changes and commit again."
    exit 0
else
    echo "✅ All staged files are properly formatted."
fi

echo "✅ Pre-commit checks passed!"
exit 0
`;

try {
  fs.writeFileSync(preCommitHookPath, preCommitHookContent);
  printColor('green', '📝 Created pre-commit hook');

  // Make the hook executable (Unix-like systems only)
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(preCommitHookPath, '755');
      printColor('green', '🔐 Made pre-commit hook executable');
    } catch (error) {
      printColor(
        'yellow',
        `⚠️  Could not make hook executable: ${error.message}`
      );
    }
  } else {
    printColor('yellow', '⚠️  On Windows: hook permissions handled by Git');
  }

  printColor('green', '✅ Git hooks installed successfully!');
  printColor(
    'yellow',
    '💡 The pre-commit hook will now run Prettier on your staged files before each commit.'
  );
} catch (error) {
  printColor('red', `❌ Failed to install pre-commit hook: ${error.message}`);
  process.exit(1);
}
