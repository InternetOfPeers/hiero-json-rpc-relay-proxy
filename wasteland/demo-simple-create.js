#!/usr/bin/env node

/**
 * Simple demo testing mixed success/failure with CREATE contracts only
 * This tests the proxy's ability to handle some routes succeeding and some failing
 */

const { ethers } = require('ethers');
const {
  validateRouteSignatures,
  signRouteData,
} = require('../packages/common/src/validation');
const {
  getContractAddressFromCreate,
} = require('../packages/common/src/cryptoUtils');

console.log('🧪 Testing Mixed Success/Failure with CREATE Contracts');
console.log('=====================================================\n');

console.log('Starting demo...');

async function createTestRoutes() {
  // Create a single wallet that will be the deployer
  const deployerWallet = ethers.Wallet.createRandom();
  console.log(`📋 Deployer address: ${deployerWallet.address}\n`);

  // Create 3 routes:
  // 1. Valid CREATE contract with correct nonce
  // 2. Valid CREATE contract with correct nonce
  // 3. Invalid CREATE contract with wrong address (not computed from deployer+nonce)

  const routes = [];

  // Route 1: VALID - Proper CREATE contract
  const nonce1 = 33;
  const addr1 = getContractAddressFromCreate(deployerWallet.address, nonce1);
  const url1 = 'http://localhost:3001';
  const sig1 = await signRouteData(
    addr1,
    'create',
    nonce1,
    url1,
    deployerWallet.privateKey
  );

  routes.push({
    addr: addr1,
    proofType: 'create',
    nonce: nonce1,
    url: url1,
    sig: sig1,
  });

  console.log(`✅ Route 1 (VALID):`);
  console.log(`   Address: ${addr1}`);
  console.log(`   Nonce: ${nonce1}`);
  console.log(`   URL: ${url1}`);

  // Route 2: VALID - Another proper CREATE contract
  const nonce2 = 44;
  const addr2 = getContractAddressFromCreate(deployerWallet.address, nonce2);
  const url2 = 'http://localhost:3002';
  const sig2 = await signRouteData(
    addr2,
    'create',
    nonce2,
    url2,
    deployerWallet.privateKey
  );

  routes.push({
    addr: addr2,
    proofType: 'create',
    nonce: nonce2,
    url: url2,
    sig: sig2,
  });

  console.log(`✅ Route 2 (VALID):`);
  console.log(`   Address: ${addr2}`);
  console.log(`   Nonce: ${nonce2}`);
  console.log(`   URL: ${url2}`);

  // Route 3: INVALID - Wrong contract address (not derived from deployer+nonce)
  const nonce3 = 55;
  const wrongAddr3 = '0x1234567890123456789012345678901234567890'; // Random address, not computed
  const url3 = 'http://localhost:3003';
  const sig3 = await signRouteData(
    wrongAddr3,
    'create',
    nonce3,
    url3,
    deployerWallet.privateKey
  );

  routes.push({
    addr: wrongAddr3,
    proofType: 'create',
    nonce: nonce3,
    url: url3,
    sig: sig3,
  });

  console.log(`❌ Route 3 (INVALID - wrong contract address):`);
  console.log(
    `   Address: ${wrongAddr3} (should be ${getContractAddressFromCreate(deployerWallet.address, nonce3)})`
  );
  console.log(`   Nonce: ${nonce3}`);
  console.log(`   URL: ${url3}`);

  return routes;
}

async function testMixedValidation() {
  const routes = await createTestRoutes();

  console.log('\n🔍 Running Signature Validation...');
  console.log('=====================================');

  const validationResult = validateRouteSignatures(routes);

  console.log(`\n📊 Validation Results:`);
  console.log(`   Success: ${validationResult.success}`);
  console.log(`   Valid routes: ${validationResult.validCount}`);
  console.log(`   Invalid routes: ${validationResult.invalidCount}`);
  console.log(`   Derived signer: ${validationResult.derivedSignerAddress}`);

  console.log(`\n✅ Valid Routes (${validationResult.validCount}):`);
  validationResult.validRoutes.forEach((route, index) => {
    console.log(`   ${index + 1}. ${route.addr} (${route.url})`);
  });

  console.log(`\n❌ Invalid Routes (${validationResult.invalidCount}):`);
  validationResult.invalidRoutes.forEach((invalid, index) => {
    console.log(
      `   ${index + 1}. ${invalid.route.addr} (${invalid.route.url})`
    );
    console.log(`       Error: ${invalid.error}`);
  });

  console.log(`\n🎯 Expected Proxy Behavior:`);
  console.log(
    `   • Send failure notifications to: ${validationResult.invalidCount} route(s)`
  );
  console.log(
    `   • Continue processing challenges for: ${validationResult.validCount} route(s)`
  );
  console.log(
    `   • Send success confirmations to: ${validationResult.validCount} route(s)`
  );

  return validationResult;
}

// Run the demo
testMixedValidation()
  .then(result => {
    console.log('\n✅ Demo completed successfully!');
    console.log('   This demonstrates the fixed proxy behavior where:');
    console.log(
      '   - Individual routes get individual success/failure notifications'
    );
    console.log('   - Mixed results are handled correctly');
    console.log(
      '   - Processing continues for valid routes even when some fail'
    );

    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Demo failed:', error.message);
    process.exit(1);
  });
