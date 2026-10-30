// 저장 형식이 바뀌면 키의 버전을 올려 이전 데이터와 섞이지 않게 한다
export const PROGRESS_KEY = 'goldbug.progress.v1';

/** localStorage 의 필요한 부분만 추린 인터페이스 (테스트에서 대역 주입용) */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/**
 * 클리어한 레벨 id 목록을 읽는다.
 * 사생활 보호 모드·차단된 저장소·손상된 값에서도 예외 없이 빈 기록으로 시작하게 한다.
 */
export function loadProgress(storage: KeyValueStorage | null): Set<string> {
  if (!storage) return new Set();
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw === null) return new Set();
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return new Set();
    const cleared = (data as { cleared?: unknown }).cleared;
    if (!Array.isArray(cleared)) return new Set();
    return new Set(cleared.filter((id): id is string => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

/** 저장 실패(용량 초과 등)는 게임 진행을 막을 이유가 없으므로 조용히 무시한다 */
export function saveProgress(storage: KeyValueStorage | null, cleared: ReadonlySet<string>): void {
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify({ cleared: [...cleared] }));
  } catch {
    // 저장 불가 환경: 이번 세션 동안만 메모리에 유지된다
  }
}

/** 첫 레벨은 항상 열려 있고, 이후 레벨은 바로 앞 레벨을 클리어해야 열린다 */
export function isUnlocked(levelIds: readonly string[], cleared: ReadonlySet<string>, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= levelIds.length) return false;
  return index === 0 || cleared.has(levelIds[index - 1]);
}

/** 브라우저 localStorage 접근 자체가 예외를 던지는 환경을 고려해 안전하게 가져온다 */
export function browserStorage(): KeyValueStorage | null {
  try {
    return window.localStorage ?? null;
  } catch {
    return null;
  }
}
