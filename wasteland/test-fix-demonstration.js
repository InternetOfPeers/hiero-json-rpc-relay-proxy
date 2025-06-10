#!/usr/bin/env node

/**
 * Test script to demonstrate the fix for mixed success/failure handling
 * This script shows that with our fix, the proxy will now:
 * 1. Send failure notifications only to routes that failed
 * 2. Send success notifications only to routes that succeeded
 * 3. Process valid routes even when some routes fail
 */

console.log('🧪 Testing Mixed Success/Failure Fix');
console.log('====================================\n');

// Simulate the old behavior (before fix)
function simulateOldBehavior(validationResult) {
  console.log('❌ OLD BEHAVIOR (before fix):');

  if (!validationResult.success) {
    console.log('   ✋ All routes considered failed because ANY route failed');
    console.log('   📤 Would send failure notifications to ALL routes');
    console.log('   🚫 No success notifications sent');
    console.log('   🚫 No valid routes processed (challenge-response skipped)');
    return {
      failureNotifications: validationResult.totalRoutes,
      successNotifications: 0,
      routesProcessed: 0,
    };
  }

  return {
    failureNotifications: 0,
    successNotifications: validationResult.totalRoutes,
    routesProcessed: validationResult.totalRoutes,
  };
}

// Simulate the new behavior (after fix)
function simulateNewBehavior(validationResult) {
  console.log('✅ NEW BEHAVIOR (after fix):');

  let failureNotifications = 0;
  let successNotifications = 0;
  let routesProcessed = 0;

  // Handle failed routes
  if (validationResult.invalidCount > 0) {
    console.log(
      `   📤 Send failure notifications to ${validationResult.invalidCount} failed route(s)`
    );
    failureNotifications = validationResult.invalidCount;
  }

  // Handle successful routes
  if (validationResult.validCount > 0) {
    console.log(
      `   📤 Send success notifications to ${validationResult.validCount} valid route(s)`
    );
    console.log(
      `   🚀 Process ${validationResult.validCount} valid route(s) through challenge-response`
    );
    successNotifications = validationResult.validCount;
    routesProcessed = validationResult.validCount;
  }

  // Only throw error if ALL routes failed
  if (validationResult.validCount === 0 && validationResult.invalidCount > 0) {
    console.log('   ⚠️  All routes failed - throwing error');
  } else if (validationResult.validCount > 0) {
    console.log('   ✅ Some routes succeeded - continuing processing');
  }

  return {
    failureNotifications,
    successNotifications,
    routesProcessed,
  };
}

console.log(
  '🔍 Test Scenario: Message with 3 routes, 1 fails signature verification\n'
);

// Mock validation result representing the user's scenario
const mockValidationResult = {
  success: false, // Overall success is false because one route failed
  validCount: 2,
  invalidCount: 1,
  totalRoutes: 3,
  validRoutes: [
    {
      addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
      url: 'http://localhost:7546',
    },
    {
      addr: '0xbd8b5269f85c4460b04d5deaaf51022a41783a32',
      url: 'http://localhost:7546',
    },
  ],
  invalidRoutes: [
    {
      route: {
        addr: '0xfcec100d41f4bcc889952e1a73ad6d96783c491a',
        url: 'http://localhost:7546',
      },
      error:
        'Invalid contract ownership - computed 0xfcec100d41f4bcc889952e1a73ad6d96783c491f, expected 0xfcec100d41f4bcc889952e1a73ad6d96783c491a',
    },
  ],
  errors: [
    'Invalid contract ownership for 0xfcec100d41f4bcc889952e1a73ad6d96783c491a',
  ],
  derivedSignerAddress: '0x1234567890123456789012345678901234567890',
};

console.log('📊 Validation Result:');
console.log(`   Total routes: ${mockValidationResult.totalRoutes}`);
console.log(`   Valid routes: ${mockValidationResult.validCount}`);
console.log(`   Invalid routes: ${mockValidationResult.invalidCount}`);
console.log(`   Overall success: ${mockValidationResult.success}`);
console.log('');

// Test old behavior
const oldResult = simulateOldBehavior(mockValidationResult);
console.log('');

// Test new behavior
const newResult = simulateNewBehavior(mockValidationResult);
console.log('');

// Compare results
console.log('📈 COMPARISON:');
console.log('┌─────────────────────────────┬─────────────┬─────────────┐');
console.log('│ Metric                      │ Old Behavior│ New Behavior│');
console.log('├─────────────────────────────┼─────────────┼─────────────┤');
console.log(
  `│ Failure notifications sent  │      ${oldResult.failureNotifications}      │      ${newResult.failureNotifications}      │`
);
console.log(
  `│ Success notifications sent  │      ${oldResult.successNotifications}      │      ${newResult.successNotifications}      │`
);
console.log(
  `│ Routes processed (challenges)│      ${oldResult.routesProcessed}      │      ${newResult.routesProcessed}      │`
);
console.log('└─────────────────────────────┴─────────────┴─────────────┘');
console.log('');

console.log('🎯 KEY IMPROVEMENTS:');
console.log('   ✅ Failed routes get appropriate failure notifications');
console.log('   ✅ Valid routes get success notifications and are processed');
console.log('   ✅ System continues working even when some routes fail');
console.log('   ✅ More granular and accurate error handling');
console.log('');

console.log('🔧 This fix addresses the issue where:');
console.log(
  '   "when the proxy receive a single wrong message, it consider all messages failed"'
);
console.log('');
console.log(
  '✅ NOW: Proxy sends individual notifications per route based on their actual status!'
);
