let isEnabled = false;
let urlPattern = '.*';
let capturedRequests = [];
const MAX_REQUESTS = 100;

chrome.runtime.onStartup.addListener(initializeSettings);
chrome.runtime.onInstalled.addListener(initializeSettings);

function initializeSettings() {
  chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
    isEnabled = result.enabled || false;
    urlPattern = result.urlPattern || '.*';
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Return true to indicate we will send response asynchronously
  const willRespond = request.action === 'getRequests' || request.action === 'clearRequests' || request.action === 'getSettings';
  if (request.action === 'updateSettings') {
    isEnabled = request.enabled;
    urlPattern = request.urlPattern || '.*';
    chrome.storage.sync.set({
      enabled: isEnabled,
      urlPattern: urlPattern
    });
    
    // Forward settings to all content scripts
    console.log('🔍 Background: Forwarding settings to all tabs:', { isEnabled, urlPattern });
    chrome.tabs.query({}, (tabs) => {
      console.log('🔍 Background: Found', tabs.length, 'tabs to update');
      tabs.forEach(tab => {
        console.log('🔍 Background: Sending message to tab', tab.id, tab.url);
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsChanged',
          enabled: isEnabled,
          urlPattern: urlPattern
        }).then(() => {
          console.log('🔍 Background: Message sent successfully to tab', tab.id);
        }).catch((error) => {
          console.warn('🔍 Background: Failed to send message to tab', tab.id, ':', error.message);
        });
      });
    });
  } else if (request.action === 'logRequest') {
    if (isEnabled && request.data) {
      const requestData = {
        ...request.data,
        id: Date.now() + Math.random(), // Unique ID
        capturedAt: new Date().toISOString(),
        tabUrl: sender.tab?.url,
        tabId: sender.tab?.id
      };
      
      // Store request in memory
      capturedRequests.unshift(requestData); // Add to beginning
      
      // Limit stored requests to prevent memory issues
      if (capturedRequests.length > MAX_REQUESTS) {
        capturedRequests = capturedRequests.slice(0, MAX_REQUESTS);
      }
      
      // Still log to console for debugging
      console.log('🔍 Request Sniffer - Captured Request/Response:', requestData);
    }
  } else if (request.action === 'getRequests') {
    // Send requests to popup
    sendResponse({ requests: capturedRequests });
  } else if (request.action === 'clearRequests') {
    // Clear stored requests
    capturedRequests = [];
    sendResponse({ success: true });
  } else if (request.action === 'getSettings') {
    // Send current settings to content script
    console.log('🔍 Background: Sending settings via polling:', { isEnabled, urlPattern });
    sendResponse({ enabled: isEnabled, urlPattern: urlPattern });
  }
  
  return willRespond;
});

initializeSettings();