(function() {
  'use strict';

  console.log('🔍 Request Sniffer: ISOLATED world content script loaded');

  let currentSettings = {
    enabled: false,
    urlPattern: '.*'
  };

  // Load initial settings
  function loadSettings() {
    chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
      currentSettings.enabled = result.enabled || false;
      currentSettings.urlPattern = result.urlPattern || '.*';
      console.log('🔍 ISOLATED: Initial settings loaded:', currentSettings);
      
      // Send settings to MAIN world
      sendSettingsToMainWorld();
    });
  }

  // Send settings to MAIN world via window messaging
  function sendSettingsToMainWorld() {
    console.log('🔍 ISOLATED: Sending settings to MAIN world:', currentSettings);
    window.postMessage({
      type: 'REQUEST_SNIFFER_SETTINGS',
      settings: currentSettings
    }, '*');
  }

  // Listen for settings changes from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('🔍 ISOLATED: Received message from background:', message);
    if (message.action === 'settingsChanged') {
      currentSettings.enabled = message.enabled;
      currentSettings.urlPattern = message.urlPattern || '.*';
      console.log('🔍 ISOLATED: Settings updated:', currentSettings);
      
      // Forward to MAIN world
      sendSettingsToMainWorld();
    }
  });

  // Listen for storage changes as backup
  chrome.storage.onChanged.addListener((changes) => {
    console.log('🔍 ISOLATED: Storage changed:', changes);
    if (changes.enabled || changes.urlPattern) {
      currentSettings.enabled = changes.enabled?.newValue ?? currentSettings.enabled;
      currentSettings.urlPattern = changes.urlPattern?.newValue ?? currentSettings.urlPattern;
      console.log('🔍 ISOLATED: Settings updated from storage:', currentSettings);
      
      // Forward to MAIN world
      sendSettingsToMainWorld();
    }
  });

  // Handle messages from MAIN world (for logging requests)
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'REQUEST_SNIFFER_LOG') {
      console.log('🔍 ISOLATED: Forwarding request to background:', event.data.requestData);
      chrome.runtime.sendMessage({
        action: 'logRequest',
        data: event.data.requestData
      }).catch((error) => {
        console.warn('🔍 ISOLATED: Failed to send request to background:', error);
      });
    }
  });

  // Load initial settings
  loadSettings();

  console.log('🔍 ISOLATED: Content script setup complete');
})();