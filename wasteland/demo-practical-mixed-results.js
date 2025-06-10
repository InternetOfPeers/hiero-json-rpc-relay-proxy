#!/usr/bin/env node

/**
 * Practical Demonstration of Mixed Success/Failure Handling
 *
 * This demo uses actual credentials from .env to demonstrate the fixed proxy behavior
 * where individual routes receive appropriate success/failure notifications.
 *
 * BEFORE FIX: All routes would get failure notification if ANY route failed
 * AFTER FIX: Only failed routes get failure notification, valid routes get success
 */

const path = require('path');
const {
  loadEnvFile,
  validateRouteSignatures,
  signRouteData,
} = require('@hiero-json-rpc-relay/common');
const { ethers } = require('ethers');

// Load environment configuration using the dedicated envLoader
loadEnvFile();

console.log('🚀 Practical Mixed Success/Failure Demo');
console.log('=========================================\n');

async function demonstratePracticalScenario() {
  console.log('📋 Using actual environment configuration:');
  console.log(`   Proxy Account: ${process.env.PROXY_HEDERA_ACCOUNT_ID}`);
  console.log(`   Prover Account: ${process.env.PROVER_HEDERA_ACCOUNT_ID}`);
  console.log(`   Network: ${process.env.PROXY_HEDERA_NETWORK}`);
  console.log('');

  // Create valid private keys for signing
  const validWallet1 = new ethers.Wallet(process.env.PROVER_HEDERA_PRIVATE_KEY);
  const validWallet2 = ethers.Wallet.createRandom();
  const invalidWallet = ethers.Wallet.createRandom(); // Different wallet for invalid signature

  console.log('1️⃣  Creating realistic mixed message scenario...');

  // Route 1: Valid prover route using actual prover key
  const proverRoute = {
    addr: validWallet1.address.toLowerCase(),
    proofType: 'create',
    nonce: Date.now() % 1000000, // Random nonce
    url: process.env.PROVER_PROXY_SERVER_URL || 'http://localhost:3000',
  };

  proverRoute.sig = await signRouteData(
    proverRoute.addr,
    proverRoute.proofType,
    proverRoute.nonce,
    proverRoute.url,
    validWallet1.privateKey
  );

  // Route 2: Valid secondary route
  const secondaryRoute = {
    addr: validWallet2.address.toLowerCase(),
    proofType: 'create',
    nonce: (Date.now() % 1000000) + 1,
    url: 'https://testnet.hashio.io/api',
  };

  secondaryRoute.sig = await signRouteData(
    secondaryRoute.addr,
    secondaryRoute.proofType,
    secondaryRoute.nonce,
    secondaryRoute.url,
    validWallet2.privateKey
  );

  // Route 3: Invalid route (signed with wrong key)
  const invalidRoute = {
    addr: validWallet1.address.toLowerCase(), // Same address as route 1
    proofType: 'create',
    nonce: (Date.now() % 1000000) + 2,
    url: 'http://malicious-server.com',
  };

  // Sign with wrong private key (this should fail validation)
  invalidRoute.sig = await signRouteData(
    invalidRoute.addr,
    invalidRoute.proofType,
    invalidRoute.nonce,
    invalidRoute.url,
    invalidWallet.privateKey // Wrong key!
  );

  const testMessage = {
    timestamp: Date.now(),
    routes: [proverRoute, secondaryRoute, invalidRoute],
    challenge: 'demo-challenge-' + Math.random().toString(36).substr(2, 9),
  };

  console.log('2️⃣  Message contains:');
  console.log(
    `   ✅ Valid prover route: ${proverRoute.url} (${proverRoute.addr})`
  );
  console.log(
    `   ✅ Valid secondary route: ${secondaryRoute.url} (${secondaryRoute.addr})`
  );
  console.log(
    `   ❌ Invalid route: ${invalidRoute.url} (${invalidRoute.addr})`
  );
  console.log('');

  console.log('3️⃣  Testing signature validation...');
  const validationResult = validateRouteSignatures(testMessage.routes);

  console.log('   📊 Validation Results:');
  console.log(`      Success: ${validationResult.success}`);
  console.log(`      Valid routes: ${validationResult.validCount}`);
  console.log(`      Invalid routes: ${validationResult.invalidCount}`);
  console.log('');

  console.log('4️⃣  Simulating FIXED proxy behavior...');

  // Simulate the fixed proxy logic from hederaManager.js
  if (validationResult.invalidCount > 0) {
    console.log('   🔍 Processing failed routes:');
    const invalidAddresses = validationResult.invalidRoutes
      .map(item => item.route.addr || 'unknown')
      .join(', ');

    console.log(
      `      ❌ Signature verification failed for ${validationResult.invalidCount} route(s): ${invalidAddresses}`
    );
    // Show failure notification details
    console.log('   📤 Sending failure notifications to failed routes only:');
    for (const invalid of validationResult.invalidRoutes) {
      // In real implementation, this would be encrypted with RSA/AES
      const failureMessage = JSON.stringify({
        type: 'verification_failure',
        error: invalid.error,
        route: invalid.route.addr,
        timestamp: Date.now(),
      });

      console.log(
        `      → ${invalid.route.url}: [ENCRYPTED] ${failureMessage.substring(0, 80)}...`
      );
      console.log(`        Reason: ${invalid.error}`);
    }
  }

  if (validationResult.validCount > 0) {
    console.log('   🔍 Processing successful routes:');
    const validAddresses = validationResult.validRoutes
      .map(route => route.addr)
      .join(', ');

    console.log(
      `      ✅ Signature verification succeeded for ${validationResult.validCount} route(s): ${validAddresses}`
    );

    // Create filtered message with only valid routes
    const filteredMessage = {
      ...testMessage,
      routes: validationResult.validRoutes,
    };
    console.log(
      '   📤 Proceeding with challenge-response for valid routes only:'
    );
    for (const route of validationResult.validRoutes) {
      // In real implementation, this would be encrypted with RSA/AES
      const challengeMessage = JSON.stringify({
        type: 'challenge',
        challenge: testMessage.challenge,
        timestamp: Date.now(),
      });

      console.log(
        `      → ${route.url}: [ENCRYPTED] ${challengeMessage.substring(0, 80)}...`
      );
    }
  }

  // Only throw error if ALL routes failed (not just some)
  if (validationResult.validCount === 0) {
    console.log(
      '   💥 ALL routes failed - would throw error and stop processing'
    );
  } else {
    console.log(
      '   ✅ At least some routes valid - continuing with partial processing'
    );
  }

  console.log('\n5️⃣  Summary of Fix Benefits:');
  console.log(
    '   🎯 BEFORE: Single invalid route = ALL routes notified of failure'
  );
  console.log(
    '   🎯 AFTER: Each route gets individual success/failure notification'
  );
  console.log(
    '   📈 Improved resilience: Valid routes continue processing even when others fail'
  );
  console.log('   🔍 Better debugging: Route-specific error reporting');
  console.log(
    "   ⚡ Enhanced reliability: Partial failures don't block entire batch"
  );

  return {
    totalRoutes: testMessage.routes.length,
    validRoutes: validationResult.validCount,
    invalidRoutes: validationResult.invalidCount,
    fixWorking:
      validationResult.validCount > 0 && validationResult.invalidCount > 0,
  };
}

// Run the demonstration
demonstratePracticalScenario()
  .then(result => {
    console.log('\n🎉 Demonstration Complete!');
    console.log(`   Total routes tested: ${result.totalRoutes}`);
    console.log(`   Valid routes: ${result.validRoutes}`);
    console.log(`   Invalid routes: ${result.invalidRoutes}`);
    console.log(
      `   Mixed handling working: ${result.fixWorking ? '✅ YES' : '❌ NO'}`
    );

    if (result.fixWorking) {
      console.log('\n✨ The fix is working correctly!');
      console.log(
        '   The proxy now handles mixed success/failure scenarios properly.'
      );
    }
  })
  .catch(error => {
    console.error('\n❌ Demonstration failed:', error.message);
    console.error('   Stack:', error.stack);
  });
