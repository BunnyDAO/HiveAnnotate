#!/bin/sh
# Builds the native helper. No node-gyp: one file, one clang invocation.
set -e
here=$(cd "$(dirname "$0")" && pwd)
out="$here/../build"
mkdir -p "$out"
clang -fobjc-arc -mmacosx-version-min=11.0 \
  -framework Foundation -framework AppKit -framework CoreGraphics -framework Carbon \
  -o "$out/hive-helper" "$here/hive-helper.m"
echo "built $out/hive-helper"
