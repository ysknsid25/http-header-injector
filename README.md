# HTTP Header Injector

A Chrome extension for developers that lets you inject custom HTTP **request** headers.

[ModHeader](https://modheader.com/), which had long been a popular choice, was removed from the Chrome Web Store and is no longer available. This repository and Chrome extension provide the essential ModHeader features for free.

# Features

- Add custom HTTP **request** headers to outgoing requests
- Enable / disable each header individually
- Optional URL filter to limit where headers are applied
- An explicit **Save** button — nothing is applied until you save
- Settings are stored only in your browser (`chrome.storage.local`) — no communication with any external server

## Why request headers only?

This extension deliberately does **not** modify response headers. Chrome DevTools already supports overriding responses (including response headers), so there is no reason for an extension to duplicate that. Keeping the scope to request headers makes the tool simpler and safer.

## Security

To prevent this tool from being abused for HTTP header/response splitting (HTTP header injection) attacks, newline characters (CR / LF) and NUL are stripped from header names and values — both in the input UI and when the rules are built.

Header modification is implemented with the Manifest V3 [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) API. Because the rewriting happens inside the browser, the extension itself never reads the contents of your traffic.

# Usage

1. Click the ⇄ icon in the toolbar to open the popup.
2. Click "+ Add" to add a header row, then fill in the **header name** and **value** (e.g. `Authorization` / `Bearer xxxxx`).
3. Use the checkbox on the left of each row to enable / disable that header.
4. Optionally, enter text in the "URL filter" field to apply headers only to requests whose URL contains that text (leave it empty to target all URLs).
5. Click **Save** to apply your changes.

## Examples

| Header name     | Value             | Purpose                              |
| --------------- | ----------------- | ------------------------------------ |
| `Authorization` | `Bearer xxxxx`    | Attach an auth token to API requests |
| `User-Agent`    | `MyTestAgent/1.0` | Swap the User-Agent to test behavior |
| `X-Debug`       | `1`               | Flag requests for a debug backend    |

# Installation

## Chrome Web Store

TBD

## Development build

1. Clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this repository.
5. A ⇄ icon is added to the toolbar (pin it from the extensions menu if needed).

# Building the zip

```
git archive --format=zip -o http-header-injector-{version}.zip HEAD manifest.json background.js src icons
```

# Privacy

This extension does not collect or transmit any personal information or browsing data. See [PRIVACY.md](./PRIVACY.md) for details.
