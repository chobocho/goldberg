import { describe, expect, it } from 'vitest';
import { PROGRESS_KEY, isUnlocked, loadProgress, saveProgress, type KeyValueStorage } from '../src/game/progress';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
}

const throwing: KeyValueStorage = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('loadProgress / saveProgress', () => {
  it('빈 저장소는 클리어 기록 없음', () => {
    expect(loadProgress(memoryStorage())).toEqual(new Set());
  });

  it('저장 후 다시 읽으면 같은 기록', () => {
    const storage = memoryStorage();
    saveProgress(storage, new Set(['a', 'b']));
    expect(loadProgress(storage)).toEqual(new Set(['a', 'b']));
  });

  it('손상된 JSON 은 빈 기록으로 취급한다', () => {
    expect(loadProgress(memoryStorage({ [PROGRESS_KEY]: '{oops' }))).toEqual(new Set());
  });

  it.each([
    ['배열이 아님', '{"cleared":"a"}'],
    ['객체가 아님', '42'],
    ['null', 'null'],
  ])('형식이 틀리면(%s) 빈 기록', (_, raw) => {
    expect(loadProgress(memoryStorage({ [PROGRESS_KEY]: raw }))).toEqual(new Set());
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    const storage = memoryStorage({ [PROGRESS_KEY]: '{"cleared":["a",1,null,"b"]}' });
    expect(loadProgress(storage)).toEqual(new Set(['a', 'b']));
  });

  it('저장소 접근이 예외를 던져도(사생활 보호 모드 등) 게임은 계속된다', () => {
    expect(loadProgress(throwing)).toEqual(new Set());
    expect(() => saveProgress(throwing, new Set(['a']))).not.toThrow();
  });

  it('저장소가 없으면(null) 빈 기록, 저장은 무시', () => {
    expect(loadProgress(null)).toEqual(new Set());
    expect(() => saveProgress(null, new Set(['a']))).not.toThrow();
  });
});

describe('isUnlocked', () => {
  const ids = ['l1', 'l2', 'l3'];

  it('첫 레벨은 항상 열려 있다', () => {
    expect(isUnlocked(ids, new Set(), 0)).toBe(true);
  });

  it('이전 레벨을 클리어해야 다음 레벨이 열린다', () => {
    expect(isUnlocked(ids, new Set(), 1)).toBe(false);
    expect(isUnlocked(ids, new Set(['l1']), 1)).toBe(true);
    expect(isUnlocked(ids, new Set(['l1']), 2)).toBe(false);
  });

  it.each([-1, 3, 1.5, Number.NaN])('범위 밖 인덱스(%s)는 false', (i) => {
    expect(isUnlocked(ids, new Set(ids), i)).toBe(false);
  });
});
