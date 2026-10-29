### [2026-10-29 16:08] 프로젝트 스캐폴딩 및 단일 파일 빌드 파이프라인 구축
- **기획:** TS + Canvas 게임을 release/index.html 하나로 산출하는 빌드 파이프라인을 만들고, 폴드 커버 화면 기준 1:2 세로 월드와 뷰포트 맞춤을 구성.
- **TC:** 정상(인라인 치환, 한글 보존, 화면 맞춤) / 엣지(</script 이스케이프, $ 패턴, 자리표시자 누락·중복, 잔재 제거, dpr·화면·월드 크기 비정상값).
- **개발:** scripts/build.mjs, scripts/inline.mjs, src/render/viewport.ts, src/main.ts, src/config.ts, src/index.html, src/style.css, tests/*.test.ts
- **검증:** 32 passed, 0 failed (tsc 오류 0, 빌드 2.0 KB)
- **비고:** Termux 환경에서 rollup 네이티브 로드가 실패해 npm overrides로 @rollup/wasm-node로 대체.
