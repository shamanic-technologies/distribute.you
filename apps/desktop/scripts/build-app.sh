#!/bin/sh
# Builds Distribute.app (universal: Apple silicon + Intel) and zips it.
# Needs Xcode (CI: macos-14 runner). Output: build/Distribute.zip
set -eu
cd "$(dirname "$0")/.."
VERSION="${DESKTOP_VERSION:-0.1.0}"
APP=build/Distribute.app
rm -rf build && mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

for arch in arm64 x86_64; do
  swiftc -O -parse-as-library -target "$arch-apple-macos14.0" \
    Sources/Distribute/*.swift -o "build/Distribute-$arch"
done
lipo -create build/Distribute-arm64 build/Distribute-x86_64 -output "$APP/Contents/MacOS/Distribute"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Distribute</string>
  <key>CFBundleDisplayName</key><string>distribute</string>
  <key>CFBundleIdentifier</key><string>you.distribute.desktop</string>
  <key>CFBundleExecutable</key><string>Distribute</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.business</string>
</dict>
</plist>
PLIST

# Ad-hoc signature: no Apple Developer ID yet (private beta). install.sh clears quarantine.
codesign --force --deep --sign - "$APP"
ditto -c -k --keepParent "$APP" build/Distribute.zip
ls -la build/Distribute.zip
