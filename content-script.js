(function() {
  'use strict';

  let isEnabled = false;
  let urlPattern = '.*';
  let compiledRegex = new RegExp('.*'); // Initialize with default
  let settingsLoaded = false;

  function updateSettings() {
    console.log('🔍 Request Sniffer: Loading settings...');
    
    // In MAIN world, chrome APIs might not be available directly
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get(['enabled', 'urlPattern'], function(result) {
        isEnabled = result.enabled || false;
        urlPattern = result.urlPattern || '.*';
        try {
          compiledRegex = new RegExp(urlPattern);
          console.log('🔍 Request Sniffer: Settings loaded -', {
            isEnabled,
            urlPattern,
            regexTest: compiledRegex.test('https://api.example.com')
          });
        } catch (e) {
          console.warn('🔍 Request Sniffer: Invalid regex, using default:', e);
          compiledRegex = new RegExp('.*');
        }
        settingsLoaded = true;
      });
    } else {
      console.warn('🔍 Request Sniffer: Chrome APIs not available in MAIN world, using defaults');
      isEnabled = true; // Enable by default when can't access storage
      urlPattern = '.*';
      compiledRegex = new RegExp('.*');
      settingsLoaded = true;
    }
  }

  function shouldCapture(url) {
    const result = isEnabled && compiledRegex && compiledRegex.test(url);
    console.log('🔍 Request Sniffer: shouldCapture -', {
      url,
      isEnabled,
      hasRegex: !!compiledRegex,
      regexMatches: compiledRegex ? compiledRegex.test(url) : false,
      result,
      settingsLoaded
    });
    return result;
  }

  function isJsonContent(contentType) {
    return contentType && contentType.toLowerCase().includes('application/json');
  }

  function parseJsonSafely(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return text;
    }
  }

  function resolveFullUrl(resource, baseUrl = window.location.href) {
    try {
      // Handle string URLs and Request objects
      const urlString = typeof resource === 'string' ? resource : resource.url;
      
      // Create full URL using current page as base for relative URLs
      const fullUrl = new URL(urlString, baseUrl);
      return {
        fullUrl: fullUrl.href,
        baseUrl: `${fullUrl.protocol}//${fullUrl.host}`,
        path: fullUrl.pathname + fullUrl.search + fullUrl.hash,
        isRelative: !urlString.startsWith('http') && !urlString.startsWith('//')
      };
    } catch (e) {
      console.warn('🔍 MAIN: Failed to parse URL:', resource, e);
      // Fallback for malformed URLs
      const urlString = typeof resource === 'string' ? resource : resource.url;
      return {
        fullUrl: urlString,
        baseUrl: window.location.origin,
        path: urlString,
        isRelative: false
      };
    }
  }

  function logRequestResponse(data) {
    // Send to ISOLATED world for forwarding to background
    console.log('🔍 MAIN: Sending request to ISOLATED world:', data.url);
    window.postMessage({
      type: 'REQUEST_SNIFFER_LOG',
      requestData: data
    }, '*');
  }

  // Override fetch API
  const originalFetch = window.fetch;
  window.fetch = function(resource, init = {}) {
    console.log("Fetch intercepted:", resource, init);
    
    // Parse and resolve URL
    const urlInfo = resolveFullUrl(resource);
    const fullUrl = urlInfo.fullUrl;
    
    if (!shouldCapture(fullUrl)) {
      console.log('🔍 Request Sniffer: Fetch not captured:', fullUrl);
      return originalFetch.apply(this, arguments);
    }
    
    console.log('🔍 Request Sniffer: ✅ Capturing fetch:', fullUrl, urlInfo.isRelative ? '(relative)' : '(absolute)');

    const startTime = Date.now();
    const requestData = {
      timestamp: new Date().toISOString(),
      method: init.method || 'GET',
      url: fullUrl,
      baseUrl: urlInfo.baseUrl,
      path: urlInfo.path,
      isRelative: urlInfo.isRelative,
      originalUrl: typeof resource === 'string' ? resource : resource.url,
      type: 'fetch'
    };

    // Capture request headers
    if (init.headers) {
      requestData.requestHeaders = {};
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          requestData.requestHeaders[key] = value;
        });
      } else if (typeof init.headers === 'object') {
        requestData.requestHeaders = { ...init.headers };
      }
    }

    // Capture request body
    if (init.body) {
      if (typeof init.body === 'string') {
        const contentType = requestData.requestHeaders?.['content-type'] || 
                          requestData.requestHeaders?.['Content-Type'];
        if (isJsonContent(contentType)) {
          requestData.requestBody = parseJsonSafely(init.body);
        } else {
          requestData.requestBody = init.body;
        }
      } else {
        requestData.requestBody = init.body;
      }
    }

    return originalFetch.apply(this, arguments).then(response => {
      const responseTime = Date.now() - startTime;
      
      // Capture response headers
      const responseHeaders = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      requestData.responseHeaders = responseHeaders;
      requestData.statusCode = response.status;
      requestData.statusText = response.statusText;
      requestData.responseTime = responseTime;

      // Check if we should log this request (JSON API detection)
      const requestContentType = requestData.requestHeaders?.['content-type'] || 
                                requestData.requestHeaders?.['Content-Type'];
      const responseContentType = responseHeaders['content-type'];
      
      const isJsonRequest = isJsonContent(requestContentType);
      const isJsonResponse = isJsonContent(responseContentType);
      
      // Log ALL matching requests for debugging, not just JSON APIs
      console.log('🔍 Request Sniffer: Response received for:', fullUrl, {
        isJsonRequest,
        isJsonResponse,
        hasApiInUrl: fullUrl.includes('api'),
        willLog: true, // Always log for debugging
        baseUrl: requestData.baseUrl,
        path: requestData.path,
        isRelative: requestData.isRelative
      });
      
      // Clone response to read body
      const responseClone = response.clone();
      
      if (isJsonContent(responseContentType)) {
        responseClone.text().then(text => {
          requestData.responseBody = parseJsonSafely(text);
          logRequestResponse(requestData);
        }).catch((err) => {
          console.warn('🔍 Request Sniffer: Failed to read response body:', err);
          logRequestResponse(requestData);
        });
      } else {
        logRequestResponse(requestData);
      }

      return response;
    }).catch(error => {
      requestData.error = error.message;
      logRequestResponse(requestData);
      throw error;
    });
  };

  // Override XMLHttpRequest
  const originalXHROpen = XMLHttpRequest.prototype.open;
  const originalXHRSend = XMLHttpRequest.prototype.send;
  const originalXHRSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;

  XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
    console.log("XHR opened:", method, url);
    
    // Parse and resolve URL
    const urlInfo = resolveFullUrl(url);
    
    this._requestData = {
      timestamp: new Date().toISOString(),
      method: method,
      url: urlInfo.fullUrl,
      baseUrl: urlInfo.baseUrl,
      path: urlInfo.path,
      isRelative: urlInfo.isRelative,
      originalUrl: url,
      type: 'xhr',
      requestHeaders: {}
    };
    this._startTime = Date.now();
    
    return originalXHROpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.setRequestHeader = function(name, value) {
    if (this._requestData) {
      this._requestData.requestHeaders[name] = value;
    }
    return originalXHRSetRequestHeader.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function(body) {
    if (!this._requestData || !shouldCapture(this._requestData.url)) {
      if (this._requestData) {
        console.log('🔍 Request Sniffer: XHR not captured:', this._requestData.url);
      }
      return originalXHRSend.apply(this, arguments);
    }
    
    console.log('🔍 Request Sniffer: ✅ Capturing XHR:', this._requestData.url, this._requestData.isRelative ? '(relative)' : '(absolute)');

    // Capture request body
    if (body) {
      if (typeof body === 'string') {
        const contentType = this._requestData.requestHeaders['content-type'] || 
                          this._requestData.requestHeaders['Content-Type'];
        if (isJsonContent(contentType)) {
          this._requestData.requestBody = parseJsonSafely(body);
        } else {
          this._requestData.requestBody = body;
        }
      } else {
        this._requestData.requestBody = body;
      }
    }

    const originalOnReadyStateChange = this.onreadystatechange;
    
    this.onreadystatechange = function() {
      if (this.readyState === 4) { // DONE
        const responseTime = Date.now() - this._startTime;
        
        // Capture response data
        const responseHeaders = {};
        const headerString = this.getAllResponseHeaders();
        if (headerString) {
          headerString.split('\r\n').forEach(line => {
            const parts = line.split(': ');
            if (parts.length === 2) {
              responseHeaders[parts[0]] = parts[1];
            }
          });
        }

        this._requestData.responseHeaders = responseHeaders;
        this._requestData.statusCode = this.status;
        this._requestData.statusText = this.statusText;
        this._requestData.responseTime = responseTime;

        // Check if we should log this request (JSON API detection)
        const requestContentType = this._requestData.requestHeaders['content-type'] || 
                                  this._requestData.requestHeaders['Content-Type'];
        const responseContentType = responseHeaders['content-type'];
        
        const isJsonRequest = isJsonContent(requestContentType);
        const isJsonResponse = isJsonContent(responseContentType);
        
        // Log ALL matching requests for debugging, not just JSON APIs  
        console.log('🔍 Request Sniffer: XHR Response received for:', this._requestData.url, {
          isJsonRequest,
          isJsonResponse,
          hasApiInUrl: this._requestData.url.includes('api'),
          willLog: true, // Always log for debugging
          baseUrl: this._requestData.baseUrl,
          path: this._requestData.path,
          isRelative: this._requestData.isRelative
        });
        
        // Capture response body if JSON
        if (isJsonContent(responseContentType) && this.responseText) {
          this._requestData.responseBody = parseJsonSafely(this.responseText);
        }
        
        logRequestResponse(this._requestData);
      }
      
      if (originalOnReadyStateChange) {
        originalOnReadyStateChange.apply(this, arguments);
      }
    };

    return originalXHRSend.apply(this, arguments);
  };

  // Listen for settings from ISOLATED world via window messaging
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'REQUEST_SNIFFER_SETTINGS') {
      console.log('🔍 MAIN: Received settings from ISOLATED world:', event.data.settings);
      const settings = event.data.settings;
      isEnabled = settings.enabled;
      urlPattern = settings.urlPattern || '.*';
      try {
        compiledRegex = new RegExp(urlPattern);
        console.log('🔍 MAIN: Settings updated -', {
          isEnabled,
          urlPattern,
          regexTest: compiledRegex.test('https://api.example.com')
        });
      } catch (e) {
        console.warn('🔍 MAIN: Invalid regex, using default:', e);
        compiledRegex = new RegExp('.*');
      }
      settingsLoaded = true;
    }
  });

  // Initial settings load
  console.log('🔍 MAIN: Content script loaded on:', window.location.href);
  
  // Try legacy settings load as fallback
  updateSettings();
  
  // Also try to set default enabled state for debugging
  setTimeout(() => {
    if (!settingsLoaded) {
      console.warn('🔍 MAIN: Settings not loaded after 2s, using defaults');
      isEnabled = true; // Enable by default for debugging
      compiledRegex = new RegExp('.*'); // Match everything
      settingsLoaded = true;
    }
  }, 2000);
})();
