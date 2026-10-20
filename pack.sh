#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUTPUT="dynamic-island@bjagetic.shell-extension.zip"

echo "Compiling GSettings schemas..."
glib-compile-schemas "$DIR/schemas"

echo "Packaging extension to $OUTPUT..."
rm -f "$DIR/$OUTPUT"

zip -qr "$DIR/$OUTPUT" \
  extension.js \
  island.js \
  prefs.js \
  metadata.json \
  stylesheet.css \
  schemas/ \
  sources/

echo "Done! Package created: $OUTPUT"
