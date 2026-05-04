#!/bin/bash
# Push stdin to Windows clipboard via clip.exe (WSL → Windows).
# Usage:
#   echo "text" | tools/sequencer/clip.sh
#   tools/sequencer/clip.sh < file.txt
#   tools/sequencer/clip.sh "literal string"
set -euo pipefail
if [ $# -gt 0 ]; then
  printf '%s' "$*" | clip.exe
else
  clip.exe
fi
echo "[clip] $(wc -c) bytes copied to Windows clipboard." >&2
