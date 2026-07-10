# Privacy Policy — HTTP Header Injector

Last updated: 2026-07-10

## Information We Collect

HTTP Header Injector (the "Extension") does not collect, store, or transmit any personal information or browsing data. The HTTP header rules you configure are stored only in your browser's local storage (`chrome.storage.local`).

## Permissions

- **declarativeNetRequest**:
  Used to add custom HTTP request headers to outgoing requests according to the rules you configure. This API runs entirely inside the browser; the Extension never reads the contents of your traffic and nothing is sent to any external party.
- **storage**:
  Used solely to save the header rules you configure within your browser.
- **host_permissions (`<all_urls>`)**:
  Required to apply your header-modification rules to the URLs you specify (or to all URLs when no filter is set).

## External Transmission

The Extension does not communicate with any external server. Your settings and the contents of the pages you visit are never sent to any third party.

## Data Storage

The header rules you configure are stored only in `chrome.storage.local` and remain within your browser. Removing the Extension also removes this data.

## Contact

For any questions about this policy, please open an Issue in this repository:

https://github.com/ysknsid25/http-header-injector/issues
