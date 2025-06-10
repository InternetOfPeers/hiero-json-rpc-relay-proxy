#!/usr/bin/env node

console.log('🚀 Starting Final Mixed Success/Failure Demo');

const path = require('path');

console.log('Loading common package...');
const {
  loadEnvFile,
  validateRouteSignatures,
  signRouteData,
  getContractAddressFromCreate,
} = require('@hiero-json-rpc-relay/common');

console.log('Loading ethers...');
const { ethers } = require('ethers');

console.log('Loading environment...');
loadEnvFile();

console.log('Environment loaded successfully');
console.log('===================================\n');

async function demonstratePracticalScenario() {
  console.log('📋 Using actual environment configuration:');
  console.log(`   Proxy Account: ${process.env.PROXY_HEDERA_ACCOUNT_ID}`);
  console.log(`   Prover Account: ${process.env.PROVER_HEDERA_ACCOUNT_ID}`);
  console.log(`   Network: ${process.env.PROXY_HEDERA_NETWORK}`);
  console.log('');
  console.log('Creating wallets...');

  // Create one main signer wallet (all valid routes must be signed by same wallet)
  const mainSignerWallet = ethers.Wallet.createRandom();
  const wrongSignerWallet = ethers.Wallet.createRandom();
  console.log('Creating route 1...');
  // Route 1: Valid prover route (signed correctly) - use computed address for CREATE
  const nonce1 = Date.now() % 1000000;
  const computedAddr1 = getContractAddressFromCreate(
    mainSignerWallet.address,
    nonce1
  );
  const proverRoute = {
    addr: computedAddr1.toLowerCase(),
    proofType: 'create',
    nonce: nonce1,
    url: 'http://localhost:3000',
  };

  console.log('Signing route 1...');
  // Sign with the CORRECT private key for this address
  proverRoute.sig = await signRouteData(
    proverRoute.addr,
    proverRoute.proofType,
    proverRoute.nonce,
    proverRoute.url,
    mainSignerWallet.privateKey
  );

  console.log('Creating route 2...');
  // Route 2: Valid secondary route (different contract address but same signer)
  const nonce2 = (Date.now() % 1000000) + 1;
  const computedAddr2 = getContractAddressFromCreate(
    mainSignerWallet.address,
    nonce2
  );
  const secondaryRoute = {
    addr: computedAddr2.toLowerCase(),
    proofType: 'create',
    nonce: nonce2,
    url: 'https://testnet.hashio.io/api',
  };

  console.log('Signing route 2...');
  // Sign with the SAME main signer key (proxy expects same signer for all routes)
  secondaryRoute.sig = await signRouteData(
    secondaryRoute.addr,
    secondaryRoute.proofType,
    secondaryRoute.nonce,
    secondaryRoute.url,
    mainSignerWallet.privateKey
  );

  console.log('Creating route 3...');
  // Route 3: Invalid route (signed with WRONG key)
  const nonce3 = (Date.now() % 1000000) + 2;
  const computedAddr3 = getContractAddressFromCreate(
    mainSignerWallet.address,
    nonce3
  );
  const invalidRoute = {
    addr: computedAddr3.toLowerCase(),
    proofType: 'create',
    nonce: nonce3,
    url: 'http://malicious-server.com',
  };
  console.log('Signing route 3 (with wrong key)...');
  // Sign with WRONG private key (this should fail validation)
  invalidRoute.sig = await signRouteData(
    invalidRoute.addr,
    invalidRoute.proofType,
    invalidRoute.nonce,
    invalidRoute.url,
    wrongSignerWallet.privateKey // Wrong key! Using wrong signer for this address
  );

  console.log('Validating routes...');
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
  console.log(`      Derived signer: ${validationResult.derivedSignerAddress}`);

  if (validationResult.invalidRoutes.length > 0) {
    console.log('   ❌ Invalid route errors:');
    validationResult.invalidRoutes.forEach((invalid, i) => {
      console.log(`      ${i + 1}. ${invalid.route.addr}: ${invalid.error}`);
    });
  }

  if (validationResult.validRoutes.length > 0) {
    console.log('   ✅ Valid routes:');
    validationResult.validRoutes.forEach((route, i) => {
      console.log(`      ${i + 1}. ${route.addr}: ${route.url}`);
    });
  }

  if (validationResult.validCount > 0 && validationResult.invalidCount > 0) {
    console.log('\n✨ SUCCESS! Mixed scenario working correctly!');
    console.log('   The fix properly handles routes individually:');
    console.log(`   - ${validationResult.validCount} routes passed validation`);
    console.log(
      `   - ${validationResult.invalidCount} routes failed validation`
    );
    console.log('   - Each route gets appropriate individual notification');
  } else if (validationResult.validCount > 0) {
    console.log('\n✅ All routes passed validation');
  } else {
    console.log('\n❌ All routes failed validation');
  }

  return {
    validCount: validationResult.validCount,
    invalidCount: validationResult.invalidCount,
  };
}

// Run the demonstration
console.log('Starting demonstration...');
demonstratePracticalScenario()
  .then(result => {
    console.log('\n🎉 Demonstration Complete!');
    console.log(
      `   Valid: ${result.validCount}, Invalid: ${result.invalidCount}`
    );
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
  });
