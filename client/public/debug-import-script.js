// Debug Import Script - Test the import process step by step
// Run this in the browser console at http://localhost:5173

console.log('🔍 Starting debug import process...');

async function debugImport() {
    try {
        // Load the comprehensive data
        console.log('📁 Loading comprehensive-realistic-data.json...');
        const response = await fetch('/comprehensive-realistic-data.json');
        
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status}`);
        }
        
        const data = await response.text();
        console.log('✅ File loaded successfully, size:', data.length);
        
        // Parse the JSON to check structure
        console.log('🔍 Parsing JSON...');
        const parsedData = JSON.parse(data);
        console.log('✅ JSON parsed successfully');
        console.log('📊 Available sections:', Object.keys(parsedData));
        
        // Check each section
        for (const [section, items] of Object.entries(parsedData)) {
            if (Array.isArray(items)) {
                console.log(`📋 ${section}: ${items.length} items`);
                if (items.length > 0) {
                    console.log(`   Sample item:`, items[0]);
                }
            } else {
                console.log(`📋 ${section}:`, typeof items, items);
            }
        }
        
        // Test the import process
        console.log('🚀 Testing import process...');
        
        // Check if vaultStorage is available
        if (typeof window !== 'undefined' && window.vaultStorage) {
            console.log('✅ Vault storage found');
            
            // Try to import
            console.log('📥 Attempting import...');
            await window.vaultStorage.importVault(data);
            console.log('✅ Import completed successfully!');
            
            // Refresh the page to see results
            console.log('🔄 Refreshing page...');
            window.location.reload();
            
        } else {
            console.log('⚠️ Vault storage not found');
            console.log('💡 Available window objects:', Object.keys(window).filter(k => k.includes('vault') || k.includes('storage')));
        }
        
    } catch (error) {
        console.error('❌ Debug import failed:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // Show alert with error details
        alert(`Debug Import Failed: ${error.message}\n\nCheck console for full details.`);
    }
}

// Run the debug import
debugImport();

console.log('📋 Debug import script completed. Check the console for results.');
