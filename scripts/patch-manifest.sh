#!/usr/bin/env bash
# Patches android/app/src/main/AndroidManifest.xml with the permissions and
# foreground-service declaration required for background GPS tracking.
set -euo pipefail

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "⚠  AndroidManifest.xml not found — skipping patch."
  exit 0
fi

echo "📝 Patching AndroidManifest.xml…"

# Helper: insert a line before </manifest> if the given grep pattern is absent.
add_permission() {
  local pattern="$1"
  local line="$2"
  if grep -q "$pattern" "$MANIFEST"; then
    echo "   ✓ already present: $pattern"
  else
    # Use a temp file for compatibility with both GNU and BSD sed.
    sed "s|</manifest>|    $line\n</manifest>|" "$MANIFEST" > "$MANIFEST.tmp"
    mv "$MANIFEST.tmp" "$MANIFEST"
    echo "   + added: $line"
  fi
}

# Helper: insert a line before </application> if the given grep pattern is absent.
add_in_application() {
  local pattern="$1"
  local line="$2"
  if grep -q "$pattern" "$MANIFEST"; then
    echo "   ✓ already present: $pattern"
  else
    sed "s|</application>|        $line\n    </application>|" "$MANIFEST" > "$MANIFEST.tmp"
    mv "$MANIFEST.tmp" "$MANIFEST"
    echo "   + added: $line"
  fi
}

# ── Location permissions ────────────────────────────────────────────────────
add_permission "ACCESS_FINE_LOCATION" \
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />'

add_permission "ACCESS_COARSE_LOCATION" \
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />'

# Background location (Android 10+). The runtime dialog is shown by the
# @capacitor-community/background-geolocation plugin when requestPermissions=true.
add_permission "ACCESS_BACKGROUND_LOCATION" \
  '<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />'

# ── Foreground service ──────────────────────────────────────────────────────
add_permission 'FOREGROUND_SERVICE"' \
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />'

add_permission "FOREGROUND_SERVICE_LOCATION" \
  '<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />'

# ── Wake lock (keeps CPU alive during background recording) ─────────────────
add_permission "WAKE_LOCK" \
  '<uses-permission android:name="android.permission.WAKE_LOCK" />'

echo "✅ Manifest patch complete."
