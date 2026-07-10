import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

const STANDARD_HEADERS = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "connection",
  "host",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "upgrade-insecure-requests",
  "user-agent",
  "cache-control",
  "pragma",
  "cookie",
  "referer",
]);

function decode(value) {
  return Buffer.from(value, "latin1").toString("utf8");
}

app.get("/", (c) => {
  const headers = [...c.req.raw.headers.entries()].map(([name, value]) => [
    name,
    decode(value),
  ]);

  console.log("\n--- Incoming request headers ---");
  for (const [name, value] of headers) {
    const mark = STANDARD_HEADERS.has(name) ? "   " : ">> ";
    console.log(`${mark}${name}: ${value}`);
  }
  console.log("--------------------------------\n");

  const rows = headers
    .map(([name, value]) => {
      const injected = !STANDARD_HEADERS.has(name);
      return `<tr class="${injected ? "injected" : ""}"><td>${name}</td><td>${value}</td></tr>`;
    })
    .join("");

  return c.html(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>HTTP Header Injector Playground</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 2rem; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-family: monospace; }
      th { background: #f5f5f5; }
      tr.injected td { background: #fff3cd; font-weight: bold; }
    </style>
  </head>
  <body>
    <h1>HTTP Header Injector Playground</h1>
    <p>Rows highlighted in yellow (and marked <code>&gt;&gt;</code> in the server console) are likely injected by the extension.</p>
    <table>
      <thead><tr><th>Header</th><th>Value</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body>
</html>`);
});

const port = 3000;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Playground server running at http://localhost:${info.port}`);
});
