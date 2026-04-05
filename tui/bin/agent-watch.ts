#!/usr/bin/env node
import meow from "meow";
import React from "react";
import { render } from "ink";
import { App } from "../src/app.js";

const cli = meow(
  `
  Usage
    $ agent-watch

  Options
    --port, -p    Server port (default: 3001)
    --host        Server host (default: localhost)
    --project, -P Project ID override (auto-detected from cwd)
    --debug, -d   Enable debug logging to stderr

  Examples
    $ agent-watch
    $ agent-watch --port 3002
    $ agent-watch -P my-project-id
    $ agent-watch --debug 2>debug.log
`,
  {
    importMeta: import.meta,
    flags: {
      port: { type: "number", shortFlag: "p", default: 3001 },
      host: { type: "string", default: "localhost" },
      project: { type: "string", shortFlag: "P" },
      debug: { type: "boolean", shortFlag: "d", default: false },
    },
  }
);

// Verify server is reachable before entering fullscreen TUI
const baseUrl = `http://${cli.flags.host}:${cli.flags.port}`;

try {
  const res = await fetch(`${baseUrl}/api/status`);
  if (!res.ok) {
    console.error(`Server returned ${res.status} at ${baseUrl}/api/status`);
    process.exit(1);
  }
} catch {
  console.error(`Cannot connect to agent-watcher server at ${baseUrl}`);
  console.error("Start the server first: npm run dev");
  process.exit(1);
}

const instance = render(
  React.createElement(App, {
    host: cli.flags.host,
    port: cli.flags.port,
    projectIdOverride: cli.flags.project,
    debug: cli.flags.debug,
  })
);

await instance.waitUntilExit();
process.exit(0);
