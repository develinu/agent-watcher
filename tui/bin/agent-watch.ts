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

  Examples
    $ agent-watch
    $ agent-watch --port 3002
    $ agent-watch -P my-project-id
`,
  {
    importMeta: import.meta,
    flags: {
      port: { type: "number", shortFlag: "p", default: 3001 },
      host: { type: "string", default: "localhost" },
      project: { type: "string", shortFlag: "P" },
    },
  }
);

render(
  React.createElement(App, {
    host: cli.flags.host,
    port: cli.flags.port,
    projectIdOverride: cli.flags.project,
  })
);
