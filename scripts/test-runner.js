const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Get command line arguments
const args = process.argv.slice(2);
const testDir = args[0] || 'test';
const nodeArgs = args.slice(1);

// Find all test files
const testPath = path.resolve(testDir);
if (!fs.existsSync(testPath)) {
  console.error(`Test directory not found: ${testPath}`);
  process.exit(1);
}

const testFiles = fs
  .readdirSync(testPath)
  .filter(file => file.endsWith('.test.js'))
  .map(file => path.join(testPath, file));

if (testFiles.length === 0) {
  console.error(`No test files found in: ${testPath}`);
  process.exit(1);
}

// Run Node.js test runner with the found files
const nodeCommand = process.execPath;
const finalArgs = ['--test', ...nodeArgs, ...testFiles];

console.log(`Running tests: ${testFiles.length} files found`);

const child = spawn(nodeCommand, finalArgs, {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', code => {
  process.exit(code);
});

child.on('error', error => {
  console.error('Error running tests:', error);
  process.exit(1);
});
