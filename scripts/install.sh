#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
INSTALL_DIR="$HOME/.local/bin"
TARGET="$INSTALL_DIR/aw"

mkdir -p "$INSTALL_DIR"

# __PROJECT_DIR__ 플레이스홀더를 실제 경로로 치환하여 설치
tmp="$(mktemp)"
sed "s|__PROJECT_DIR__|$PROJECT_DIR|g" "$SCRIPT_DIR/aw" > "$tmp"
chmod +x "$tmp"
mv "$tmp" "$TARGET"

echo "Installed: $TARGET"
echo "Project dir: $PROJECT_DIR"

# PATH 확인
if ! echo ":$PATH:" | grep -q ":$INSTALL_DIR:"; then
  echo ""
  echo "Note: $INSTALL_DIR is not in your PATH."
  echo "Add the following to your ~/.bashrc or ~/.zshrc:"
  echo ""
  echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
  echo "Then run: source ~/.bashrc  (or ~/.zshrc)"
fi
