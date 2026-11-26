#!/bin/sh
# Runs in every build of the iOS app (an Xcode build phase).
# MA-02: a release build must name an HTTPS server; clear-text HTTP exists only in debug builds.
set -eu
if [ "$CONFIGURATION" != "Debug" ]; then
  case "$HEACH_SERVER_URL" in
    https://*) ;;
    *) echo "error: Release builds need HEACH_SERVER_URL set to an https:// address."; exit 1 ;;
  esac
fi
