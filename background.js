let isEnabled = false;
let urlPattern = '.*';

chrome.runtime.onStartup.addListener(initializeSettings);
chrome.runtime.onInstalled.addListener(initializeSettings);

function initializeSettings() {
  chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
    isEnabled = result.enabled || false;
    urlPattern = result.urlPattern || '.*';
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'updateSettings') {
    isEnabled = request.enabled;
    urlPattern = request.urlPattern || '.*';
    chrome.storage.sync.set({
      enabled: isEnabled,
      urlPattern: urlPattern
    });
  } else if (request.action === 'logRequest') {
    if (isEnabled && request.data) {
      console.log('🔍 Request Sniffer - Captured Request/Response:', {
        ...request.data,
        capturedAt: new Date().toISOString(),
        tabUrl: sender.tab?.url,
        tabId: sender.tab?.id
      });
    }
  }
});

initializeSettings();