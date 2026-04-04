// Enhanced Import Test - Opens modal and imports data
// Run this in the browser console at http://localhost:5173

console.log('🔍 Starting enhanced import test...');

async function testImportWithModal() {
    try {
        // Step 1: Load the comprehensive data
        console.log('📁 Loading comprehensive-realistic-data.json...');
        const response = await fetch('/comprehensive-realistic-data.json');
        
        if (!response.ok) {
            throw new Error(`Failed to load file: ${response.status}`);
        }
        
        const data = await response.text();
        console.log('✅ File loaded successfully, size:', data.length);
        
        // Step 2: Parse and validate JSON
        console.log('🔍 Parsing JSON...');
        const parsedData = JSON.parse(data);
        console.log('✅ JSON parsed successfully');
        console.log('📊 Available sections:', Object.keys(parsedData));
        
        // Step 3: Find and click the Import/Export button
        console.log('🚀 Looking for Import/Export button...');
        const importButton = Array.from(document.querySelectorAll('button')).find(btn => 
            btn.textContent.includes('Import') || 
            btn.textContent.includes('Import / Export') ||
            btn.textContent.includes('Export')
        );
        
        if (!importButton) {
            throw new Error('Could not find Import/Export button');
        }
        
        console.log('✅ Found import button:', importButton.textContent);
        
        // Step 4: Click the button to open the modal
        console.log('🚀 Clicking Import/Export button to open modal...');
        importButton.click();
        
        // Step 5: Wait for modal to open and find file input
        console.log('⏳ Waiting for modal to open...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Look for file input with data-testid
        let fileInput = document.querySelector('[data-testid="input-import-file"]');
        
        // Fallback: look for any file input
        if (!fileInput) {
            fileInput = document.querySelector('input[type="file"]');
        }
        
        if (!fileInput) {
            throw new Error('Could not find file input in modal');
        }
        
        console.log('✅ Found file input:', fileInput);
        
        // Step 6: Create and select the file
        console.log('📤 Creating file object...');
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
        
        console.log('✅ File selection simulated');
        
        // Step 7: Wait a moment for UI to update
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Step 8: Find and click the Import button in the modal
        console.log('🚀 Looking for Import button in modal...');
        const modalImportButton = document.querySelector('[data-testid="button-import"]') || 
                                 Array.from(document.querySelectorAll('button')).find(btn => 
                                     btn.textContent.includes('Import') && 
                                     btn.textContent !== 'Import / Export'
                                 );
        
        if (!modalImportButton) {
            throw new Error('Could not find Import button in modal');
        }
        
        console.log('✅ Found modal import button:', modalImportButton.textContent);
        
        // Step 9: Click the import button
        console.log('🚀 Clicking Import button...');
        modalImportButton.click();
        
        console.log('✅ Import process started!');
        console.log('📋 Watch the console for any errors during import...');
        
        // Step 10: Monitor for errors
        const originalError = console.error;
        console.error = function(...args) {
            console.log('🚨 Import Error Detected:', ...args);
            originalError.apply(console, args);
        };
        
        // Monitor for unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.log('🚨 Unhandled Promise Rejection:', e.reason);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        alert('Test failed: ' + error.message);
    }
}

// Run the enhanced test
testImportWithModal();

console.log('📋 Enhanced import test completed. Check the console for results.');
