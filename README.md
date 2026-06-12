# Tmux Log Viewer

Local browser dashboard for tmux panes used by AI coding agents and long-running terminal tasks.

## Problem

AI coding workflows, including Codex-style agents, often use tmux to keep multiple background tasks alive: tests, dev servers, installs, remote shells, and long-running automation. Tmux is reliable for background execution, but it is not very visual.

When several sessions are running at the same time, it can be hard to quickly understand what the agent is doing:

- which tmux sessions are active
- which pane belongs to which task
- what each task most recently printed
- where prompts, user-entered commands, and command output start or end
- which stale sessions can be stopped safely

This project provides a local browser view so those tmux-backed tasks are easier to scan without repeatedly attaching to sessions or running tmux commands by hand.

## Run

```bash
git clone https://github.com/hwb96/tmux-log-viewer.git
cd tmux-log-viewer
npm install
npm start
```

Then open:

```text
http://127.0.0.1:8787
```

Use another port if needed:

```bash
PORT=8790 npm start
```

## What it does

- Lists local tmux sessions, windows, and panes.
- Click a pane to read recent output from `tmux capture-pane`.
- Auto-refreshes the selected pane.
- Highlights prompts, user-entered commands, and command output differently.
- Supports pause, line count, search highlight, auto-scroll, and copy.
- Can stop a stale tmux session with an explicit confirmation.

## Safety boundary

This tool does not attach to tmux and does not send keys. For normal viewing it only runs:

```bash
tmux list-panes -a -F ...
tmux capture-pane -p -J -t %pane_id -S -N
```

The stop button only runs `tmux kill-session -t <session>` for a session that is already visible in the pane list. It does not expose arbitrary command execution.

The server binds to `127.0.0.1` by default.

## Test

```bash
npm test
```
