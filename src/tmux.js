const { execFile } = require("node:child_process");

const SEP = "|";
const PANE_FORMAT = [
  "#{session_name}",
  "#{window_index}",
  "#{window_name}",
  "#{pane_index}",
  "#{pane_id}",
  "#{pane_current_command}",
  "#{pane_title}",
].join(SEP);

function isPaneId(value) {
  return /^%\d+$/.test(value);
}

function isSessionName(value) {
  return /^[A-Za-z0-9_.:-]+$/.test(value);
}

function normalizeLineCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 500;
  return Math.min(2000, Math.max(100, parsed));
}

function getTmuxBinary(env = process.env) {
  return env.TMUX_LOG_VIEWER_TMUX || "tmux";
}

function buildTmuxArgs(args, env = process.env) {
  if (!env.TMUX_LOG_VIEWER_SOCKET) return args;
  return ["-S", env.TMUX_LOG_VIEWER_SOCKET, ...args];
}

function buildCaptureArgs(paneId, lines) {
  if (!isPaneId(paneId)) {
    throw new Error(`Invalid tmux pane id: ${paneId}`);
  }

  return [
    "capture-pane",
    "-p",
    "-J",
    "-t",
    paneId,
    "-S",
    `-${normalizeLineCount(lines)}`,
  ];
}

function buildKillSessionArgs(sessionName) {
  if (!isSessionName(sessionName)) {
    throw new Error(`Invalid tmux session name: ${sessionName}`);
  }

  return ["kill-session", "-t", sessionName];
}

function parsePaneList(raw) {
  return raw
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(SEP);
      if (parts.length < 7 || !isPaneId(parts[4])) return null;

      const [
        session,
        windowIndex,
        windowName,
        paneIndex,
        paneId,
        command,
        ...titleParts
      ] = parts;
      const title = titleParts.join(SEP);

      return {
        session,
        windowIndex,
        windowName,
        paneIndex,
        paneId,
        command,
        title,
        label: `${session}:${windowIndex}.${windowName}.${paneIndex}`,
      };
    })
    .filter(Boolean);
}

function parseSessionIds(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^\$\d+$/.test(line));
}

function execTmux(args) {
  return new Promise((resolve, reject) => {
    execFile(getTmuxBinary(), buildTmuxArgs(args), { timeout: 5000, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function listPanes() {
  try {
    const stdout = await execTmux(["list-panes", "-a", "-F", PANE_FORMAT]);
    const panes = parsePaneList(stdout);
    if (panes.length > 0) return panes;

    const sessionIds = parseSessionIds(await execTmux(["list-sessions", "-F", "#{session_id}"]));
    const paneGroups = await Promise.all(
      sessionIds.map(async (sessionId) => parsePaneList(await execTmux(["list-panes", "-t", sessionId, "-F", PANE_FORMAT]))),
    );
    return paneGroups.flat();
  } catch (error) {
    if ((error.stderr || "").includes("no server running")) return [];
    throw error;
  }
}

async function capturePane(paneId, lines) {
  const stdout = await execTmux(buildCaptureArgs(paneId, lines));
  return stdout.replace(/\s+$/u, "");
}

async function killSession(sessionName) {
  await execTmux(buildKillSessionArgs(sessionName));
}

module.exports = {
  buildCaptureArgs,
  buildKillSessionArgs,
  buildTmuxArgs,
  capturePane,
  getTmuxBinary,
  isSessionName,
  isPaneId,
  killSession,
  listPanes,
  normalizeLineCount,
  parseSessionIds,
  parsePaneList,
};
