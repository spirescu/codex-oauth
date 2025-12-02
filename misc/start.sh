#!/bin/bash

set -o nounset
set -o pipefail

# -----------------------------------------------------------
# Codex launcher wrapper
# -----------------------------------------------------------
danger-codex() {
  docker run --rm -it \
    -v "$(pwd)":/codex-sandbox \
    -v "$HOME/.codex":/root/.codex \
    -v "$HOME/.docker/run/docker.sock":/var/run/docker.sock \
    codex-image "$@"
}

# -----------------------------------------------------------
# Paths
# -----------------------------------------------------------
CODEX_DIR="$HOME/.codex"
AUTH_ACTIVE="$CODEX_DIR/auth.json"
CURRENT_PROFILE_FILE="$CODEX_DIR/current.tmp"

mkdir -p "$CODEX_DIR"

# -----------------------------------------------------------
# Parameter mapping
# -----------------------------------------------------------
case "${1-}" in
  a) PROFILE="azure" ;;
  j) PROFILE="jonas" ;;
  n) PROFILE="nagarro" ;;
  s) PROFILE="sarah" ;;
  l) PROFILE="lukas" ;;
  h) PROFILE="himanshu" ;;
  t) PROFILE="thomas" ;;
  u) PROFILE="update" ;;
  "" ) PROFILE="" ;;
  * ) PROFILE="$1" ;;
esac

# -----------------------------------------------------------
# Update Codex Docker image
# -----------------------------------------------------------
if [ "$PROFILE" = "update" ]; then
  echo "Rebuilding codex-image (inline Dockerfile)..."
  docker build -t codex-image - <<'EOF'
FROM docker
WORKDIR /codex-sandbox
RUN apk add --no-cache curl jq python3 ripgrep npm
RUN npm i -g @openai/codex pnpm
ENTRYPOINT ["codex"]
EOF

  if [ $? -ne 0 ]; then
    echo "Docker build failed."
    exit 1
  fi

  echo "Codex Docker image updated successfully."
  exit 0
fi

# -----------------------------------------------------------
# Resolve profile file
# -----------------------------------------------------------
PROFILE_FILE="$CODEX_DIR/$PROFILE.auth.json"

# -----------------------------------------------------------
# Switch profile (copy-in)
# -----------------------------------------------------------
if [ -n "$PROFILE" ]; then

  if [ "$PROFILE" = "azure" ]; then
    echo "Switching to Azure mode..."
    rm -f "$AUTH_ACTIVE"
    echo "$PROFILE" > "$CURRENT_PROFILE_FILE"
    echo "Launching Codex with Azure profile..."
    danger-codex -p azure

    # No copy-back for azure
    exit 0
  fi

  if [ ! -f "$PROFILE_FILE" ]; then
    echo "Profile '$PROFILE' does not exist: $PROFILE_FILE"
    exit 1
  fi

  echo "Activating profile '$PROFILE'..."

  # Copy profile into active auth.json
  cp "$PROFILE_FILE" "$AUTH_ACTIVE"

  echo "$PROFILE" > "$CURRENT_PROFILE_FILE"
else
  # No parameter: keep current profile
  if [ -f "$CURRENT_PROFILE_FILE" ]; then
    echo "Using existing profile '$(cat "$CURRENT_PROFILE_FILE")'."
  else
    echo "No profile active and none provided."
  fi
fi

# -----------------------------------------------------------
# Launch Codex
# -----------------------------------------------------------
ACTIVE_PROFILE="$(cat "$CURRENT_PROFILE_FILE" 2>/dev/null || true)"
echo "Launching Codex (profile: $ACTIVE_PROFILE)..."
danger-codex

# -----------------------------------------------------------
# Copy-out: persist Codex updates into the active profile
# -----------------------------------------------------------
if [ -n "$ACTIVE_PROFILE" ] && [ "$ACTIVE_PROFILE" != "azure" ]; then
  PROFILE_FILE="$CODEX_DIR/$ACTIVE_PROFILE.auth.json"

  if [ -f "$AUTH_ACTIVE" ]; then
    echo "Persisting updated auth.json back to profile '$ACTIVE_PROFILE'."
    cp "$AUTH_ACTIVE" "$PROFILE_FILE"
  fi
fi

echo "Done."
