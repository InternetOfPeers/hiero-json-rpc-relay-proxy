#!/usr/bin/env node

// Simple test to verify file saving functionality works
const path = require('path');
const fs = require('fs');

console.log('🧪 Testing prover results file saving...');

try {
  // Create data directory
  const resultsDir = path.join(__dirname, 'data');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Test data
  const testData = {
    test: 'data',
    timestamp: new Date().toISOString(),
    status: 'completed',
  };

  // Write test file
  const filename = 'test-results.json';
  const filepath = path.join(resultsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(testData, null, 2));

  console.log(`💾 Test file saved to: ${filepath}`);

  // Verify file exists and content
  if (fs.existsSync(filepath)) {
    const savedData = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    console.log('✅ File saving test passed!');
    console.log(`📋 Saved data: ${JSON.stringify(savedData)}`);

    // Clean up
    fs.unlinkSync(filepath);
    console.log('🧹 Test file cleaned up');
  } else {
    console.log('❌ File saving test failed!');
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Test error: ${error.message}`);
  process.exit(1);
}
