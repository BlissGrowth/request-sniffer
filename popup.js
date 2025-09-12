document.addEventListener('DOMContentLoaded', function() {
  const toggleEnabled = document.getElementById('toggleEnabled');
  const urlPattern = document.getElementById('urlPattern');

  chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
    toggleEnabled.checked = result.enabled || false;
    urlPattern.value = result.urlPattern || '.*';
  });

  toggleEnabled.addEventListener('change', function() {
    const enabled = toggleEnabled.checked;
    chrome.storage.sync.set({ enabled: enabled });
    
    chrome.runtime.sendMessage({
      action: 'updateSettings',
      enabled: enabled,
      urlPattern: urlPattern.value
    });
  });

  urlPattern.addEventListener('input', function() {
    const pattern = urlPattern.value;
    chrome.storage.sync.set({ urlPattern: pattern });
    
    if (toggleEnabled.checked) {
      chrome.runtime.sendMessage({
        action: 'updateSettings',
        enabled: true,
        urlPattern: pattern
      });
    }
  });
});