#!/usr/bin/env bash
#
# Installs the `keepenv` command so you can run `keepenv .` from any folder.
#
#   ./scripts/install-cli.sh
#   KEEPENV_BIN_DIR="$HOME/.local/bin" ./scripts/install-cli.sh
#
# Uninstall by deleting the file it reports.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

# Prefer the copy inside an installed Keepenv.app so the command tracks app
# updates. Fall back to the one beside this script, for a source checkout.
SOURCE=""
for candidate in \
    "/Applications/Keepenv.app/Contents/Resources/bin/keepenv" \
    "$HOME/Applications/Keepenv.app/Contents/Resources/bin/keepenv" \
    "$SCRIPT_DIR/keepenv"; do
  if [ -f "$candidate" ]; then
    SOURCE="$candidate"
    break
  fi
done

if [ -z "$SOURCE" ]; then
  printf 'Could not find the keepenv wrapper to install.\n' >&2
  exit 1
fi

on_path() {
  case ":$PATH:" in
    *":$1:"*) return 0 ;;
    *) return 1 ;;
  esac
}

# Pick a destination: an explicit choice, then the conventional location, then
# any directory already on PATH that the user owns. Installing without sudo is
# worth more than insisting on /usr/local/bin.
TARGET_DIR=""
if [ -n "${KEEPENV_BIN_DIR-}" ]; then
  TARGET_DIR="$KEEPENV_BIN_DIR"
  if [ ! -d "$TARGET_DIR" ]; then
    printf 'Directory %s does not exist.\n' "$TARGET_DIR" >&2
    exit 1
  fi
  if [ ! -w "$TARGET_DIR" ]; then
    printf '%s is not writable by your user.\n' "$TARGET_DIR" >&2
    exit 1
  fi
else
  for candidate in "/usr/local/bin" "/opt/homebrew/bin" "$HOME/.local/bin" "$HOME/bin"; do
    if [ -d "$candidate" ] && [ -w "$candidate" ] && on_path "$candidate"; then
      TARGET_DIR="$candidate"
      break
    fi
  done
fi

if [ -z "$TARGET_DIR" ]; then
  printf 'No writable directory on your PATH was found.\n\n' >&2
  printf 'Install with sudo:\n  sudo install -m 0755 "%s" /usr/local/bin/keepenv\n\n' "$SOURCE" >&2
  printf 'Or pick your own location:\n  mkdir -p "$HOME/.local/bin"\n' >&2
  printf '  KEEPENV_BIN_DIR="$HOME/.local/bin" %s\n' "$0" >&2
  printf '  export PATH="$HOME/.local/bin:$PATH"   # add to your shell profile\n' >&2
  exit 1
fi

TARGET="$TARGET_DIR/keepenv"
install -m 0755 "$SOURCE" "$TARGET"

printf 'Installed %s\n' "$TARGET"
if on_path "$TARGET_DIR"; then
  printf 'Try it:  cd into a project and run  keepenv .\n'
else
  printf '\nWarning: %s is not on your PATH.\n' "$TARGET_DIR"
  printf 'Add this to your shell profile:\n  export PATH="%s:$PATH"\n' "$TARGET_DIR"
fi
