#!/usr/bin/env node

/**
 * Debug script to test actual message exchange between proxy and prover
 * This will help us see what's actually being sent vs received
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🐛 Debug Message Exchange Test');
console.log('==============================\n');

// Function to run proxy in background
function startProxy() {
  return new Promise((resolve, reject) => {
    console.log('1️⃣  Starting proxy server...');

    const proxy = spawn('node', ['packages/proxy/src/proxy.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: { ...process.env, PORT: '3999' },
    });

    let startupTimeout;
    let ready = false;

    proxy.stdout.on('data', data => {
      const output = data.toString();
      console.log(`   PROXY: ${output.trim()}`);

      if (output.includes('running on port')) {
        ready = true;
        clearTimeout(startupTimeout);
        resolve(proxy);
      }
    });

    proxy.stderr.on('data', data => {
      console.log(`   PROXY ERROR: ${data.toString().trim()}`);
    });

    proxy.on('error', error => {
      clearTimeout(startupTimeout);
      reject(error);
    });

    // Give proxy 10 seconds to start
    startupTimeout = setTimeout(() => {
      if (!ready) {
        proxy.kill();
        reject(new Error('Proxy startup timeout'));
      }
    }, 10000);
  });
}

// Function to run prover
function runProver() {
  return new Promise((resolve, reject) => {
    console.log('\n2️⃣  Starting prover...');

    const prover = spawn('node', ['packages/prover/src/prover.js'], {
      cwd: __dirname,
      stdio: 'pipe',
      env: {
        ...process.env,
        PROVER_PROXY_SERVER_URL: 'http://localhost:3000',
        PROVER_HEDERA_ACCOUNT_ID: process.env.PROVER_HEDERA_ACCOUNT_ID,
        PROVER_HEDERA_PRIVATE_KEY: process.env.PROVER_HEDERA_PRIVATE_KEY,
        PROVER_HEDERA_NETWORK: 'testnet',
      },
    });

    prover.stdout.on('data', data => {
      const output = data.toString();
      console.log(`   PROVER: ${output.trim()}`);
    });

    prover.stderr.on('data', data => {
      console.log(`   PROVER ERROR: ${data.toString().trim()}`);
    });

    prover.on('close', code => {
      console.log(`\n   PROVER exited with code: ${code}`);
      resolve(code);
    });

    prover.on('error', error => {
      reject(error);
    });

    // Give prover 60 seconds to complete
    setTimeout(() => {
      prover.kill();
      resolve(-1);
    }, 60000);
  });
}

async function main() {
  let proxy;

  try {
    // Start proxy
    proxy = await startProxy();

    // Wait a bit for proxy to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Run prover
    const proverExitCode = await runProver();

    console.log(`\n✅ Test completed - Prover exit code: ${proverExitCode}`);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    // Clean up proxy
    if (proxy) {
      console.log('\n🧹 Cleaning up proxy...');
      proxy.kill();
    }
  }
}

main().catch(console.error);
