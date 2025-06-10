#!/usr/bin/env node

/**
 * Demonstration of the new Topic ID Configuration Logic
 *
 * This script demonstrates how the prover now handles topic ID configuration
 * with the new priority-based logic and fallback behavior.
 */

console.log('🎯 Topic ID Configuration Logic Demo');
console.log('=====================================\n');

// Save original environment
const originalEnv = {
  PROVER_HEDERA_TOPIC_ID: process.env.PROVER_HEDERA_TOPIC_ID,
  HEDERA_TOPIC_ID: process.env.HEDERA_TOPIC_ID,
};

function demonstrateTopicLogic(scenario, setupFn, description) {
  console.log(`${scenario}: ${description}`);

  // Setup environment for this scenario
  setupFn();

  // Simulate the prover's topic resolution logic
  const configuredTopicId =
    process.env.PROVER_HEDERA_TOPIC_ID || process.env.HEDERA_TOPIC_ID;

  if (configuredTopicId) {
    console.log(`   ✅ Will use configured topic: ${configuredTopicId}`);
    console.log(`   📡 Will fetch RSA public key from proxy /status endpoint`);
    console.log(
      `   📋 Proxy's topic ID will be ignored (but logged for transparency)`
    );
  } else {
    console.log(`   📡 Will fetch complete status from proxy /status endpoint`);
    console.log(
      `   📋 Will use proxy's topic ID, public key, and network settings`
    );
  }

  console.log('');
}

// Restore environment after each demo
function restoreEnv() {
  Object.keys(originalEnv).forEach(key => {
    if (originalEnv[key] !== undefined) {
      process.env[key] = originalEnv[key];
    } else {
      delete process.env[key];
    }
  });
}

// Demo scenarios
demonstrateTopicLogic(
  '🎯 Scenario 1',
  () => {
    restoreEnv();
    process.env.PROVER_HEDERA_TOPIC_ID = '0.0.9999999';
  },
  'PROVER_HEDERA_TOPIC_ID configured'
);

demonstrateTopicLogic(
  '🎯 Scenario 2',
  () => {
    restoreEnv();
    delete process.env.PROVER_HEDERA_TOPIC_ID;
    process.env.HEDERA_TOPIC_ID = '0.0.8888888';
  },
  'HEDERA_TOPIC_ID fallback'
);

demonstrateTopicLogic(
  '🎯 Scenario 3',
  () => {
    restoreEnv();
    delete process.env.PROVER_HEDERA_TOPIC_ID;
    delete process.env.HEDERA_TOPIC_ID;
  },
  'No topic configured (proxy discovery)'
);

demonstrateTopicLogic(
  '🎯 Scenario 4',
  () => {
    restoreEnv();
    process.env.PROVER_HEDERA_TOPIC_ID = '0.0.9999999';
    process.env.HEDERA_TOPIC_ID = '0.0.8888888';
  },
  'Both configured (priority test)'
);

console.log('🎉 Benefits of this approach:');
console.log('   • Backward compatibility: Existing setups continue to work');
console.log(
  "   • Flexibility: Can test with specific topics while using proxy's public key"
);
console.log(
  '   • Transparency: Logs both configured and proxy topics for debugging'
);
console.log(
  '   • Fail-fast: Errors immediately if proxy unreachable with configured topic'
);
console.log(
  '   • Environment variable hierarchy: PROVER_* takes priority over legacy HEDERA_*'
);

// Restore original environment
restoreEnv();

console.log('\n✅ Demo completed successfully!');
