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
UPDATED_DIR="$CODEX_DIR/updated"

mkdir -p "$CODEX_DIR"
mkdir -p "$UPDATED_DIR"

# -----------------------------------------------------------
# Helper: get account_id from a JSON auth file (if any)
# -----------------------------------------------------------
get_account_id() {
  local file="$1"
  if ! command -v jq >/dev/null 2>&1; then
    # jq not available; no account_id logic
    echo ""
    return 0
  fi

  jq -r '.tokens.account_id // empty' "$file" 2>/dev/null || echo ""
}

# -----------------------------------------------------------
# Helper: archive / update logic for AUTH_ACTIVE
#
# Logic:
# 1. If AUTH_ACTIVE missing → nothing to do.
# 2. If AUTH_ACTIVE identical to any *.auth.json → nothing to do.
# 3. Else:
#    a) If no account_id in AUTH_ACTIVE:
#         - Archive AUTH_ACTIVE as a new snapshot in updated/.
#    b) If account_id exists:
#         - Search for *.auth.json with same account_id.
#         - If found:
#             * Archive old profile file AND current AUTH_ACTIVE.
#             * Overwrite that profile file with AUTH_ACTIVE.
#         - If not found:
#             * Archive AUTH_ACTIVE as a new snapshot in updated/.
# -----------------------------------------------------------
archive_and_update_auth_if_needed() {
  # 1. No active auth.json -> nothing to do
  if [ ! -f "$AUTH_ACTIVE" ]; then
    return 0
  fi

  # 2. Exact match check: if AUTH_ACTIVE matches any *.auth.json, do nothing
  local f
  for f in "$CODEX_DIR"/*.auth.json; do
    [ -f "$f" ] || continue
    if cmp -s "$AUTH_ACTIVE" "$f"; then
      # Exact duplicate found; nothing changed
      return 0
    fi
  done

  # 3. No exact duplicate; now inspect account_id
  local active_account_id
  active_account_id="$(get_account_id "$AUTH_ACTIVE")"

  # 3a. No account_id -> API-key-only or unknown format: archive new auth.json only
  if [ -z "$active_account_id" ]; then
    local ts newfile
    ts=$(date +"%Y%m%d-%H%M%S")
    newfile="$UPDATED_DIR/$ts.auth.json"
    cp "$AUTH_ACTIVE" "$newfile"
    echo "Archived new auth (no account_id) → $newfile"
    return 0
  fi

  # 3b. account_id present -> try to find matching profile
  local matched_profile=""
  local profile_account_id

  for f in "$CODEX_DIR"/*.auth.json; do
    [ -f "$f" ] || continue
    # We've already ruled out exact duplicates above; here we care only about account_id
    profile_account_id="$(get_account_id "$f")"
    if [ -n "$profile_account_id" ] && [ "$profile_account_id" = "$active_account_id" ]; then
      matched_profile="$f"
      break
    fi
  done

  local ts base old_backup new_backup

  if [ -n "$matched_profile" ]; then
    # Found a profile with same account_id -> treat as update
    ts=$(date +"%Y%m%d-%H%M%S")
    base="$(basename "$matched_profile")"

    old_backup="$UPDATED_DIR/$ts.old.$base"
    new_backup="$UPDATED_DIR/$ts.new.$base"

    cp "$matched_profile" "$old_backup"
    cp "$AUTH_ACTIVE" "$new_backup"
    echo "Archived old profile auth → $old_backup"
    echo "Archived updated auth → $new_backup"

    # Overwrite matched profile with the new auth
    cp "$AUTH_ACTIVE" "$matched_profile"
    echo "Updated profile '$matched_profile' with new auth (account_id=$active_account_id)."
  else
    # No profile with same account_id -> treat as completely new auth
    ts=$(date +"%Y%m%d-%H%M%S")
    new_backup="$UPDATED_DIR/$ts.auth.json"
    cp "$AUTH_ACTIVE" "$new_backup"
    echo "Archived new auth (unknown account_id=$active_account_id) → $new_backup"
  fi
}

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
  docker build --no-cache --pull -t codex-image - <<'EOF'
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
# Before switching profiles → detect/merge/archive current auth
# -----------------------------------------------------------
archive_and_update_auth_if_needed

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
    exit 0
  fi

  if [ ! -f "$PROFILE_FILE" ]; then
    echo "Profile '$PROFILE' does not exist: $PROFILE_FILE"
    exit 1
  fi

  echo "Activating profile '$PROFILE'..."
  cp "$PROFILE_FILE" "$AUTH_ACTIVE"
  echo "$PROFILE" > "$CURRENT_PROFILE_FILE"
else
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
# After Codex exits → detect/merge/archive current auth
# -----------------------------------------------------------
archive_and_update_auth_if_needed

echo "Done."
