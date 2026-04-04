// Simple Import Test - Test the import process directly
// Run this in the browser console at http://localhost:5173

console.log('🔍 Starting simple import test...');

async function testImport() {
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
            } else {
                console.log(`📋 ${section}:`, typeof items, items);
            }
        }
        
        // Try to trigger the import through the UI
        console.log('🚀 Looking for import button...');
        
        // Find the import button
        const importButton = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Import') || 
            btn.textContent.includes('Import Vault')
        );
        
        if (importButton) {
            console.log('✅ Found import button:', importButton.textContent);
            
            // Check if file input exists
            const fileInput = document.querySelector('input[type="file"]');
            if (fileInput) {
                console.log('✅ Found file input');
                
                // Create a File object
                const file = new File([data], 'comprehensive-realistic-data.json', {
                    type: 'application/json'
                });
                
                // Create DataTransfer to simulate file selection
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                fileInput.files = dataTransfer.files;
                
                // Trigger change event
                const changeEvent = new Event('change', { bubbles: true });
                fileInput.dispatchEvent(changeEvent);
                
                console.log('📤 File selection simulated');
                
                // Wait a moment then click import
                setTimeout(() => {
                    console.log('🚀 Clicking import button...');
                    importButton.click();
                    console.log('✅ Import button clicked!');
                }, 1000);
                
            } else {
                console.log('⚠️ Could not find file input');
            }
        } else {
            console.log('⚠️ Could not find import button');
            console.log('💡 Available buttons:', Array.from(document.querySelectorAll('button')).map(btn => btn.textContent));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        alert('Test failed: ' + error.message);
    }
}

// Run the test
testImport();

console.log('📋 Simple import test completed. Check the console for results.');
