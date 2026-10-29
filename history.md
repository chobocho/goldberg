### [2026-10-29 23:39] matter-js 물리 월드와 MVP 부품 구현
- **기획:** 부품 9종(공·쇠공·판자·도미노·시소·스프링·벽·바구니·종)을 정의/팩토리로 분리하고 고정 타임스텝 시뮬레이션으로 결정성을 보장.
- **TC:** 정상(낙하·경사 굴절·도미노 전도·시소 발사·스프링 속도) / 엣지(결정성, 중복 id, 비유한 좌표, 긴 프레임 스텝 상한).
- **개발:** src/parts/defs.ts, src/parts/factory.ts, src/core/simulation.ts, src/render/renderer.ts, src/main.ts, src/config.ts, tests/parts.test.ts, tests/simulation.test.ts
- **검증:** 78 passed, 0 failed (tsc 오류 0, 빌드 93.5 KB)
- **비고:** 스프링 발사는 충돌 해소 뒤 속도를 지정하는 방식. main.ts 는 임시 데모 장면.

### [2026-10-29 16:08] 프로젝트 스캐폴딩 및 단일 파일 빌드 파이프라인 구축
- **기획:** TS + Canvas 게임을 release/index.html 하나로 산출하는 빌드 파이프라인을 만들고, 폴드 커버 화면 기준 1:2 세로 월드와 뷰포트 맞춤을 구성.
- **TC:** 정상(인라인 치환, 한글 보존, 화면 맞춤) / 엣지(</script 이스케이프, $ 패턴, 자리표시자 누락·중복, 잔재 제거, dpr·화면·월드 크기 비정상값).
- **개발:** scripts/build.mjs, scripts/inline.mjs, src/render/viewport.ts, src/main.ts, src/config.ts, src/index.html, src/style.css, tests/*.test.ts
- **검증:** 32 passed, 0 failed (tsc 오류 0, 빌드 2.0 KB)
- **비고:** Termux 환경에서 rollup 네이티브 로드가 실패해 npm overrides로 @rollup/wasm-node로 대체.
