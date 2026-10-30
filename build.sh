#!/usr/bin/env bash
# release/index.html 단일 산출물을 만든다.
# 순서: 의존성 설치(필요할 때만) → 타입 검사 → 테스트 → 빌드 → 산출물 검증
# 검증에 실패하면 중간에 멈추므로, 깨진 빌드가 upload.sh 로 올라가지 않는다.
set -euo pipefail

cd "$(dirname "$0")"

usage() {
  cat <<'EOF'
사용법: ./build.sh [옵션]

  --skip-tests   테스트를 건너뛴다 (타입 검사와 빌드는 수행)
  -h, --help     이 도움말을 출력한다
EOF
}

skip_tests=0
for arg in "$@"; do
  case "$arg" in
    --skip-tests) skip_tests=1 ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "알 수 없는 옵션: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for cmd in node npm; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "오류: $cmd 를 찾을 수 없습니다. Node.js 를 설치하세요." >&2
    exit 1
  fi
done

# node_modules 가 없거나 lock 파일이 설치 기록보다 새로우면 lock 기준으로 다시 설치한다
if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "▶ 의존성 설치"
  npm ci
fi

echo "▶ 타입 검사"
npm run --silent typecheck

if [ "$skip_tests" -eq 1 ]; then
  echo "▶ 테스트 건너뜀 (--skip-tests)"
else
  echo "▶ 테스트"
  npm test --silent
fi

echo "▶ 빌드"
npm run --silent build

# 산출물은 release/index.html 하나뿐이어야 한다
count=$(find release -type f | wc -l)
if [ ! -f release/index.html ] || [ "$count" -ne 1 ]; then
  echo "오류: release/ 에 index.html 하나만 있어야 합니다 (현재 파일 ${count}개)" >&2
  exit 1
fi

size=$(wc -c <release/index.html)
echo "✔ 완료: release/index.html ($((size / 1024)) KB)"
