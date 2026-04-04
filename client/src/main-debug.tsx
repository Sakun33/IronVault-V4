import { createRoot } from "react-dom/client";
import React from "react";

// Simple test component
function TestApp() {
  return React.createElement('div', { 
    style: { 
      padding: '20px', 
      fontFamily: 'Arial, sans-serif',
      backgroundColor: '#f0f0f0',
      minHeight: '100vh'
    } 
  }, [
    React.createElement('h1', { key: 'title' }, 'SecureVault Test'),
    React.createElement('p', { key: 'status' }, '✅ React is working!'),
    React.createElement('p', { key: 'time' }, `Loaded at: ${new Date().toLocaleTimeString()}`),
    React.createElement('button', { 
      key: 'test-btn',
      onClick: () => alert('JavaScript is working!'),
      style: { padding: '10px 20px', margin: '10px 0' }
    }, 'Test Button')
  ]);
}

const rootElement = document.getElementById("root");
if (rootElement) {
  console.log('✅ Root element found');
  const root = createRoot(rootElement);
  root.render(React.createElement(TestApp));
  console.log('✅ React app rendered');
} else {
  console.error('❌ Root element not found!');
  document.body.innerHTML = '<h1>Error: Root element not found!</h1>';
}
