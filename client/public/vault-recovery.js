// Vault Recovery Tool - Fixes corrupted vaults without losing data
// Run this in the browser console at http://localhost:5173

console.log('🔧 Starting vault recovery tool...');

async function recoverVault() {
    try {
        // Check if vault storage is available
        if (!window.vaultStorage) {
            throw new Error('Vault storage not available. Please make sure you are logged in.');
        }

        console.log('✅ Vault storage found');

        // Step 1: Check current vault status
        console.log('📊 Checking current vault status...');
        const metadata = await window.vaultStorage.getMetadata();
        const allData = await window.vaultStorage.getAllData();
        
        console.log('📋 Current vault status:', {
            hasMetadata: !!metadata,
            dataCounts: Object.keys(allData).map(key => `${key}: ${allData[key]?.length || 0}`),
            totalItems: Object.values(allData).reduce((sum, arr) => sum + (arr?.length || 0), 0)
        });

        // Step 2: Check IndexedDB directly
        console.log('🗄️ Checking IndexedDB directly...');
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureVaultDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const transaction = db.transaction(['vault_data'], 'readonly');
        const store = transaction.objectStore('vault_data');
        const getAllRequest = store.getAll();
        
        const allItems = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        console.log(`📊 IndexedDB contains ${allItems.length} raw items`);

        // Step 3: Analyze the data
        const stores = {};
        allItems.forEach(item => {
            if (!stores[item.store]) {
                stores[item.store] = [];
            }
            stores[item.store].push(item);
        });

        console.log('📋 Data by store:', Object.keys(stores).map(store => `${store}: ${stores[store].length} items`));

        // Step 4: Try to recover data
        if (allItems.length > 0) {
            console.log('🔧 Attempting data recovery...');
            
            // Check if we have a working encryption key
            if (window.vaultStorage.encryptionKey) {
                console.log('✅ Encryption key available, attempting decryption...');
                
                let recoveredCount = 0;
                let failedCount = 0;
                
                for (const [storeName, items] of Object.entries(stores)) {
                    console.log(`🔍 Processing ${storeName}...`);
                    
                    for (const item of items) {
                        try {
                            if (item.data && item.iv) {
                                const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(item.data));
                                const iv = CryptoService.base64ToUint8Array(item.iv);
                                const decrypted = await CryptoService.decrypt(encrypted, window.vaultStorage.encryptionKey, iv);
                                const decryptedText = new TextDecoder().decode(decrypted);
                                const parsedData = JSON.parse(decryptedText);
                                
                                recoveredCount++;
                                console.log(`✅ Recovered item from ${storeName}:`, parsedData);
                            }
                        } catch (error) {
                            failedCount++;
                            console.log(`❌ Failed to decrypt item from ${storeName}:`, error.message);
                        }
                    }
                }
                
                console.log(`📊 Recovery results: ${recoveredCount} recovered, ${failedCount} failed`);
                
                if (recoveredCount > 0) {
                    console.log('✅ Data recovery successful!');
                    console.log('💡 The vault should now work properly');
                } else {
                    console.log('❌ No data could be recovered');
                    console.log('💡 The encryption key may be incorrect or data is corrupted');
                }
            } else {
                console.log('❌ No encryption key available');
                console.log('💡 Please log in first to set the encryption key');
            }
        } else {
            console.log('📭 No data found in IndexedDB');
            console.log('💡 Vault is empty or data has been cleared');
        }

        // Step 5: Provide recommendations
        console.log('\n🔧 Recovery Recommendations:');
        
        if (allItems.length === 0) {
            console.log('💡 No data found - vault is empty');
            console.log('💡 Run the comprehensive data generator to populate the vault');
        } else if (!window.vaultStorage.encryptionKey) {
            console.log('💡 Data exists but no encryption key - log in to set the key');
        } else {
            console.log('💡 Data and key available - vault should be working');
            console.log('💡 If issues persist, try logging out and logging back in');
        }

    } catch (error) {
        console.error('❌ Recovery failed:', error);
    }
}

// Run the recovery tool
recoverVault();

console.log('📋 Vault recovery tool completed. Check console for results.');
