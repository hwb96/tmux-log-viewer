#!/usr/bin/env node
const http = require("node:http");

const tmuxModule = require("./src/tmux");

const HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tmux Log Viewer</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #101418;
      --panel: #171c22;
      --panel-2: #1e252d;
      --line: #2d3641;
      --text: #e8edf2;
      --muted: #9ba7b4;
      --accent: #4fb3c8;
      --accent-2: #d9a441;
      --danger: #ee6b6e;
      --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      letter-spacing: 0;
    }

    .app {
      display: grid;
      grid-template-columns: minmax(280px, 360px) minmax(0, 1fr);
      height: 100vh;
      min-height: 520px;
    }

    aside {
      border-right: 1px solid var(--line);
      background: var(--panel);
      display: grid;
      grid-template-rows: auto auto minmax(0, 1fr);
      min-width: 0;
    }

    header {
      height: 58px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 0 16px;
      border-bottom: 1px solid var(--line);
    }

    h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 680;
      line-height: 1.2;
    }

    .count, .status, .meta {
      color: var(--muted);
      font-size: 12px;
      white-space: nowrap;
    }

    .filters {
      display: grid;
      gap: 10px;
      padding: 12px;
      border-bottom: 1px solid var(--line);
    }

    input, select, button {
      font: inherit;
      letter-spacing: 0;
    }

    input, select {
      width: 100%;
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #0d1115;
      color: var(--text);
      padding: 7px 10px;
      outline: none;
    }

    input:focus, select:focus, button:focus-visible {
      border-color: var(--accent);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent);
    }

    button {
      min-height: 34px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--panel-2);
      color: var(--text);
      padding: 7px 10px;
      cursor: pointer;
    }

    button:hover { border-color: #506071; }

    .pane-list {
      overflow: auto;
      padding: 8px;
    }

    .pane-row {
      width: 100%;
      display: grid;
      grid-template-columns: minmax(0, 1fr) 58px;
      gap: 6px;
      margin-bottom: 6px;
    }

    .pane-button {
      width: 100%;
      display: grid;
      gap: 4px;
      text-align: left;
      border-color: transparent;
      background: transparent;
    }

    .pane-button:hover { background: var(--panel-2); }
    .pane-button.active {
      background: #12313a;
      border-color: var(--accent);
    }

    .stop-session {
      align-self: stretch;
      min-height: 0;
      padding: 0 8px;
      border-color: #5e3034;
      background: #251315;
      color: #ff9ca5;
      font-size: 12px;
      font-weight: 700;
    }

    .stop-session:hover {
      border-color: #c45661;
      background: #38191d;
      color: #ffd2d6;
    }

    .pane-primary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }

    .pane-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: var(--mono);
      font-size: 13px;
    }

    .badge {
      color: var(--accent-2);
      font-family: var(--mono);
      font-size: 12px;
      flex: 0 0 auto;
    }

    .pane-sub {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--muted);
      font-size: 12px;
    }

    main {
      min-width: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .toolbar {
      min-height: 58px;
      display: grid;
      grid-template-columns: minmax(180px, 1fr) 110px 120px 86px 86px;
      gap: 10px;
      align-items: center;
      padding: 10px 14px;
      border-bottom: 1px solid var(--line);
      background: var(--panel);
    }

    .toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--muted);
      font-size: 13px;
      white-space: nowrap;
    }

    .toggle input {
      width: 16px;
      min-height: 16px;
      accent-color: var(--accent);
    }

    .log-wrap {
      min-height: 0;
      background: #080b0e;
      position: relative;
    }

    pre {
      margin: 0;
      height: 100%;
      overflow: auto;
      padding: 14px 16px 28px;
      color: #d7dde5;
      font-family: var(--mono);
      font-size: 13px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
      tab-size: 2;
    }

    mark {
      background: #6f561d;
      color: #fff5ce;
      border-radius: 3px;
      padding: 0 2px;
    }

    .log-line {
      display: block;
      min-height: 1.45em;
      border-left: 3px solid transparent;
      margin-left: -8px;
      padding-left: 8px;
    }

    .prompt-local {
      color: #8aa3b5;
      background: rgba(80, 116, 145, 0.14);
    }

    .prompt-remote {
      color: #f0b566;
      background: rgba(184, 115, 35, 0.18);
      border-left-color: #d99343;
      font-weight: 700;
    }

    .prompt-command {
      color: #eef6ff;
      background: rgba(79, 179, 200, 0.08);
    }

    .command-input {
      color: #b8f2e6;
      background: rgba(24, 134, 118, 0.18);
      border-left-color: #38c5aa;
      font-weight: 700;
    }

    .command-output {
      color: #b8c9c6;
      background: rgba(62, 93, 87, 0.10);
      border-left-color: rgba(80, 126, 116, 0.65);
    }

    .error { color: var(--danger); }

    @media (max-width: 760px) {
      .app { grid-template-columns: 1fr; grid-template-rows: 260px minmax(0, 1fr); }
      aside { border-right: 0; border-bottom: 1px solid var(--line); }
      .toolbar { grid-template-columns: 1fr 96px 104px; }
      .toolbar button, .toolbar .toggle { min-width: 0; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside>
      <header>
        <h1>Tmux Log Viewer</h1>
        <span class="count" id="count">0 panes</span>
      </header>
      <div class="filters">
        <input id="paneFilter" type="search" placeholder="Filter sessions, windows, commands">
      </div>
      <div class="pane-list" id="paneList"></div>
    </aside>
    <main>
      <div class="toolbar">
        <input id="search" type="search" placeholder="Search selected log">
        <select id="lines">
          <option value="300">300 lines</option>
          <option value="500" selected>500 lines</option>
          <option value="1000">1000 lines</option>
          <option value="2000">2000 lines</option>
        </select>
        <label class="toggle"><input id="autoScroll" type="checkbox" checked>Auto scroll</label>
        <button id="pause">Pause</button>
        <button id="copy">Copy</button>
      </div>
      <div class="log-wrap">
        <pre id="log">Loading tmux panes...</pre>
      </div>
    </main>
  </div>
  <script>
    const state = {
      panes: [],
      selected: localStorage.getItem("tmux-log-viewer:selected") || "",
      log: "",
      paused: false,
      loadingLog: false
    };

    const paneList = document.getElementById("paneList");
    const paneFilter = document.getElementById("paneFilter");
    const count = document.getElementById("count");
    const log = document.getElementById("log");
    const search = document.getElementById("search");
    const lines = document.getElementById("lines");
    const pause = document.getElementById("pause");
    const copy = document.getElementById("copy");
    const autoScroll = document.getElementById("autoScroll");

    function escapeHtml(value) {
      return value.replace(/[&<>"']/g, function (char) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char];
      });
    }

    function escapeRegExp(value) {
      return value.replace(/[.*+?^$()|[\\]\\\\]/g, "\\\\$&");
    }

    function setLogText(value, className) {
      log.className = className || "";
      log.textContent = value;
    }

    function classifyLogLine(line, state) {
      const trimmed = line.trim();
      if (!trimmed) return "";

      if (/^(root|[A-Za-z0-9_.-]+) at [A-Za-z0-9_.-]+ in /.test(trimmed)) {
        state.afterCommand = false;
        return "prompt-remote";
      }
      if (/^[A-Za-z0-9_.-]+@[A-Za-z0-9_.-]+(?:\\s+[^%$#]*)?\\s[%$#](?:\\s|$)/.test(trimmed)) {
        state.afterCommand = /[%$#]\\s+\\S/.test(trimmed);
        return state.afterCommand ? "prompt-local command-input" : "prompt-local";
      }
      if (/^(?:[$%#]\\s|heredoc>\\s)/.test(trimmed)) {
        state.afterCommand = true;
        return "prompt-command command-input";
      }
      if (state.afterCommand) {
        return "command-output";
      }
      return "";
    }

    function renderSearchText(value, query) {
      if (!query) return escapeHtml(value);

      const pattern = new RegExp(escapeRegExp(query), "gi");
      let html = "";
      let lastIndex = 0;
      for (const match of value.matchAll(pattern)) {
        html += escapeHtml(value.slice(lastIndex, match.index));
        html += "<mark>" + escapeHtml(match[0]) + "</mark>";
        lastIndex = match.index + match[0].length;
      }
      html += escapeHtml(value.slice(lastIndex));
      return html;
    }

    function renderLogLine(line, query, renderState) {
      const className = ["log-line", classifyLogLine(line, renderState)].filter(Boolean).join(" ");
      return '<span class="' + className + '">' + renderSearchText(line, query) + '</span>';
    }

    function renderHighlightedLog(value, query) {
      const renderState = { afterCommand: false };
      return value.split("\\n").map(function (line) {
        return renderLogLine(line, query, renderState);
      }).join("");
    }

    function renderLog() {
      const query = search.value.trim();
      log.className = "";
      log.innerHTML = renderHighlightedLog(state.log || "No output captured.", query);
      if (autoScroll.checked) log.scrollTop = log.scrollHeight;
    }

    function paneMatchesFilter(pane) {
      const query = paneFilter.value.trim().toLowerCase();
      if (!query) return true;
      return [pane.session, pane.windowName, pane.paneId, pane.command, pane.title, pane.label]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }

    function renderPanes() {
      const visible = state.panes.filter(paneMatchesFilter);
      count.textContent = String(state.panes.length) + (state.panes.length === 1 ? " pane" : " panes");
      paneList.innerHTML = "";

      if (visible.length === 0) {
        const empty = document.createElement("div");
        empty.className = "pane-sub";
        empty.style.padding = "10px";
        empty.textContent = state.panes.length === 0 ? "No tmux panes found." : "No panes match the filter.";
        paneList.appendChild(empty);
        return;
      }

      for (const pane of visible) {
        const row = document.createElement("div");
        row.className = "pane-row";

        const button = document.createElement("button");
        button.className = "pane-button" + (pane.paneId === state.selected ? " active" : "");
        button.type = "button";
        button.innerHTML =
          '<span class="pane-primary">' +
          '<span class="pane-label">' + escapeHtml(pane.label) + '</span>' +
          '<span class="badge">' + escapeHtml(pane.paneId) + '</span>' +
          '</span>' +
          '<span class="pane-sub">' + escapeHtml((pane.command || "-") + " · " + (pane.title || "")) + '</span>';
        button.addEventListener("click", function () {
          state.selected = pane.paneId;
          localStorage.setItem("tmux-log-viewer:selected", state.selected);
          renderPanes();
          loadLog(true);
        });

        const stopButton = document.createElement("button");
        stopButton.className = "stop-session";
        stopButton.type = "button";
        stopButton.textContent = "Stop";
        stopButton.title = "Stop tmux session " + pane.session;
        stopButton.addEventListener("click", function () {
          stopSession(pane.session);
        });

        row.appendChild(button);
        row.appendChild(stopButton);
        paneList.appendChild(row);
      }
    }

    async function stopSession(sessionName) {
      if (!confirm('Stop tmux session "' + sessionName + '"?')) return;

      try {
        const response = await fetch("/api/session/" + encodeURIComponent(sessionName), {
          method: "DELETE",
          cache: "no-store"
        });
        if (!response.ok) {
          const payload = await response.json().catch(function () { return {}; });
          throw new Error(payload.error || "HTTP " + response.status);
        }
        if (state.selected && state.panes.some(function (pane) { return pane.session === sessionName && pane.paneId === state.selected; })) {
          state.selected = "";
          state.log = "";
          setLogText("Stopped tmux session " + sessionName + ".");
        }
        await loadPanes();
      } catch (error) {
        setLogText("Failed to stop session " + sessionName + ": " + error.message, "error");
      }
    }

    async function loadPanes() {
      try {
        const response = await fetch("/api/panes", { cache: "no-store" });
        if (!response.ok) throw new Error("HTTP " + response.status);
        const payload = await response.json();
        state.panes = payload.panes || [];
        if (!state.panes.some(function (pane) { return pane.paneId === state.selected; })) {
          state.selected = state.panes[0] ? state.panes[0].paneId : "";
        }
        renderPanes();
        if (!state.selected) setLogText("No tmux panes found.");
      } catch (error) {
        setLogText("Failed to list tmux panes: " + error.message, "error");
      }
    }

    async function loadLog(force) {
      if (!state.selected || state.loadingLog) return;
      if (state.paused && !force) return;
      state.loadingLog = true;
      try {
        const url = "/api/pane/" + encodeURIComponent(state.selected) + "/log?lines=" + encodeURIComponent(lines.value);
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) {
          const payload = await response.json().catch(function () { return {}; });
          throw new Error(payload.error || "HTTP " + response.status);
        }
        state.log = await response.text();
        renderLog();
      } catch (error) {
        setLogText("Failed to capture " + state.selected + ": " + error.message, "error");
      } finally {
        state.loadingLog = false;
      }
    }

    paneFilter.addEventListener("input", renderPanes);
    search.addEventListener("input", renderLog);
    lines.addEventListener("change", function () { loadLog(true); });
    pause.addEventListener("click", function () {
      state.paused = !state.paused;
      pause.textContent = state.paused ? "Resume" : "Pause";
      if (!state.paused) loadLog(true);
    });
    copy.addEventListener("click", async function () {
      await navigator.clipboard.writeText(state.log || "");
      copy.textContent = "Copied";
      setTimeout(function () { copy.textContent = "Copy"; }, 900);
    });

    loadPanes().then(function () { return loadLog(true); });
    setInterval(loadPanes, 3000);
    setInterval(loadLog, 1200);
  </script>
</body>
</html>`;

function sendJson(response, status, value) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(value));
}

function sendText(response, status, value, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(value);
}

function createServer({ tmux = tmuxModule } = {}) {
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");

    try {
      const sessionKillMatch = url.pathname.match(/^\/api\/session\/([^/]+)$/);
      if (request.method === "DELETE" && sessionKillMatch) {
        const sessionName = decodeURIComponent(sessionKillMatch[1]);
        if (!tmuxModule.isSessionName(sessionName)) {
          sendJson(response, 400, { error: "Invalid tmux session name" });
          return;
        }

        const panes = await tmux.listPanes();
        if (!panes.some((pane) => pane.session === sessionName)) {
          sendJson(response, 404, { error: "Session not found" });
          return;
        }

        await tmux.killSession(sessionName);
        sendJson(response, 200, { stopped: sessionName });
        return;
      }

      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" });
        return;
      }

      if (url.pathname === "/" || url.pathname === "/index.html") {
        sendText(response, 200, HTML, "text/html; charset=utf-8");
        return;
      }

      if (url.pathname === "/api/panes") {
        sendJson(response, 200, { panes: await tmux.listPanes() });
        return;
      }

      const logMatch = url.pathname.match(/^\/api\/pane\/([^/]+)\/log$/);
      if (logMatch) {
        const paneId = decodeURIComponent(logMatch[1]);
        if (!tmuxModule.isPaneId(paneId)) {
          sendJson(response, 400, { error: "Invalid tmux pane id" });
          return;
        }
        sendText(response, 200, await tmux.capturePane(paneId, url.searchParams.get("lines")));
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
  });
}

function start() {
  const host = process.env.HOST || "127.0.0.1";
  const port = Number.parseInt(process.env.PORT || "8787", 10);
  const server = createServer();

  server.listen(port, host, () => {
    console.log(`Tmux Log Viewer listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = {
  HTML,
  createServer,
  start,
};
