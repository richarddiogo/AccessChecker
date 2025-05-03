// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openSidePanel') {
    try {
      chrome.sidePanel.open();
      sendResponse({ success: true });
    } catch (error) {
      console.error('Error opening side panel:', error);
      sendResponse({ success: false, error: error.message });
    }
  }
  
  // Return true for asynchronous response
  return true;
});

// Set up the side panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });