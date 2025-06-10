#!/usr/bin/env node

/**
 * Enhanced test runner that provides comprehensive summary after running all tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// ANSI color codes for colorful output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Test result tracking
const testResults = {
  workspaces: [],
  integration: null,
  startTime: Date.now(),
  totalPassed: 0,
  totalFailed: 0,
  totalSkipped: 0,
  totalDuration: 0,
};

/**
 * Format duration in a human-readable way
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(2)}m`;
}

/**
 * Print colored text
 */
function colorLog(color, text) {
  console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Run tests for a specific workspace
 */
function runWorkspaceTests(workspaceName) {
  return new Promise(resolve => {
    const startTime = Date.now();
    colorLog('blue', `\n📦 Running ${workspaceName} tests...`);

    // Use the same approach as the original package.json
    const child = spawn(
      'npm',
      ['test', `--workspace=packages/${workspaceName}`],
      {
        stdio: ['inherit', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', data => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    child.on('close', code => {
      const duration = Date.now() - startTime;

      // Parse results from output - look for the final summary
      let passed = 0,
        failed = 0,
        skipped = 0;

      // Look for the final test summary in the format "# tests 180"
      const testSummaryMatch = stdout.match(/# tests (\d+)/);
      const passMatch = stdout.match(/# pass (\d+)/);
      const failMatch = stdout.match(/# fail (\d+)/);
      const skipMatch = stdout.match(/# skipped (\d+)/);
      const cancelMatch = stdout.match(/# cancelled (\d+)/);

      if (testSummaryMatch && passMatch) {
        const totalTests = parseInt(testSummaryMatch[1]) || 0;
        passed = parseInt(passMatch[1]) || 0;
        failed = parseInt(failMatch[1]) || 0;
        skipped = parseInt(skipMatch[1]) || 0;
        const cancelled = parseInt(cancelMatch[1]) || 0;

        // Add cancelled to skipped for simplicity
        skipped += cancelled;
      } else {
        // Fallback: Count individual test result symbols
        const passSymbols = (stdout.match(/✓/g) || []).length;
        const failSymbols = (stdout.match(/✗/g) || []).length;
        const skipSymbols = (stdout.match(/↓/g) || []).length;

        passed = passSymbols;
        failed = failSymbols;
        skipped = skipSymbols;
      }

      const result = {
        name: workspaceName,
        passed,
        failed,
        skipped,
        duration,
        exitCode: code,
        stdout,
        stderr,
      };

      testResults.workspaces.push(result);
      testResults.totalPassed += passed;
      testResults.totalFailed += failed;
      testResults.totalSkipped += skipped;

      const status = code === 0 ? '✅' : '❌';
      const statusColor = code === 0 ? 'green' : 'red';
      colorLog(
        statusColor,
        `${status} ${workspaceName}: ${passed} passed, ${failed} failed, ${skipped} skipped (${formatDuration(duration)})`
      );

      resolve(result);
    });

    child.on('error', error => {
      colorLog(
        'red',
        `❌ Error running ${workspaceName} tests: ${error.message}`
      );
      resolve({
        name: workspaceName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        exitCode: 1,
        error: error.message,
      });
    });
  });
}

/**
 * Run integration tests
 */
function runIntegrationTests() {
  return new Promise(resolve => {
    const startTime = Date.now();
    colorLog('blue', '\n🔗 Running integration tests...');

    const testPath = path.resolve('test');
    if (!fs.existsSync(testPath)) {
      colorLog(
        'yellow',
        '⚠️  No integration test directory found, skipping...'
      );
      resolve(null);
      return;
    }

    const child = spawn('node', ['scripts/test-runner.js', 'test'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', data => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });
    child.on('close', code => {
      const duration = Date.now() - startTime;

      // Parse results from output - look for the final summary
      let passed = 0,
        failed = 0,
        skipped = 0;

      // Look for the final test summary in the format "# tests 15"
      const testSummaryMatch = stdout.match(/# tests (\d+)/);
      const passMatch = stdout.match(/# pass (\d+)/);
      const failMatch = stdout.match(/# fail (\d+)/);
      const skipMatch = stdout.match(/# skipped (\d+)/);
      const cancelMatch = stdout.match(/# cancelled (\d+)/);

      if (testSummaryMatch && passMatch) {
        const totalTests = parseInt(testSummaryMatch[1]) || 0;
        passed = parseInt(passMatch[1]) || 0;
        failed = parseInt(failMatch[1]) || 0;
        skipped = parseInt(skipMatch[1]) || 0;
        const cancelled = parseInt(cancelMatch[1]) || 0;

        // Add cancelled to skipped for simplicity
        skipped += cancelled;
      } else {
        // Fallback: Count individual test result symbols
        const passSymbols = (stdout.match(/✓/g) || []).length;
        const failSymbols = (stdout.match(/✗/g) || []).length;
        const skipSymbols = (stdout.match(/↓/g) || []).length;

        passed = passSymbols;
        failed = failSymbols;
        skipped = skipSymbols;
      }

      const result = {
        name: 'integration',
        passed,
        failed,
        skipped,
        duration,
        exitCode: code,
        stdout,
        stderr,
      };

      testResults.integration = result;
      testResults.totalPassed += passed;
      testResults.totalFailed += failed;
      testResults.totalSkipped += skipped;

      const status = code === 0 ? '✅' : '❌';
      const statusColor = code === 0 ? 'green' : 'red';
      colorLog(
        statusColor,
        `${status} integration: ${passed} passed, ${failed} failed, ${skipped} skipped (${formatDuration(duration)})`
      );

      resolve(result);
    });

    child.on('error', error => {
      colorLog('red', `❌ Error running integration tests: ${error.message}`);
      resolve({
        name: 'integration',
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: Date.now() - startTime,
        exitCode: 1,
        error: error.message,
      });
    });
  });
}

/**
 * Print comprehensive test summary
 */
function printSummary() {
  const totalDuration = Date.now() - testResults.startTime;

  console.log('\n' + '='.repeat(80));
  colorLog('bright', '📊 TEST SUMMARY');
  console.log('='.repeat(80));

  // Individual package results
  console.log('\n📦 Package Results:');
  testResults.workspaces.forEach(result => {
    const status = result.exitCode === 0 ? '✅' : '❌';
    const statusColor = result.exitCode === 0 ? 'green' : 'red';
    colorLog(
      statusColor,
      `  ${status} ${result.name.padEnd(12)} ${result.passed.toString().padStart(3)} passed, ${result.failed.toString().padStart(3)} failed, ${result.skipped.toString().padStart(3)} skipped (${formatDuration(result.duration)})`
    );
  });

  // Integration results
  if (testResults.integration) {
    const result = testResults.integration;
    const status = result.exitCode === 0 ? '✅' : '❌';
    const statusColor = result.exitCode === 0 ? 'green' : 'red';
    colorLog(
      statusColor,
      `  ${status} ${result.name.padEnd(12)} ${result.passed.toString().padStart(3)} passed, ${result.failed.toString().padStart(3)} failed, ${result.skipped.toString().padStart(3)} skipped (${formatDuration(result.duration)})`
    );
  }

  // Overall totals
  console.log('\n🎯 Overall Results:');
  const overallStatus = testResults.totalFailed === 0 ? '✅' : '❌';
  const overallColor = testResults.totalFailed === 0 ? 'green' : 'red';

  colorLog(
    'bright',
    `  Total Tests:     ${testResults.totalPassed + testResults.totalFailed + testResults.totalSkipped}`
  );
  colorLog('green', `  ✅ Passed:       ${testResults.totalPassed}`);
  if (testResults.totalFailed > 0) {
    colorLog('red', `  ❌ Failed:       ${testResults.totalFailed}`);
  }
  if (testResults.totalSkipped > 0) {
    colorLog('yellow', `  ⏭️  Skipped:      ${testResults.totalSkipped}`);
  }
  colorLog('blue', `  ⏱️  Duration:     ${formatDuration(totalDuration)}`);

  console.log('\n' + '='.repeat(80));
  colorLog(
    overallColor,
    `${overallStatus} ${testResults.totalFailed === 0 ? 'ALL TESTS PASSED' : `${testResults.totalFailed} TEST(S) FAILED`}`
  );
  console.log('='.repeat(80));

  // Package breakdown
  if (testResults.workspaces.length > 0) {
    console.log('\n📋 Package Breakdown:');
    testResults.workspaces.forEach(result => {
      const total = result.passed + result.failed + result.skipped;
      if (total > 0) {
        const passRate = ((result.passed / total) * 100).toFixed(1);
        colorLog(
          'cyan',
          `  📦 ${result.name}: ${passRate}% pass rate (${result.passed}/${total})`
        );
      }
    });
  }

  // Performance insights
  if (testResults.workspaces.length > 1) {
    console.log('\n⚡ Performance:');
    const sortedByDuration = [...testResults.workspaces].sort(
      (a, b) => b.duration - a.duration
    );
    sortedByDuration.forEach((result, index) => {
      const emoji =
        index === 0
          ? '🐌'
          : index === sortedByDuration.length - 1
            ? '⚡'
            : '📊';
      colorLog(
        'magenta',
        `  ${emoji} ${result.name}: ${formatDuration(result.duration)}`
      );
    });
  }

  console.log('');
}

/**
 * Main test execution function
 */
async function runAllTests() {
  colorLog('bright', '🚀 Starting comprehensive test suite...\n');

  // Define workspaces to test
  const workspaces = ['common', 'proxy', 'prover'];

  // Run workspace tests sequentially for cleaner output
  for (const workspace of workspaces) {
    await runWorkspaceTests(workspace);
  }

  // Run integration tests
  await runIntegrationTests();

  // Print comprehensive summary
  printSummary();

  // Exit with appropriate code
  const exitCode = testResults.totalFailed > 0 ? 1 : 0;
  process.exit(exitCode);
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the test suite
runAllTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
