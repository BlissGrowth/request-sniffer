document.addEventListener('DOMContentLoaded', function() {
  const toggleEnabled = document.getElementById('toggleEnabled');
  const urlPattern = document.getElementById('urlPattern');
  const requestsList = document.getElementById('requestsList');
  const clearRequestsBtn = document.getElementById('clearRequests');
  const requestModal = document.getElementById('requestModal');
  const closeModal = document.getElementById('closeModal');
  const modalTitle = document.getElementById('modalTitle');
  
  let currentRequests = [];

  chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
    toggleEnabled.checked = result.enabled || false;
    urlPattern.value = result.urlPattern || '.*';
  });

  toggleEnabled.addEventListener('change', function() {
    console.log('🔍 Request Sniffer: Toggling enabled to', toggleEnabled.checked);
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
  
  // Load and display requests
  function loadRequests() {
    chrome.runtime.sendMessage({ action: 'getRequests' }, function(response) {
      if (response && response.requests) {
        currentRequests = response.requests;
        displayRequests(currentRequests);
      }
    });
  }
  
  function displayRequests(requests) {
    if (requests.length === 0) {
      requestsList.innerHTML = '<div class="no-requests">No requests captured yet</div>';
      return;
    }
    
    const html = requests.map(request => {
      const statusClass = getStatusClass(request.statusCode);
      const statusColor = getStatusColor(request.statusCode);
      const timestamp = new Date(request.capturedAt).toLocaleTimeString();
      const url = truncateUrl(request.url, 40);
      
      return `
        <div class="request-item" data-request-id="${request.id}">
          <div class="request-status">
            <div class="status-circle ${statusClass}" style="background-color: ${statusColor}"></div>
          </div>
          <div class="request-info">
            <div class="request-method">${request.method}</div>
            <div class="request-url" title="${request.url}">${url}</div>
            <div class="request-time">${timestamp}</div>
          </div>
          <div class="request-status-code">${request.statusCode || '---'}</div>
        </div>
      `;
    }).join('');
    
    requestsList.innerHTML = html;
    
    // Add click handlers
    document.querySelectorAll('.request-item').forEach(item => {
      item.addEventListener('click', function() {
        const requestId = this.getAttribute('data-request-id');
        const request = currentRequests.find(r => r.id == requestId);
        if (request) {
          showRequestDetails(request);
        }
      });
    });
  }
  
  function getStatusClass(statusCode) {
    if (!statusCode) return 'status-unknown';
    if (statusCode >= 200 && statusCode < 300) return 'status-success';
    if (statusCode >= 300 && statusCode < 400) return 'status-redirect';
    if (statusCode >= 400) return 'status-error';
    return 'status-unknown';
  }
  
  function getStatusColor(statusCode) {
    if (!statusCode) return '#999';
    if (statusCode >= 200 && statusCode < 300) return '#4CAF50'; // green
    if (statusCode >= 300 && statusCode < 400) return '#FF9800'; // orange
    if (statusCode >= 400) return '#f44336'; // red
    return '#999'; // gray
  }
  
  function truncateUrl(url, maxLength) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
  
  function showRequestDetails(request) {
    modalTitle.textContent = `${request.method} ${request.url}`;
    
    // Populate tab contents
    document.getElementById('requestHeadersContent').textContent = formatHeaders(request.requestHeaders);
    document.getElementById('requestBodyContent').textContent = formatBody(request.requestBody);
    document.getElementById('responseHeadersContent').textContent = formatHeaders(request.responseHeaders);
    document.getElementById('responseBodyContent').textContent = formatBody(request.responseBody);
    
    // Show modal
    requestModal.style.display = 'block';
  }
  
  function formatHeaders(headers) {
    if (!headers) return 'No headers';
    if (typeof headers === 'object') {
      return JSON.stringify(headers, null, 2);
    }
    return String(headers);
  }
  
  function formatBody(body) {
    if (!body) return 'No body';
    if (typeof body === 'object') {
      return JSON.stringify(body, null, 2);
    }
    return String(body);
  }
  
  // Clear requests handler
  clearRequestsBtn.addEventListener('click', function() {
    chrome.runtime.sendMessage({ action: 'clearRequests' }, function(response) {
      if (response && response.success) {
        currentRequests = [];
        displayRequests([]);
      }
    });
  });
  
  // Modal handlers
  closeModal.addEventListener('click', function() {
    requestModal.style.display = 'none';
  });
  
  window.addEventListener('click', function(event) {
    if (event.target === requestModal) {
      requestModal.style.display = 'none';
    }
  });
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const tabName = this.getAttribute('data-tab');
      
      // Remove active from all tabs and panes
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      
      // Add active to clicked tab and corresponding pane
      this.classList.add('active');
      document.getElementById(tabName).classList.add('active');
    });
  });
  
  // Load requests initially
  loadRequests();
  
  // Refresh requests every 2 seconds
  setInterval(loadRequests, 2000);
});