const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createServer,
  getPaneConnectionState,
  hasSshTitle,
  hasSshDisconnectSignal,
  isSshCommand,
  renderHighlightedLog,
} = require("../server");

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test("GET /api/panes returns discovered panes as JSON", async () => {
  const panes = [{ paneId: "%12", label: "codex:0.main.0" }];
  const server = createServer({
    tmux: {
      listPanes: async () => panes,
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/panes`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
    assert.deepEqual(await response.json(), { panes });
  } finally {
    await close(server);
  }
});

test("GET /api/pane/:id/log returns selected pane text", async () => {
  const calls = [];
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async (paneId, lines) => {
        calls.push({ paneId, lines });
        return "line one\nline two";
      },
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/pane/%2512/log?lines=300`);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), "line one\nline two");
    assert.deepEqual(calls, [{ paneId: "%12", lines: "300" }]);
  } finally {
    await close(server);
  }
});

test("GET /api/pane/:id/log rejects invalid pane ids", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => {
        throw new Error("must not be called");
      },
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/pane/not-a-pane/log`);
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid tmux pane id" });
  } finally {
    await close(server);
  }
});

test("DELETE /api/session/:name kills only a currently listed session", async () => {
  const killed = [];
  const server = createServer({
    tmux: {
      listPanes: async () => [
        { session: "tmux-log-viewer-preview", paneId: "%1", label: "tmux-log-viewer-preview:0.zsh.0" },
      ],
      capturePane: async () => "",
      killSession: async (sessionName) => {
        killed.push(sessionName);
      },
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/session/tmux-log-viewer-preview`, { method: "DELETE" });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { stopped: "tmux-log-viewer-preview" });
    assert.deepEqual(killed, ["tmux-log-viewer-preview"]);
  } finally {
    await close(server);
  }
});

test("DELETE /api/session/:name rejects unknown sessions", async () => {
  let killCalled = false;
  const server = createServer({
    tmux: {
      listPanes: async () => [
        { session: "active-session", paneId: "%1", label: "active-session:0.zsh.0" },
      ],
      capturePane: async () => "",
      killSession: async () => {
        killCalled = true;
      },
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/session/not-listed`, { method: "DELETE" });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Session not found" });
    assert.equal(killCalled, false);
  } finally {
    await close(server);
  }
});

test("DELETE /api/session/:name rejects unsafe session names", async () => {
  let killCalled = false;
  const server = createServer({
    tmux: {
      listPanes: async () => [
        { session: "safe", paneId: "%1", label: "safe:0.zsh.0" },
      ],
      capturePane: async () => "",
      killSession: async () => {
        killCalled = true;
      },
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/api/session/bad%3Bkill-server`, { method: "DELETE" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid tmux session name" });
    assert.equal(killCalled, false);
  } finally {
    await close(server);
  }
});

test("GET / serves the browser dashboard", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.match(html, /Tmux Log Viewer/);
    assert.match(html, /api\/panes/);
    assert.match(html, /stop-session/);
    assert.match(html, /function stopSession/);
  } finally {
    await close(server);
  }
});

test("GET / includes prompt-only log rendering styles", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /\.prompt-local/);
    assert.match(html, /\.prompt-remote/);
    assert.match(html, /\.prompt-command/);
    assert.match(html, /\.command-input/);
    assert.match(html, /\.command-output/);
    assert.match(html, /function classifyLogLine/);
    assert.match(html, /function renderLogLine/);
    assert.match(html, /function renderHighlightedLog/);
  } finally {
    await close(server);
  }
});

test("renderHighlightedLog separates virtualenv shell prompt heads from typed commands", () => {
  const html = renderHighlightedLog(
    '(slj) hx-user@Tigermed-H100:~$ printf "__LS_CHECK_START__ host=%s\\\\n"',
    "",
  );

  assert.match(html, /class="log-line prompt-local command-input"/);
  assert.match(
    html,
    /<span class="prompt-head">\(slj\) hx-user@Tigermed-H100:~\$ <\/span><span class="command-text">printf/,
  );
});

test("GET / keeps dashboard scrolling inside pane and log containers", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /html, body \{ height: 100%; overflow: hidden; \}/);
    assert.match(html, /\.app \{[\s\S]*height: 100vh;[\s\S]*overflow: hidden;/);
    assert.match(html, /aside \{[\s\S]*min-height: 0;[\s\S]*overflow: hidden;/);
    assert.match(html, /main \{[\s\S]*min-height: 0;[\s\S]*overflow: hidden;/);
    assert.match(html, /\.pane-list \{[\s\S]*overscroll-behavior: contain;/);
    assert.match(html, /pre \{[\s\S]*overscroll-behavior: contain;/);
  } finally {
    await close(server);
  }
});

test("GET / only auto-scrolls logs while the user is already near the bottom", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /function isLogNearBottom/);
    assert.match(html, /function renderLog\(forceScroll\)/);
    assert.match(html, /const shouldFollow = Boolean\(forceScroll\) \|\| \(autoScroll\.checked && isLogNearBottom\(\)\);/);
    assert.match(html, /const previousScrollTop = log\.scrollTop;/);
    assert.match(html, /log\.scrollTop = previousScrollTop;/);
    assert.match(html, /renderLog\(force\);/);
    assert.match(html, /autoScroll\.addEventListener\("change"/);
  } finally {
    await close(server);
  }
});

test("SSH connection state is connected while ssh is the pane command", () => {
  assert.equal(isSshCommand("ssh"), true);
  assert.equal(getPaneConnectionState({ paneId: "%1", command: "ssh" }, {}, "%1", ""), "connected");
});

test("SSH connection state is connected while pane title is an ssh URL", () => {
  assert.equal(hasSshTitle("ssh://hx-user@172.22.35.45"), true);
  assert.equal(
    getPaneConnectionState(
      { paneId: "%1", command: "zsh", title: "ssh://hx-user@172.22.35.45" },
      {},
      "%1",
      "",
    ),
    "connected",
  );
});

test("SSH connection state treats disconnect output as stronger than an ssh title", () => {
  const logText = "Connection to ydtunnel.tigermed.net closed by remote host.\nConnection to ydtunnel.tigermed.net closed.";

  assert.equal(
    getPaneConnectionState(
      { paneId: "%1", command: "zsh", title: "ssh://hx-user@172.22.35.45" },
      {},
      "%1",
      logText,
    ),
    "disconnected",
  );
});

test("SSH connection state is disconnected after a known ssh pane returns to a shell", () => {
  assert.equal(
    getPaneConnectionState({ paneId: "%1", command: "zsh" }, { "%1": true }, "%1", ""),
    "disconnected",
  );
});

test("SSH connection state detects disconnect output in the selected pane log", () => {
  const logText = "client_loop: send disconnect: Broken pipe\nConnection to host.example closed.";

  assert.equal(hasSshDisconnectSignal(logText), true);
  assert.equal(getPaneConnectionState({ paneId: "%1", command: "zsh" }, {}, "%1", logText), "disconnected");
});

test("SSH connection state ignores ordinary local panes", () => {
  assert.equal(isSshCommand("node"), false);
  assert.equal(getPaneConnectionState({ paneId: "%1", command: "node" }, {}, "%1", "npm test"), "none");
});

test("GET / includes SSH connection status indicators", async () => {
  const server = createServer({
    tmux: {
      listPanes: async () => [],
      capturePane: async () => "",
    },
  });
  const baseUrl = await listen(server);

  try {
    const response = await fetch(`${baseUrl}/`);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /\.connection-dot/);
    assert.match(html, /\.connection-connected/);
    assert.match(html, /\.connection-disconnected/);
    assert.match(html, /function renderConnectionDot/);
    assert.match(html, /function getPaneConnectionState/);
  } finally {
    await close(server);
  }
});
