import { describe, expect, it } from 'vitest';
import { Editor } from '../src/editor/editor';
import { GameSession } from '../src/game/session';

function sessionWithPlank() {
  const editor = new Editor([{ id: 'b', type: 'ball', x: 200, y: 100, angle: 0 }], { plank: 1 });
  editor.beginNew('plank', { x: 220, y: 300 });
  editor.endDrag(false);
  return new GameSession(editor);
}

describe('GameSession', () => {
  it('처음에는 편집 모드이고 시뮬레이션이 없다', () => {
    const s = sessionWithPlank();
    expect(s.mode).toBe('edit');
    expect(s.simulation).toBeNull();
  });

  it('run 하면 고정+배치 부품으로 시뮬레이션을 만들고 선택을 해제한다', () => {
    const s = sessionWithPlank();
    s.run();
    expect(s.mode).toBe('run');
    expect(s.simulation!.snapshot().map((b) => b.id)).toEqual(s.editor.allParts().map((p) => p.id));
    expect(s.editor.selectedId).toBeNull();
  });

  it('진행 중 드래그가 있으면 취소하고 실행한다', () => {
    const s = sessionWithPlank();
    s.editor.beginMove({ x: 220, y: 300 });
    s.run();
    expect(s.editor.drag).toBeNull();
  });

  it('reset 하면 편집 모드로 돌아오고 배치는 그대로다', () => {
    const s = sessionWithPlank();
    const before = structuredClone(s.editor.placed);
    s.run();
    s.update(1000);
    s.reset();
    expect(s.mode).toBe('edit');
    expect(s.simulation).toBeNull();
    expect(s.editor.placed).toEqual(before);
  });

  it('update 는 실행 중에만 스텝을 진행한다', () => {
    const s = sessionWithPlank();
    s.update(1000);
    expect(s.simulation).toBeNull();
    s.run();
    s.update(50);
    expect(s.simulation!.stepCount).toBe(3);
  });

  it('실행 중 run 을 다시 호출해도 시뮬레이션이 새로 만들어지지 않는다', () => {
    const s = sessionWithPlank();
    s.run();
    const sim = s.simulation;
    s.run();
    expect(s.simulation).toBe(sim);
  });
});

describe('GameSession 클리어', () => {
  function winnable() {
    const editor = new Editor(
      [
        { id: 'b', type: 'ball', x: 300, y: 600, angle: 0 },
        { id: 'goal', type: 'basket', x: 300, y: 801, angle: 0 },
      ],
      { plank: 1 },
    );
    return new GameSession(editor);
  }

  it('목표를 달성하면 result 가 won 이 된다', () => {
    const s = winnable();
    expect(s.result).toBe('none');
    s.run();
    for (let i = 0; i < 60 && s.result === 'none'; i++) s.update(1000 / 60);
    expect(s.result).toBe('won');
  });

  it('reset 하면 result 가 초기화된다', () => {
    const s = winnable();
    s.run();
    for (let i = 0; i < 60; i++) s.update(1000 / 60);
    s.reset();
    expect(s.result).toBe('none');
  });
});
