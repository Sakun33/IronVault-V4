// Vault Decryption Diagnostic Tool
// Run this in the browser console at http://localhost:5173

console.log('🔍 Starting vault decryption diagnostic...');

async function diagnoseVaultDecryption() {
    try {
        // Check if vault storage is available
        if (!window.vaultStorage) {
            throw new Error('Vault storage not available. Please make sure you are logged in.');
        }

        console.log('✅ Vault storage found');

        // Get vault metadata
        console.log('📊 Checking vault metadata...');
        const metadata = await window.vaultStorage.getMetadata();
        
        if (!metadata) {
            console.log('❌ No vault metadata found - vault may not exist');
            return;
        }

        console.log('✅ Vault metadata found:', {
            createdAt: metadata.createdAt,
            lastModified: metadata.lastModified,
            encryptionSalt: metadata.encryptionSalt ? 'Present' : 'Missing',
            kdfConfig: metadata.kdfConfig || 'Using legacy default'
        });

        // Check if there's existing data
        console.log('📋 Checking for existing data...');
        const allData = await window.vaultStorage.getAllData();
        console.log('📊 Existing data counts:', Object.keys(allData).map(key => `${key}: ${allData[key]?.length || 0}`));

        // Check password verification entry
        console.log('🔐 Checking password verification...');
        const testEntry = await window.vaultStorage.getPasswordVerificationEntry();
        
        if (testEntry) {
            console.log('✅ Password verification entry found');
            console.log('📊 Test entry details:', {
                hasData: !!testEntry.data,
                hasIV: !!testEntry.iv,
                dataLength: testEntry.data?.length || 0,
                ivLength: testEntry.iv?.length || 0
            });
        } else {
            console.log('❌ No password verification entry found');
        }

        // Test current encryption key
        console.log('🔑 Testing current encryption key...');
        if (window.vaultStorage.encryptionKey) {
            console.log('✅ Encryption key is set');
            
            // Try to decrypt a test entry if it exists
            if (testEntry) {
                try {
                    const encrypted = new Uint8Array(CryptoService.base64ToArrayBuffer(testEntry.data));
                    const iv = CryptoService.base64ToUint8Array(testEntry.iv);
                    const decrypted = await CryptoService.decrypt(encrypted, window.vaultStorage.encryptionKey, iv);
                    const decryptedText = new TextDecoder().decode(decrypted);
                    
                    if (decryptedText === 'VAULT_PASSWORD_VERIFICATION') {
                        console.log('✅ Current encryption key works correctly');
                    } else {
                        console.log('❌ Current encryption key produces wrong result:', decryptedText);
                    }
                } catch (error) {
                    console.log('❌ Current encryption key failed to decrypt:', error.message);
                }
            }
        } else {
            console.log('❌ No encryption key set');
        }

        // Check IndexedDB directly
        console.log('🗄️ Checking IndexedDB directly...');
        const db = await new Promise((resolve, reject) => {
            const request = indexedDB.open('SecureVaultDB', 1);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        const transaction = db.transaction(['vault_data'], 'readonly');
        const store = transaction.objectStore('vault_data');
        const countRequest = store.count();
        
        const count = await new Promise((resolve, reject) => {
            countRequest.onsuccess = () => resolve(countRequest.result);
            countRequest.onerror = () => reject(countRequest.error);
        });

        console.log(`📊 IndexedDB contains ${count} items`);

        // Get a sample of items
        const getAllRequest = store.getAll();
        const allItems = await new Promise((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        console.log('📋 Sample items in IndexedDB:', allItems.slice(0, 3).map(item => ({
            store: item.store,
            hasData: !!item.data,
            hasIV: !!item.iv,
            dataLength: item.data?.length || 0
        })));

        // Provide recommendations
        console.log('\n🔧 Recommendations:');
        
        if (count === 0) {
            console.log('💡 No data found - vault may be empty or corrupted');
            console.log('💡 Try running the comprehensive data generator');
        } else if (!window.vaultStorage.encryptionKey) {
            console.log('💡 Encryption key not set - try logging out and logging back in');
        } else if (testEntry && count > 0) {
            console.log('💡 Data exists but decryption fails - possible key mismatch');
            console.log('💡 Try creating a new vault or check master password');
        } else {
            console.log('💡 Vault appears to be working correctly');
        }

    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
    }
}

// Run the diagnostic
diagnoseVaultDecryption();

console.log('📋 Vault decryption diagnostic completed. Check console for results.');
