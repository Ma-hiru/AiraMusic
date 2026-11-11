#!/usr/bin/env bash
# ncm 层的覆盖率报告（基于 rustc 自带的 llvm-profdata / llvm-cov）。
#
# 用法：
#   packages/app-tauri/scripts/coverage.sh            # 全部文件
#   packages/app-tauri/scripts/coverage.sh src/ncm    # 只看 ncm
#
# 需要 `rustup component add llvm-tools-preview`（已装则跳过）。
set -euo pipefail

cd "$(dirname "$0")/.."

FILTER="${1:-src/ncm}"
COV_DIR="target/cov-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$COV_DIR"

SYSROOT="$(rustc --print sysroot)"
TARGET="$(rustc -vV | awk '/^host:/{print $2}')"
LLVM_BIN="$SYSROOT/lib/rustlib/$TARGET/bin"
if [ ! -x "$LLVM_BIN/llvm-cov" ]; then
  echo "缺少 llvm-tools：rustup component add llvm-tools-preview" >&2
  exit 1
fi

echo "==> 运行测试（instrument-coverage）"
RUSTFLAGS="-C instrument-coverage" \
  LLVM_PROFILE_FILE="$PWD/$COV_DIR/%p-%m.profraw" \
  cargo test --lib

echo "==> 合并 profile"
"$LLVM_BIN/llvm-profdata" merge -sparse "$COV_DIR"/*.profraw \
  -o "$COV_DIR/merged.profdata"

BIN="$(find target/debug/deps -maxdepth 1 -type f -name 'aira_music_tauri_lib-*' -perm -111 -print0 \
  | xargs -0 ls -t | head -1)"

echo "==> 报告 (${FILTER})"
"$LLVM_BIN/llvm-cov" report "$BIN" \
  -instr-profile="$COV_DIR/merged.profdata" \
  --ignore-filename-regex='(\.cargo|rustc/|/ncm/(testkit|parity|routes_parity|live)\.rs)' \
  | grep -E "(${FILTER}|^TOTAL)"
