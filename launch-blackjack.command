#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_DIR="$SCRIPT_DIR/.launcher"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"
SERVER_PID_FILE="$RUNTIME_DIR/server.pid"
CLIENT_PID_FILE="$RUNTIME_DIR/client.pid"
SERVER_LOG="$RUNTIME_DIR/server.log"
CLIENT_LOG="$RUNTIME_DIR/client.log"
STARTED_SERVER=0
STARTED_CLIENT=0

mkdir -p "$RUNTIME_DIR"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

read_pid() {
  local pid_file="$1"
  if [[ -f "$pid_file" ]]; then
    tr -d '[:space:]' <"$pid_file"
  fi
}

is_running() {
  local pid="$1"
  [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1
}

cleanup_stale_pid() {
  local pid_file="$1"
  local pid
  pid="$(read_pid "$pid_file")"
  if [[ -n "$pid" ]] && ! is_running "$pid"; then
    rm -f "$pid_file"
  fi
}

port_in_use() {
  lsof -ti :"$1" >/dev/null 2>&1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts=0

  until curl -fsS "$url" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if (( attempts > 60 )); then
      echo "$label did not become ready in time."
      echo "Server log: $SERVER_LOG"
      echo "Client log: $CLIENT_LOG"
      exit 1
    fi
    sleep 1
  done
}

stop_started_process() {
  local pid_file="$1"
  local pid

  pid="$(read_pid "$pid_file")"
  if is_running "$pid"; then
    kill "$pid" >/dev/null 2>&1 || true
  fi
  rm -f "$pid_file"
}

on_exit() {
  local exit_code="$1"

  if (( exit_code != 0 )); then
    if (( STARTED_CLIENT == 1 )); then
      stop_started_process "$CLIENT_PID_FILE"
    fi
    if (( STARTED_SERVER == 1 )); then
      stop_started_process "$SERVER_PID_FILE"
    fi
  fi
}

shell_quote() {
  printf '%q' "$1"
}

apple_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  print -r -- "$value"
}

start_detached_process() {
  local workdir="$1"
  local pid_file="$2"
  local log_file="$3"
  shift 3

  (
    cd "$workdir"
    "$@" >"$log_file" 2>&1 </dev/null &!
    echo $! >"$pid_file"
  )
}

start_terminal_process() {
  local workdir="$1"
  local pid_file="$2"
  local log_file="$3"
  local launch_command="$4"
  local runner_script
  local shell_command

  runner_script="cd $(shell_quote "$workdir") || exit 1
trap 'rm -f $(shell_quote "$pid_file")' EXIT
: > $(shell_quote "$log_file")
$launch_command > >(tee -a $(shell_quote "$log_file")) 2> >(tee -a $(shell_quote "$log_file") >&2) &
child=\$!
echo \$child > $(shell_quote "$pid_file")
wait \$child"

  shell_command="zsh -lc $(shell_quote "$runner_script")"

  osascript \
    -e 'tell application "Terminal" to activate' \
    -e "tell application \"Terminal\" to do script \"$(apple_escape "$shell_command")\"" \
    >/dev/null
}

start_process() {
  local workdir="$1"
  local pid_file="$2"
  local log_file="$3"
  local command_string="$4"

  if command -v osascript >/dev/null 2>&1; then
    if start_terminal_process "$workdir" "$pid_file" "$log_file" "$command_string"; then
      return
    fi
  fi

  if [[ "$command_string" == "npm start" ]]; then
    start_detached_process "$workdir" "$pid_file" "$log_file" npm start
    return
  fi

  start_detached_process "$workdir" "$pid_file" "$log_file" npm run dev -- --host 127.0.0.1
}

require_command node
require_command npm
require_command curl
require_command lsof

trap 'on_exit $?' EXIT

if command -v pg_isready >/dev/null 2>&1; then
  if ! pg_isready -q; then
    if command -v brew >/dev/null 2>&1; then
      POSTGRES_FORMULA="$(brew list --formula | grep -E '^postgresql(@.*)?$' | head -n 1 || true)"
      if [[ -n "$POSTGRES_FORMULA" ]]; then
        echo "Starting PostgreSQL service..."
        brew services start "$POSTGRES_FORMULA" >/dev/null
        sleep 2
      fi
    fi
  fi

  if ! pg_isready -q; then
    echo "PostgreSQL is not accepting connections on localhost:5432."
    echo "Start it and try again."
    exit 1
  fi
fi

cleanup_stale_pid "$SERVER_PID_FILE"
cleanup_stale_pid "$CLIENT_PID_FILE"

SERVER_PID="$(read_pid "$SERVER_PID_FILE")"
CLIENT_PID="$(read_pid "$CLIENT_PID_FILE")"

if [[ ! -f "$SERVER_DIR/.env" && -f "$SERVER_DIR/.env.example" ]]; then
  cp "$SERVER_DIR/.env.example" "$SERVER_DIR/.env"
fi

if [[ ! -d "$SERVER_DIR/node_modules" ]]; then
  echo "Installing server dependencies..."
  (cd "$SERVER_DIR" && npm install)
fi

if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
  echo "Installing client dependencies..."
  (cd "$CLIENT_DIR" && npm install)
fi

if ! is_running "$SERVER_PID"; then
  if port_in_use 5174; then
    echo "Port 5174 is already in use by another process."
    echo "Free that port or stop the existing API before launching."
    exit 1
  fi

  echo "Starting API..."
  start_process "$SERVER_DIR" "$SERVER_PID_FILE" "$SERVER_LOG" "npm start"
  STARTED_SERVER=1
fi

if ! is_running "$CLIENT_PID"; then
  if port_in_use 5173; then
    echo "Port 5173 is already in use by another process."
    echo "Free that port or stop the existing frontend before launching."
    exit 1
  fi

  echo "Starting frontend..."
  start_process "$CLIENT_DIR" "$CLIENT_PID_FILE" "$CLIENT_LOG" "npm run dev -- --host 127.0.0.1"
  STARTED_CLIENT=1
fi

wait_for_http "http://127.0.0.1:5174/health" "API"
wait_for_http "http://127.0.0.1:5173" "Frontend"

if command -v open >/dev/null 2>&1; then
  open "http://127.0.0.1:5173"
fi

echo
echo "BlackJack is running."
echo "Frontend: http://127.0.0.1:5173"
echo "API: http://127.0.0.1:5174"
echo "Stop it with: $SCRIPT_DIR/stop-blackjack.command"
echo "Logs:"
echo "  $SERVER_LOG"
echo "  $CLIENT_LOG"
