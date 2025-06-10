#!/usr/bin/env node

// Demonstration of chunked message handling in the Hiero JSON-RPC Relay Proxy
// This script shows how the proxy handles messages that are automatically
// split into multiple chunks by Hedera when they exceed 1024KB

const { HederaManager } = require('../packages/proxy/src/hederaManager');

// Example chunked messages from the user's prompt
const chunk1 = {
    "chunk_info": {
        "initial_transaction_id": {
            "account_id": "0.0.1545",
            "nonce": 0,
            "scheduled": false,
            "transaction_valid_start": "1749506740.674505590"
        },
        "number": 1,
        "total": 2
    },
    "consensus_timestamp": "1749506748.960591000",
    "message": "eyJrZXkiOiJkYzFwVWVydFRMbUhhQjFHNm9zdURhTExjUUoyNDVTVGp0cHZ1RGhJQ3plWThsb3FmTzhFOUZSLyswZ2lzMFBITHFOWnVpUU4yU2h5Z2ljb3kzOEZTUnpMVlVENms5OXc1WWxrK3pjV2dsL0NqRjJvR0tVbVVkTjVadFlzb1I0T3o4ZTVRdkErYnpRK0trcHZHdkhsM05ZajdycUIrTkhFd1BXU0JhL0ZNNitIODUvdURvOUlrRW02dkYybkkyaDVOS3cvUWM1djNtSG56a3UvZytsTTBGK2M0ejUwVFlvMzVrS2pCb3dzMmo3eHp2VStVMFpreHRvOERIMjNOOHJralNhQnA0R2tLSngwY3pXZzk1K2x3UXBQTTBySHJock5YYUQvYWt3dTd4YmRrc3pKZ1lFZEV0WVREZEtxakdycnlXTlBad0l1N0ZVODF6dDkrOGhvRGc9PSIsIml2Ijoib2lHMWVBOXp0ZGhGYjlYVEZ0WEFvUT09IiwiZGF0YSI6IjlaajFkaW1JTmd6bU5qZHNCZU9XYUxweTZwbHduaG1VVUJJajV6R1pCNVc2MmNDU2ZGUVVoajVHTys0L0UyNXlLTDRnb3BzVnhXZG4wWjBRKytuVTJYUXJyTytWWnRhQzRUM3RtMVBzMGdrYit3blNocmNwa09KVFRxeTlzdGtSSGFkaUtxTDNwZUdEUWg2c05FR01PTDFKdGdQTGhBcDdMYll0OVdKa2J4YXdvKzNXZEptUVpaZUNOelI1NHFDUDk1dXJIM2xCcWYxb3M0UzRUL2xzQ1o1YW1YSUx1YWkwQkc2cFM4ZmhHUXdVcXNCL0NzR0ppVkR6M2FHQmtuY0FDUE0wLytDR3MrNlNoMERCYjBseTNTVDlWc1R0ZXZieUk3QVZDVk5oOFVYM1kyNEhpOVdBL1kxNHV0Wko4V3ljb0pNSEZxYUhPNXNqZ2VoajhVWnVpdDhjUU9pcjd2NWJrbmhZZU4zVGl2MHRRaTUrb0R4UXgrcmE1NENlcnhnMXlLeTBLeWdNWk1LM0xtcGZKaytzY1Jla2hqR2RLK2ZlSDBTUmQwdnZvb2hWTHpldVZNTkR5ZG5JRjlvQkxuVzd3WDRHTTlpcWNPa3dkdlBWY1B4MGV1RlI5VFdJNTFFM3NUUDc0NytuRGp0b0lkYm1ZeUZVdVMvajJNaXBlbjcyMXhkTDNuY0h4MURHVithWnByTkdTWURkZXg5eWFrREQ2RmJNZXltREliT0luU1h4NUlXYUJsM0NEeTM5Z25YL2FsK3hlOUJHWmRYTFRhZWlRK1FYZVBYT3RGL1JKUHlHYzVJODdMUFNlbzNWMFJVV0NVMEduZA==",
    "payer_account_id": "0.0.1545",
    "running_hash": "5xsTd9M3S1hh5QyeqTYTrFRnT3CXn1t5TKxo9jlFrl7qK9/tszIA9p9AuuRL2hj3",
    "running_hash_version": 3,
    "sequence_number": 2,
    "topic_id": "0.0.6139083"
};

const chunk2 = {
    "chunk_info": {
        "initial_transaction_id": {
            "account_id": "0.0.1545",
            "nonce": 0,
            "scheduled": false,
            "transaction_valid_start": "1749506740.674505590"
        },
        "number": 2,
        "total": 2
    },
    "consensus_timestamp": "1749506749.452717106",
    "message": "OG9Wa05BeHAvd3pYb2VHVDV4SUFXd0tNb3BoTUM3UFVWQ05GWGJRNS8waW1ROFBxeFZ6Mmd0VDJqZi93ejFISmpud2cxaHhiRUEifQ==",
    "payer_account_id": "0.0.1545",
    "running_hash": "6qEQnXqVgX2qJoTuXeY14OSm085RTW3UhY2Y1xP9sG8ZxRJ0yBZQroFMSWNbYUZT",
    "running_hash_version": 3,
    "sequence_number": 3,
    "topic_id": "0.0.6139083"
};

console.log('🎯 Hiero JSON-RPC Relay Proxy - Chunked Message Handling Demo');
console.log('='.repeat(60));

// Initialize HederaManager
const hederaManager = new HederaManager({
    accountId: '0.0.1545',
    privateKey: '302e020100300506032b657004220420' + 'a'.repeat(64),
    network: 'testnet'
});

console.log('\n📦 Demonstrating chunked message handling...\n');

// 1. Show chunk detection
console.log('1️⃣  Chunk Detection:');
console.log(`   Chunk 1 is chunked: ${hederaManager.isChunkedMessage(chunk1)}`);
console.log(`   Chunk 2 is chunked: ${hederaManager.isChunkedMessage(chunk2)}`);

// 2. Show chunk group identification
console.log('\n2️⃣  Chunk Group Identification:');
const groupKey1 = hederaManager.getChunkGroupKey(chunk1);
const groupKey2 = hederaManager.getChunkGroupKey(chunk2);
console.log(`   Chunk 1 group key: ${groupKey1}`);
console.log(`   Chunk 2 group key: ${groupKey2}`);
console.log(`   Same group: ${groupKey1 === groupKey2}`);

// 3. Demonstrate chunk assembly
console.log('\n3️⃣  Chunk Assembly Process:');

// Add first chunk
console.log('   Adding first chunk...');
const result1 = hederaManager.addChunk(chunk1);
console.log(`   Complete message ready: ${result1 !== null}`);

// Add second chunk
console.log('   Adding second chunk...');
const result2 = hederaManager.addChunk(chunk2);
console.log(`   Complete message ready: ${result2 !== null}`);

if (result2) {
    console.log('\n4️⃣  Combined Message Result:');

    // Decode the combined message to show the content
    const combinedContent = Buffer.from(result2.message, 'base64').toString('utf8');

    console.log(`   Sequence number: ${result2.sequence_number}`);
    console.log(`   Consensus timestamp: ${result2.consensus_timestamp}`);
    console.log(`   Payer account: ${result2.payer_account_id}`);
    console.log(`   Has chunk_info: ${!!result2.chunk_info}`);
    console.log(`   Combined content length: ${combinedContent.length} characters`);

    // Show first few characters of the combined content
    console.log(`   Content preview: ${combinedContent.substring(0, 100)}...`);

    // Try to parse as JSON to show it's valid encrypted content
    try {
        const parsed = JSON.parse(combinedContent);
        console.log(`   ✅ Combined content is valid JSON with keys: ${Object.keys(parsed).join(', ')}`);
    } catch (error) {
        console.log(`   ⚠️  Combined content is not JSON: ${error.message}`);
    }
}

console.log('\n5️⃣  Key Features:');
console.log('   ✅ Automatic chunk detection using chunk_info field');
console.log('   ✅ Group identification using transaction_valid_start');
console.log('   ✅ Order-independent chunk assembly (chunks can arrive out of order)');
console.log('   ✅ Automatic cleanup of expired chunk groups');
console.log('   ✅ Seamless integration with existing message processing');

console.log('\n6️⃣  Message Flow:');
console.log('   1. Prover sends large message (>1024KB) to Hedera');
console.log('   2. Hedera automatically splits message into chunks');
console.log('   3. Proxy receives chunks (possibly out of order)');
console.log('   4. Proxy groups chunks by transaction_valid_start');
console.log('   5. When all chunks received, proxy combines them');
console.log('   6. Combined message processed normally (decrypt, verify, etc.)');

console.log('\n🎯 Demo complete! The proxy now supports chunked messages automatically.');
