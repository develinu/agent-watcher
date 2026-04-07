# `aw` Control Scripts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `aw` 통합 커맨드를 `~/.local/bin/`에 설치해 어느 디렉토리에서든 agent-watcher 서버를 제어하고 TUI를 실행할 수 있게 한다.

**Architecture:** `scripts/aw`는 PID 파일(`~/.agent-watcher/server.pid`)로 백그라운드 프로세스를 추적하는 bash 스크립트다. `scripts/install.sh`가 프로젝트 절대 경로를 스크립트에 삽입한 뒤 `~/.local/bin/aw`로 복사한다.

**Tech Stack:** bash, nohup, npx tsx (already in node_modules), curl (liveness check)

---

## File Map

| 파일                 | 역할                                                        |
| -------------------- | ----------------------------------------------------------- |
| `scripts/aw`         | 메인 커맨드 템플릿 (`__PROJECT_DIR__` 플레이스홀더 포함)    |
| `scripts/install.sh` | 플레이스홀더를 실제 경로로 치환 후 `~/.local/bin/aw`로 설치 |

---

### Task 1: `scripts/aw` 스크립트 작성

**Files:**

- Create: `scripts/aw`

- [ ] **Step 1: `scripts/` 디렉토리 생성**

```bash
mkdir -p scripts
```

- [ ] **Step 2: `scripts/aw` 파일 작성**

```bash
#!/usr/bin/env bash
set -euo pipefail

# install.sh가 이 값을 실제 경로로 치환한다
AGENT_WATCHER_DIR="__PROJECT_DIR__"

PID_DIR="$HOME/.agent-watcher"
PID_FILE="$PID_DIR/server.pid"
LOG_FILE="$PID_DIR/server.log"
SERVER_PORT="${SERVER_PORT:-3001}"

mkdir -p "$PID_DIR"

_is_running() {
  [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null
}

_cleanup_stale() {
  if [ -f "$PID_FILE" ] && ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    rm -f "$PID_FILE"
  fi
}

cmd_start() {
  _cleanup_stale
  if _is_running; then
    echo "agent-watcher is already running (PID: $(cat "$PID_FILE"))"
    exit 1
  fi

  nohup npx --prefix "$AGENT_WATCHER_DIR" tsx watch \
    "$AGENT_WATCHER_DIR/server/src/index.ts" \
    >> "$LOG_FILE" 2>&1 &

  echo $! > "$PID_FILE"
  echo "agent-watcher started (PID: $!, port: $SERVER_PORT)"
  echo "Logs: $LOG_FILE"
}

cmd_stop() {
  _cleanup_stale
  if ! _is_running; then
    echo "agent-watcher is not running"
    exit 0
  fi

  local pid
  pid=$(cat "$PID_FILE")
  kill "$pid"
  rm -f "$PID_FILE"
  echo "agent-watcher stopped (PID: $pid)"
}

cmd_restart() {
  cmd_stop || true
  sleep 1
  cmd_start
}

cmd_status() {
  _cleanup_stale
  if _is_running; then
    echo "Running (PID: $(cat "$PID_FILE"), port: $SERVER_PORT)"
    if curl -sf "http://localhost:$SERVER_PORT/api/status" > /dev/null 2>&1; then
      echo "HTTP: OK"
    else
      echo "HTTP: not responding yet (server may be starting up)"
    fi
  else
    echo "Not running"
  fi
}

cmd_logs() {
  if [ ! -f "$LOG_FILE" ]; then
    echo "No log file found at $LOG_FILE"
    exit 1
  fi
  tail -f "$LOG_FILE"
}

cmd_tui() {
  if ! curl -sf "http://localhost:$SERVER_PORT/api/status" > /dev/null 2>&1; then
    echo "Error: agent-watcher server is not running at localhost:$SERVER_PORT"
    echo "Run: aw start"
    exit 1
  fi
  npx --prefix "$AGENT_WATCHER_DIR" tsx \
    "$AGENT_WATCHER_DIR/tui/bin/agent-watch.ts" "$@"
}

case "${1:-}" in
  start)   cmd_start ;;
  stop)    cmd_stop ;;
  restart) cmd_restart ;;
  status)  cmd_status ;;
  logs)    cmd_logs ;;
  tui)     shift; cmd_tui "$@" ;;
  *)
    echo "Usage: aw <start|stop|restart|status|logs|tui> [flags]"
    echo ""
    echo "  start    Start server in background (dev mode)"
    echo "  stop     Stop background server"
    echo "  restart  Restart server"
    echo "  status   Show server status"
    echo "  logs     Tail server log (Ctrl+C to exit)"
    echo "  tui      Launch TUI monitor"
    echo ""
    echo "Environment:"
    echo "  SERVER_PORT  Override server port (default: 3001)"
    exit 1
    ;;
esac
```

- [ ] **Step 3: 실행 권한 부여**

```bash
chmod +x scripts/aw
```

---

### Task 2: `scripts/install.sh` 설치 스크립트 작성

**Files:**

- Create: `scripts/install.sh`

- [ ] **Step 1: `scripts/install.sh` 파일 작성**

```bash
#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$HOME/.local/bin"
TARGET="$INSTALL_DIR/aw"

mkdir -p "$INSTALL_DIR"

# __PROJECT_DIR__ 플레이스홀더를 실제 경로로 치환하여 설치
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$SCRIPT_DIR/aw" > "$TARGET"
chmod +x "$TARGET"

echo "Installed: $TARGET"
echo "Project dir: $PROJECT_DIR"

# PATH 확인
if ! echo ":$PATH:" | grep -q ":$INSTALL_DIR:"; then
  echo ""
  echo "Note: $INSTALL_DIR is not in your PATH."
  echo "Add the following to your ~/.bashrc or ~/.zshrc:"
  echo ""
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
  echo "Then run: source ~/.bashrc  (or ~/.zshrc)"
fi
```

- [ ] **Step 2: 실행 권한 부여**

```bash
chmod +x scripts/install.sh
```

---

### Task 3: 설치 및 동작 검증

**Files:**

- No file changes

- [ ] **Step 1: 설치 실행**

프로젝트 루트에서:

```bash
./scripts/install.sh
```

예상 출력:

```
Installed: /home/<user>/.local/bin/aw
Project dir: /home/<user>/devinu-project/agent-watcher
```

- [ ] **Step 2: `aw` 도움말 확인**

```bash
aw
```

예상 출력:

```
Usage: aw <start|stop|restart|status|logs|tui> [flags]
...
```

- [ ] **Step 3: `aw status` (미실행 상태)**

```bash
aw status
```

예상 출력:

```
Not running
```

- [ ] **Step 4: `aw start` 실행**

```bash
aw start
```

예상 출력:

```
agent-watcher started (PID: <pid>, port: 3001)
Logs: /home/<user>/.agent-watcher/server.log
```

- [ ] **Step 5: 서버 기동 대기 후 `aw status` 확인**

```bash
sleep 3 && aw status
```

예상 출력:

```
Running (PID: <pid>, port: 3001)
HTTP: OK
```

- [ ] **Step 6: `aw stop` 실행**

```bash
aw stop
```

예상 출력:

```
agent-watcher stopped (PID: <pid>)
```

- [ ] **Step 7: `aw restart` 검증**

```bash
aw start && sleep 3 && aw restart && sleep 3 && aw status
```

예상 출력 (마지막):

```
Running (PID: <new_pid>, port: 3001)
HTTP: OK
```

- [ ] **Step 8: `aw tui` — 서버 미실행 시 에러 메시지 확인**

```bash
aw stop 2>/dev/null; aw tui
```

예상 출력:

```
Error: agent-watcher server is not running at localhost:3001
Run: aw start
```

- [ ] **Step 9: 서버 기동 후 `aw tui` 정상 실행 확인**

```bash
aw start && sleep 3 && aw tui
```

예상: TUI 화면이 정상적으로 표시됨 (Ctrl+C 또는 q로 종료)

- [ ] **Step 10: 다른 디렉토리에서 실행 확인**

```bash
cd /tmp && aw status && cd -
```

예상 출력:

```
Running (PID: <pid>, port: 3001)
HTTP: OK
```

---

### Task 4: 커밋

**Files:**

- `scripts/aw`
- `scripts/install.sh`
- `docs/superpowers/specs/2026-04-07-aw-control-scripts-design.md`
- `docs/superpowers/plans/2026-04-07-aw-control-scripts.md`

- [ ] **Step 1: 스테이징 및 커밋**

```bash
git add scripts/aw scripts/install.sh \
        docs/superpowers/specs/2026-04-07-aw-control-scripts-design.md \
        docs/superpowers/plans/2026-04-07-aw-control-scripts.md
git commit -m "feat: add aw control scripts for server and TUI management"
```
