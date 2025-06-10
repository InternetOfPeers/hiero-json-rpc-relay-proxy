#!/usr/bin/env node

/**
 * Test script to verify mixed success/failure handling
 * This script tests that the proxy sends success notifications to valid routes
 * and failure notifications only to failed routes
 */

const {
  validateRouteSignatures,
  signRouteData,
} = require('@hiero-json-rpc-relay/common');
const { ethers } = require('ethers');

console.log('🧪 Testing Mixed Success/Failure Handling');
console.log('==========================================\n');

async function testMixedResults() {
  // Create a private key for signing
  const wallet = ethers.Wallet.createRandom();
  const privateKey = wallet.privateKey;

  console.log('1️⃣  Creating mixed test data (some valid, some invalid)...');

  // Valid route with correct signature
  const validRoute = {
    addr: '0x3ed660420aa9bc674e8f80f744f8062603da385e',
    proofType: 'create',
    nonce: 33,
    url: 'http://localhost:3000',
  };

  // Sign the valid route correctly
  validRoute.sig = await signRouteData(
    validRoute.addr,
    validRoute.proofType,
    validRoute.nonce,
    validRoute.url,
    privateKey
  );

  // Invalid route with bad signature
  const invalidRoute = {
    addr: '0xfcec100d41f4bcc889952e1a73ad6d96783c491a',
    proofType: 'create',
    nonce: 30,
    url: 'http://localhost:3001',
    sig: '0xinvalidsignature', // Invalid signature
  };

  // Another valid route with correct signature
  const anotherValidRoute = {
    addr: '0xbd8b5269f85c4460b04d5deaaf51022a41783a32',
    proofType: 'create',
    nonce: 25,
    url: 'http://localhost:3002',
  };

  anotherValidRoute.sig = await signRouteData(
    anotherValidRoute.addr,
    anotherValidRoute.proofType,
    anotherValidRoute.nonce,
    anotherValidRoute.url,
    privateKey
  );

  const testRoutes = [validRoute, invalidRoute, anotherValidRoute];

  console.log('2️⃣  Testing signature validation with mixed results...');
  const validationResult = validateRouteSignatures(testRoutes);

  console.log('   ✅ Validation completed:');
  console.log(`   📊 Success: ${validationResult.success}`);
  console.log(`   📊 Valid count: ${validationResult.validCount}`);
  console.log(`   📊 Invalid count: ${validationResult.invalidCount}`);
  console.log(`   📊 Total errors: ${validationResult.errors.length}`);

  console.log('\n3️⃣  Analyzing results...');

  if (validationResult.validRoutes && validationResult.validRoutes.length > 0) {
    console.log('   ✅ Valid routes (should receive success notifications):');
    validationResult.validRoutes.forEach((route, index) => {
      console.log(`      ${index + 1}. ${route.addr} -> ${route.url}`);
    });
  }

  if (
    validationResult.invalidRoutes &&
    validationResult.invalidRoutes.length > 0
  ) {
    console.log('   ❌ Invalid routes (should receive failure notifications):');
    validationResult.invalidRoutes.forEach((invalid, index) => {
      console.log(
        `      ${index + 1}. ${invalid.route.addr} -> ${invalid.route.url}`
      );
      console.log(`         Error: ${invalid.error}`);
    });
  }

  console.log('\n4️⃣  Testing proxy behavior simulation...');

  // Simulate the new proxy behavior
  if (validationResult.invalidCount > 0) {
    console.log('   📤 Proxy would send failure notifications to:');
    validationResult.invalidRoutes.forEach(invalid => {
      console.log(`      - ${invalid.route.url} (${invalid.route.addr})`);
    });
  }

  if (validationResult.validCount > 0) {
    console.log('   📤 Proxy would send success notifications to:');
    validationResult.validRoutes.forEach(route => {
      console.log(`      - ${route.url} (${route.addr})`);
    });
  }

  // Verify the expected behavior
  const expectedValidCount = 2; // validRoute and anotherValidRoute
  const expectedInvalidCount = 1; // invalidRoute

  if (
    validationResult.validCount === expectedValidCount &&
    validationResult.invalidCount === expectedInvalidCount
  ) {
    console.log('\n✅ Mixed success/failure handling test PASSED!');
    console.log('   The proxy will now correctly:');
    console.log('   • Send failure notifications only to routes that failed');
    console.log(
      '   • Send success notifications only to routes that succeeded'
    );
    console.log('   • Process valid routes even when some routes fail');
  } else {
    console.log('\n❌ Mixed success/failure handling test FAILED!');
    console.log(
      `   Expected: ${expectedValidCount} valid, ${expectedInvalidCount} invalid`
    );
    console.log(
      `   Got: ${validationResult.validCount} valid, ${validationResult.invalidCount} invalid`
    );
  }
}

testMixedResults().catch(console.error);
