const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildCaptureArgs,
  buildKillSessionArgs,
  buildTmuxArgs,
  getTmuxBinary,
  isSessionName,
  isPaneId,
  parseSessionIds,
  parsePaneList,
} = require("../src/tmux");

const SEP = "|";

test("parsePaneList parses tmux pane rows into dashboard records", () => {
  const raw = [
    ["codex", "0", "main", "0", "%12", "zsh", "developer-laptop"].join(SEP),
    ["deploy", "2", "logs", "1", "%7", "python", "worker"].join(SEP),
  ].join("\n");

  assert.deepEqual(parsePaneList(raw), [
    {
      session: "codex",
      windowIndex: "0",
      windowName: "main",
      paneIndex: "0",
      paneId: "%12",
      command: "zsh",
      title: "developer-laptop",
      label: "codex:0.main.0",
    },
    {
      session: "deploy",
      windowIndex: "2",
      windowName: "logs",
      paneIndex: "1",
      paneId: "%7",
      command: "python",
      title: "worker",
      label: "deploy:2.logs.1",
    },
  ]);
});

test("parsePaneList skips malformed and non-pane-id rows", () => {
  const raw = [
    "bad row",
    ["codex", "0", "main", "0", "not-pane", "zsh", "title"].join(SEP),
    ["ok", "1", "worker", "0", "%3", "node", "title"].join(SEP),
  ].join("\n");

  assert.deepEqual(parsePaneList(raw).map((pane) => pane.paneId), ["%3"]);
});

test("isPaneId accepts only tmux pane ids", () => {
  assert.equal(isPaneId("%0"), true);
  assert.equal(isPaneId("%123"), true);
  assert.equal(isPaneId("0"), false);
  assert.equal(isPaneId("%abc"), false);
  assert.equal(isPaneId("%1;send-keys q"), false);
});

test("isSessionName accepts safe tmux session names", () => {
  assert.equal(isSessionName("tmux-log-viewer-preview"), true);
  assert.equal(isSessionName("codex_1"), true);
  assert.equal(isSessionName("prod.2026"), true);
  assert.equal(isSessionName("bad/name"), false);
  assert.equal(isSessionName("bad;kill-server"), false);
  assert.equal(isSessionName(""), false);
});

test("buildCaptureArgs clamps line count and keeps target as one argument", () => {
  assert.deepEqual(buildCaptureArgs("%12", 2500), [
    "capture-pane",
    "-p",
    "-J",
    "-t",
    "%12",
    "-S",
    "-2000",
  ]);

  assert.deepEqual(buildCaptureArgs("%12", -20), [
    "capture-pane",
    "-p",
    "-J",
    "-t",
    "%12",
    "-S",
    "-100",
  ]);
});

test("buildCaptureArgs rejects invalid pane ids", () => {
  assert.throws(
    () => buildCaptureArgs("%12; kill-server", 100),
    /Invalid tmux pane id/,
  );
});

test("buildKillSessionArgs keeps session target as one safe argument", () => {
  assert.deepEqual(buildKillSessionArgs("tmux-log-viewer-preview"), [
    "kill-session",
    "-t",
    "tmux-log-viewer-preview",
  ]);
  assert.throws(
    () => buildKillSessionArgs("bad;kill-server"),
    /Invalid tmux session name/,
  );
});

test("getTmuxBinary supports an explicit tmux binary path", () => {
  assert.equal(getTmuxBinary({ TMUX_LOG_VIEWER_TMUX: "/opt/homebrew/bin/tmux" }), "/opt/homebrew/bin/tmux");
  assert.equal(getTmuxBinary({}), "tmux");
});

test("buildTmuxArgs prefixes an explicit socket path", () => {
  assert.deepEqual(
    buildTmuxArgs(["list-sessions"], { TMUX_LOG_VIEWER_SOCKET: "/private/tmp/tmux-501/default" }),
    ["-S", "/private/tmp/tmux-501/default", "list-sessions"],
  );
  assert.deepEqual(buildTmuxArgs(["list-sessions"], {}), ["list-sessions"]);
});

test("parseSessionIds returns only tmux session ids", () => {
  assert.deepEqual(parseSessionIds("$0\nbad\n$12\n"), ["$0", "$12"]);
});
