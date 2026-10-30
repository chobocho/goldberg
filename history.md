### [2026-10-30 03:04] 트레이 페이지 넘김
- **기획:** 부품이 8종을 넘으면 최소 터치 크기를 지키도록 ◀ ▶ 버튼과 페이지당 6칸으로 나누고, 양 끝에서 순환.
- **TC:** 정상(8종 이하 한 줄, 페이지별 슬롯 구성, 마지막 페이지 잔여) / 엣지(범위 밖·NaN 페이지 보정, 빈 목록, 겹침·터치 크기).
- **개발:** src/render/ui.ts, src/game/app.ts, tests/ui.test.ts
- **검증:** 248 passed, 0 failed (tsc 오류 0, 빌드 110.0 KB)

### [2026-10-30 00:15] 메뉴·레벨 진행 저장·샌드박스·클리어 오버레이
- **기획:** 메뉴에서 레벨(순차 해금)과 샌드박스를 고르고, 클리어 시 다시/다음 오버레이와 localStorage 진행 저장을 제공.
- **TC:** 정상(저장·복원, 해금, 메뉴/오버레이 배치, 레벨1 클리어→다음 레벨) / 엣지(손상 JSON, 저장소 예외·null, 범위 밖 인덱스, 잠긴 레벨 탭).
- **개발:** src/game/app.ts, src/game/progress.ts, src/levels/sandbox.ts, src/levels/schema.ts, src/render/ui.ts, tests/menu.test.ts, tests/progress.test.ts, tests/smoke.test.ts 외 1개 파일
- **검증:** 238 passed, 0 failed (tsc 오류 0, 빌드 109.3 KB)
- **비고:** 임시 연습장(practice.ts)은 샌드박스로 대체. 실기기(폴드8 커버) 화면 확인 필요.

### [2026-10-30 00:10] 목표 판정과 오리지널 스테이지 5개
- **기획:** 바구니(공 중심이 센서 안)·종(움직이는 물체 접촉) 목표를 판정하고, 시뮬레이션 탐색으로 정답이 성립하는 5개 레벨을 설계.
- **TC:** 정상(목표 달성·유지·다중 목표, 레벨별 정답 클리어) / 엣지(빈 배치 미클리어, 스키마 오류 12종, 정답의 격자·회전 재현성).
- **개발:** src/core/simulation.ts, src/levels/schema.ts, src/levels/index.ts, src/game/session.ts, src/game/app.ts, src/render/renderer.ts, src/parts/factory.ts, tests/levels.test.ts 외 5개 파일
- **검증:** 210 passed, 0 failed (tsc 오류 0, 빌드 104.7 KB)
- **비고:** 도미노 연쇄가 끊겨 치수·마찰을 10x60/0.1/모서리 3으로 조정. 공 제공 레벨은 종을 지붕으로 보호.

### [2026-10-29 23:47] 편집기: 드래그 배치·회전·스냅·터치 UI
- **기획:** DOM 과 분리된 Editor/GameSession 순수 로직 위에 포인터 입력과 하단 트레이 UI 를 연결해 한 손 터치로 배치·실행·리셋.
- **TC:** 정상(스냅 배치, 오프셋 이동, 회전, 실행/리셋 보존) / 엣지(SAT 맞닿음·포함·대각 분리, 경계 밀어넣기, 수량 0·무제한, 트레이 드롭 삭제, 멀티터치).
- **개발:** src/editor/geometry.ts, src/editor/placement.ts, src/editor/editor.ts, src/game/session.ts, src/game/app.ts, src/render/ui.ts, src/levels/practice.ts, tests/helpers/fakeBrowser.ts 외 9개 파일
- **검증:** 158 passed, 0 failed (tsc 오류 0, 빌드 102.8 KB)
- **비고:** 실제 브라우저가 없어 가짜 DOM 스모크 테스트로 대체 검증. 메뉴 버튼은 다음 작업에서 연결.

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
