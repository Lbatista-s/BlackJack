#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/.launcher"
SERVER_PID_FILE="$RUNTIME_DIR/server.pid"
CLIENT_PID_FILE="$RUNTIME_DIR/client.pid"

read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' <"$pid_file"
  fi
}

stop_process() {
  local name="$1"
  local pid_file="$2"
  local pid

  pid="$(read_pid "$pid_file")"
  if [[ -z "$pid" ]]; then
    echo "$name was not started by this launcher."
    return
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    for _ in {1..10}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 1
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      kill -9 "$pid" >/dev/null 2>&1 || true
    fi

    echo "Stopped $name (PID $pid)."
  else
    echo "$name is not running."
  fi

  rm -f "$pid_file"
}

stop_process "frontend" "$CLIENT_PID_FILE"
stop_process "API" "$SERVER_PID_FILE"
