#!/usr/bin/env bash
set -e

UUID="dynamic-island@bjagetic"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Installing $UUID to $DEST..."
mkdir -p "$DEST"
cp -r "$DIR"/extension.js "$DIR"/island.js "$DIR"/prefs.js "$DIR"/metadata.json "$DIR"/stylesheet.css "$DIR"/schemas "$DIR"/sources "$DEST/"

echo "Compiling schemas..."
glib-compile-schemas "$DEST/schemas"

echo "Reloading extension..."
gnome-extensions disable "$UUID" 2>/dev/null || true
sleep 0.5
gnome-extensions enable "$UUID" 2>/dev/null || true

echo "Dynamic Island Hybrid has been successfully installed and enabled!"
