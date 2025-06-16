const { extractToFromTransaction } = require('../packages/common/src/ethUtils');

// Test cases for different transaction types
const testCases = [
  {
    name: 'EIP-1559 (Type 2) Transaction',
    rawTx:
      '0x02f874820128820134857dba821800857dba821800826b9c944f1a953df9df8d1c6073ce57f7493e50515fa73f8084d0e30db0c001a0ea5ecef0a498846872303b4d75e9d01de7aef6aa4c490e1e7959bdd22b7928ada032be16b65d017d8bff2fae2b29c5dc5305faeb401ba648ad73d65febd8bfc4df',
    expectedTo: '0x4f1a953df9df8d1c6073ce57f7493e50515fa73f',
  },
  {
    name: 'Legacy Transaction',
    rawTx:
      '0xf86580808094f0d9b927f64374f0b48cbe56bc6af212d52ee25a880de0b6b3a7640000801ba01cb878c65bc244390fc6e760a41c42a1f61ebd42955d94f773632437ca69b3c8a05f9ecbf2c98ca234d8888f9a48ebb7f44bd54bc9553c32e87aefb0e789308f11',
    expectedTo: '0xf0d9b927f64374f0b48cbe56bc6af212d52ee25a',
  },
  {
    name: 'Legacy Invalid Transaction',
    rawTx:
      '0xf86b808504a817c800825208943535353535353535353535353535353535353535880de0b6b3a76400008025a0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0a05b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b5b',
    expectedTo: '0x3535353535353535353535353535353535353535',
  },
];

console.log(
  '🧪 Testing extractToFromTransaction with different transaction types...\n'
);

let passedTests = 0;
let totalTests = testCases.length;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Raw TX: ${testCase.rawTx}`);
  console.log(`Expected TO: ${testCase.expectedTo}`);

  const result = extractToFromTransaction(testCase.rawTx);
  console.log(`Actual result: ${result}`);

  const passed = result?.toLowerCase() === testCase.expectedTo.toLowerCase();
  console.log(`Test passed: ${passed ? '✅' : '❌'}`);

  if (passed) passedTests++;
  console.log('---');
});

console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('🎉 All tests passed!');
  process.exit(0);
} else {
  console.log('💥 Some tests failed!');
  process.exit(1);
}
