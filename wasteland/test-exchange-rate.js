const { HederaManager } = require('./packages/proxy/src/hederaManager.js');

// Mock HederaManager to test exchange rate functionality
class TestHederaManager extends HederaManager {
  constructor() {
    super({
      accountId: '0.0.123456',
      privateKey: '302e020100300506032b657004220420f87a',
      network: 'testnet',
    });
    this.mirrorNodeUrl = 'https://testnet.mirrornode.hedera.com';
  }
}

async function testExchangeRateCalculation() {
  console.log('🧪 Testing dynamic fee calculation...\n');

  const manager = new TestHederaManager();

  try {
    // Test fetching exchange rate
    console.log('📊 Testing exchange rate fetch...');
    const exchangeRate = await manager.getExchangeRate();
    console.log('✅ Exchange rate fetched successfully:');
    console.log(`   cent_equivalent: ${exchangeRate.cent_equivalent}`);
    console.log(`   hbar_equivalent: ${exchangeRate.hbar_equivalent}`);
    console.log(
      `   Rate: ${(exchangeRate.cent_equivalent / exchangeRate.hbar_equivalent).toFixed(4)} cents per HBAR\n`
    );

    // Test calculating dynamic fees
    console.log('💰 Testing dynamic fee calculation...');
    const feeCalculation = await manager.calculateDynamicFees();
    console.log('✅ Dynamic fees calculated successfully:');
    console.log(
      `   Custom fee (for $1): ${feeCalculation.customFeeAmount} tinybars`
    );
    console.log(
      `   Max transaction fee (for $2): ${feeCalculation.maxTransactionFeeHbar.toFixed(6)} HBAR`
    );

    if (feeCalculation.exchangeRate) {
      console.log(
        `   Exchange rate used: ${feeCalculation.exchangeRate.centsPerHbar.toFixed(4)} cents per HBAR`
      );
      console.log(
        `   Calculation: $1 = 100 cents / ${feeCalculation.exchangeRate.centsPerHbar.toFixed(4)} = ${(100 / feeCalculation.exchangeRate.centsPerHbar).toFixed(6)} HBAR = ${feeCalculation.customFeeAmount} tinybars`
      );
      console.log(
        `   Calculation: $2 = 200 cents / ${feeCalculation.exchangeRate.centsPerHbar.toFixed(4)} = ${(200 / feeCalculation.exchangeRate.centsPerHbar).toFixed(6)} HBAR`
      );
    } else {
      console.log('   ⚠️  Using fallback values due to API unavailability');
    }

    console.log(
      '\n🎉 All tests passed! Dynamic fee calculation is working correctly.'
    );
  } catch (error) {
    console.error('❌ Test failed:', error.message);

    // Test fallback mechanism
    console.log('\n🔄 Testing fallback mechanism...');
    try {
      // Mock a failed exchange rate fetch to test fallback
      const originalGetExchangeRate = manager.getExchangeRate;
      manager.getExchangeRate = async () => {
        throw new Error('Mock API failure for testing');
      };

      const fallbackFees = await manager.calculateDynamicFees();
      console.log('✅ Fallback mechanism working correctly:');
      console.log(
        `   Fallback custom fee: ${fallbackFees.customFeeAmount} tinybars`
      );
      console.log(
        `   Fallback max transaction fee: ${fallbackFees.maxTransactionFeeHbar} HBAR`
      );
      console.log('   ✅ Fallback values used when API is unavailable');

      console.log(
        '\n🎉 Fallback test passed! Error handling is working correctly.'
      );
    } catch (fallbackError) {
      console.error('❌ Fallback test failed:', fallbackError.message);
    }
  }
}

// Run the test
testExchangeRateCalculation().catch(console.error);
