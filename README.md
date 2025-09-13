# Request Sniffer

A powerful Chrome extension for monitoring and analyzing network requests with real-time inspection capabilities and webhook integrations.

## Description

Request Sniffer is a developer-focused Chrome extension that intercepts and analyzes HTTP requests made by web applications. It provides comprehensive request/response inspection, flexible URL pattern matching, and seamless integration with external monitoring systems through webhook notifications.

Perfect for debugging API calls, monitoring network traffic, analyzing application behavior, and integrating with logging or analytics platforms.

## Features

- 🔍 **Real-time Request Interception** - Captures both fetch() and XMLHttpRequest calls
- 🎯 **Flexible URL Pattern Matching** - Uses regex patterns to filter specific requests
- 📊 **Comprehensive Data Capture** - Full request/response headers, bodies, and timing
- 🖥️ **Interactive Popup Interface** - Browse captured requests with detailed inspection modal
- 🌐 **Webhook Integration** - Send captured data to external endpoints via POST requests
- 🔧 **URL Resolution** - Properly handles both relative and absolute URLs
- ⚡ **Manifest V3 Compatible** - Modern Chrome extension architecture
- 🔄 **Cross-World Communication** - Reliable settings sync using dual content script approach

## Installation

### Prerequisites

- Google Chrome browser
- Chrome Developer Mode enabled

### Setup Instructions

1. **Clone or Download the Repository**
   ```bash
   git clone git@github.com:BlissGrowth/request-sniffer.git
   cd request-sniffer
   ```

2. **Install in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked" button
   - Select the `request-sniffer` directory
   - The extension should appear in your Chrome toolbar

## Usage

### Basic Setup

1. **Click the extension** in your Chrome toolbar to open the popup
2. **Enable monitoring** by toggling the "Enable Monitoring" switch
3. **Set URL pattern** (regex) to match the requests you want to capture
   - Example: `.*api.*` captures all URLs containing "api"
   - Example: `^https://api\\.example\\.com/` captures specific API domain
4. **Optional: Set reporting URL** to send captured data to a webhook endpoint

### URL Pattern Examples

| Pattern | Description | Matches |
|---------|-------------|---------|
| `.*` | All requests | Everything |
| `.*api.*` | Contains "api" | `https://example.com/api/users`, `/api/data` |
| `^https://api\\.` | Starts with "https://api." | `https://api.github.com/user` |
| `\\.json$` | Ends with ".json" | `https://example.com/data.json` |
| `/users/\\d+` | User ID endpoints | `/users/123`, `/users/456` |

### Viewing Captured Requests

1. **Request List**: All captured requests appear in the popup with:
   - 🟢 Green circle: Successful requests (2xx status)
   - 🟠 Orange circle: Redirects (3xx status) 
   - 🔴 Red circle: Client/server errors (4xx, 5xx status)
   - ⚪ Gray circle: Unknown/pending status

2. **Request Details**: Click any request to view:
   - **Request Headers** - All headers sent with the request
   - **Request Body** - POST data, JSON payloads, form data
   - **Response Headers** - Server response headers  
   - **Response Body** - JSON responses, HTML content, etc.

3. **Clear History**: Use "Clear All" button to remove all captured requests

### Webhook Integration

Configure a reporting URL to automatically send captured request data to external systems:

1. **Set Reporting URL** in the popup (e.g., `https://your-server.com/webhook`)
2. **Each captured request** will be POST'd as JSON to this endpoint
3. **Payload structure**:

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "method": "POST",
  "url": "https://api.example.com/users",
  "baseUrl": "https://api.example.com", 
  "path": "/users",
  "isRelative": false,
  "originalUrl": "/users",
  "requestHeaders": {
    "Content-Type": "application/json",
    "Authorization": "Bearer token123"
  },
  "requestBody": {
    "name": "John Doe",
    "email": "john@example.com"
  },
  "responseHeaders": {
    "Content-Type": "application/json"
  },
  "responseBody": {
    "id": 123,
    "status": "created"
  },
  "statusCode": 201,
  "statusText": "Created",
  "responseTime": 245,
  "capturedAt": "2025-01-15T10:30:45.123Z",
  "tabUrl": "https://myapp.com/dashboard",
  "tabId": 123456
}
```

## Technical Details

### Architecture

- **Manifest V3** - Uses modern Chrome extension architecture
- **Dual Content Scripts** - ISOLATED world for Chrome APIs, MAIN world for network interception  
- **Cross-World Messaging** - `window.postMessage()` for reliable communication
- **Service Worker** - Background script manages settings and webhook reporting

### URL Resolution

The extension properly resolves relative URLs:
- Relative path `/api/users` on page `https://app.com/dashboard` becomes `https://app.com/api/users`
- Pattern matching always works against the full resolved URL
- Original URL preserved for debugging purposes

### Request Data Structure

Each captured request includes:
- `url` - Complete resolved URL (used for pattern matching)
- `baseUrl` - Protocol + domain + port
- `path` - Pathname + search parameters + hash
- `isRelative` - Boolean indicating if original request was relative
- `originalUrl` - Exact URL string as provided in the request
- Complete headers, bodies, timing, and response data

## Development

### Project Structure

```
request-sniffer/
├── manifest.json              # Extension configuration
├── background.js              # Service worker, settings, webhooks
├── popup.html                 # Extension popup interface
├── popup.js                   # Popup functionality
├── popup.css                  # Popup styling
├── content-script.js          # MAIN world network interception
├── content-script-isolated.js # ISOLATED world Chrome API bridge
└── README.md                  # This documentation
```

## Troubleshooting

### Common Issues

**Extension not capturing requests:**
- Ensure "Enable Monitoring" is toggled on
- Check URL pattern matches the requests you want to capture
- Look for debug logs in browser console (`F12`)
- Verify the target page is making network requests

**Settings not updating:**
- Refresh the target webpage after changing settings
- Check background script console for error messages
- Ensure extension has necessary permissions

**Webhook not working:**
- Verify reporting URL is accessible and accepts POST requests
- Check background script console for HTTP error messages
- Ensure webhook endpoint accepts `application/json` content type

### Debug Logs

Enable detailed logging by:
1. Open `chrome://extensions/`
2. Find Request Sniffer extension
3. Click "service worker" to open background script console
4. Look for logs prefixed with `🔍` for extension-specific messages

## License

MIT License - see repository for details

## Support

For issues, feature requests, or questions:
- Open an issue on the GitHub repository
- Check existing issues for similar problems
- Include browser version, extension version, and steps to reproduce