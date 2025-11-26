#!/bin/bash

danger-codex() {
  docker run --rm -it \
    -v "$(pwd)":/codex-sandbox \
    -v "$HOME/.codex":/root/.codex \
    -v "$HOME/.docker/run/docker.sock":/var/run/docker.sock \
    codex-image "$@"
}

set -o nounset
set -o pipefail

CODEX_DIR="$HOME/.codex"
CURRENT_AUTH="$CODEX_DIR/auth.json"
CURRENT_TMP="$CODEX_DIR/current.tmp"

# --- parameter mapping ---
case "${1-}" in
  a) PARAM="azure" ;;
  j) PARAM="jonas" ;;
  n) PARAM="nagarro" ;;
  s) PARAM="sarah" ;;
  l) PARAM="lukas" ;;
  h) PARAM="himanshu" ;;
  t) PARAM="thomas" ;;
  u) PARAM="update" ;;
  "" ) PARAM="" ;;
  * ) PARAM="$1" ;;
esac

# --- update Codex Docker image (Dockerfile embedded) ---
if [ "${PARAM}" = "update" ]; then
  echo "Rebuilding codex-image (inline Dockerfile)..."

  docker build -t codex-image - <<'EOF'
FROM docker
WORKDIR /codex-sandbox
RUN apk add --no-cache curl jq python3 ripgrep npm
RUN npm i -g @openai/codex pnpm
ENTRYPOINT ["codex"]
EOF

  if [ $? -ne 0 ]; then
    echo "Error: Docker build failed."
    exit 1
  fi

  echo "Codex Docker image updated successfully."
  exit 0
fi

# --- handle auth switching ---
if [ -n "${PARAM}" ]; then
  if [ "$PARAM" = "azure" ]; then
    echo "Switching to Azure mode..."
    rm -f "$CURRENT_AUTH"
    echo "$PARAM" > "$CURRENT_TMP"
    echo "Auth removed. Launching Codex with -p azure..."
    echo "Launching Codex in $(pwd)..."
    danger-codex -p azure
    exit 0
  fi

  AUTH_FILE="$CODEX_DIR/$PARAM.auth.json"

  if [ ! -f "$AUTH_FILE" ]; then
    echo "Auth for '$PARAM' not found: $AUTH_FILE"
    exit 1
  fi

  echo "Switching Codex auth to '$PARAM'..."

  mkdir -p "$CODEX_DIR"
  rm -f "$CURRENT_AUTH"

  if ! ln "$AUTH_FILE" "$CURRENT_AUTH"; then
    echo "Error: failed to create hard link. Are files on the same filesystem?"
    exit 1
  fi

  echo "$PARAM" > "$CURRENT_TMP"
else
  echo "No parameter provided — keeping current auth."
  if [ -f "$CURRENT_TMP" ]; then
    echo "Currently using auth for '$(cat "$CURRENT_TMP")'."
  else
    echo "No record found — unknown current auth."
  fi
fi

echo "Launching Codex in $(pwd)..."
danger-codex
