import { describe, expect, it } from 'vitest';
import { FIELD } from '../src/config';
import { Editor } from '../src/editor/editor';
import { polygonBounds, worldOutline } from '../src/editor/geometry';
import type { PartSpec } from '../src/parts/defs';

const fixedBall: PartSpec = { id: 'fixed-ball', type: 'ball', x: 100, y: 100, angle: 0 };

function placeAt(editor: Editor, type: PartSpec['type'], x: number, y: number): string {
  expect(editor.beginNew(type, { x, y })).toBe(true);
  expect(editor.endDrag(false)).toBe('placed');
  return editor.selectedId!;
}

describe('Editor 인벤토리', () => {
  it('배치하면 남은 수량이 줄고, 삭제하면 돌아온다', () => {
    const editor = new Editor([fixedBall], { plank: 2 });
    expect(editor.remaining('plank')).toBe(2);
    placeAt(editor, 'plank', 300, 400);
    expect(editor.remaining('plank')).toBe(1);
    expect(editor.deleteSelected()).toBe(true);
    expect(editor.remaining('plank')).toBe(2);
  });

  it('인벤토리에 없는 타입은 0, 수량이 0이면 새 드래그를 시작할 수 없다', () => {
    const editor = new Editor([], { plank: 1 });
    expect(editor.remaining('domino')).toBe(0);
    expect(editor.beginNew('domino', { x: 200, y: 200 })).toBe(false);
    placeAt(editor, 'plank', 300, 400);
    expect(editor.beginNew('plank', { x: 300, y: 600 })).toBe(false);
    expect(editor.drag).toBeNull();
  });

  it('무제한(Infinity) 인벤토리는 줄지 않는다', () => {
    const editor = new Editor([], { ball: Infinity });
    placeAt(editor, 'ball', 200, 200);
    expect(editor.remaining('ball')).toBe(Infinity);
  });

  it('삭제 후 다시 놓아도 id 가 겹치지 않는다', () => {
    const editor = new Editor([], { plank: 3 });
    const a = placeAt(editor, 'plank', 270, 200);
    const b = placeAt(editor, 'plank', 270, 400);
    editor.select(a);
    editor.deleteSelected();
    const c = placeAt(editor, 'plank', 270, 600);
    expect(new Set([b, c]).size).toBe(2);
  });
});

describe('Editor 드래그', () => {
  it('새 부품은 격자에 스냅되어 놓이고 선택된다', () => {
    const editor = new Editor([], { plank: 1 });
    editor.beginNew('plank', { x: 100, y: 100 });
    editor.dragTo({ x: 273, y: 406 });
    expect(editor.drag!.valid).toBe(true);
    expect(editor.endDrag(false)).toBe('placed');
    const placed = editor.placed[0];
    expect([placed.x, placed.y]).toEqual([270, 410]);
    expect(editor.selectedId).toBe(placed.id);
  });

  it('고정 부품과 겹치는 곳에 놓으면 취소되고 수량은 그대로', () => {
    const editor = new Editor([fixedBall], { plank: 1 });
    editor.beginNew('plank', { x: 100, y: 100 });
    expect(editor.drag!.valid).toBe(false);
    expect(editor.endDrag(false)).toBe('cancelled');
    expect(editor.placed).toHaveLength(0);
    expect(editor.remaining('plank')).toBe(1);
  });

  it('트레이에 떨어뜨린 새 부품은 취소된다', () => {
    const editor = new Editor([], { plank: 1 });
    editor.beginNew('plank', { x: 270, y: 400 });
    expect(editor.endDrag(true)).toBe('cancelled');
    expect(editor.placed).toHaveLength(0);
  });

  it('바닥 아래로 끌면 바닥 위로 밀어 올린다', () => {
    const editor = new Editor([], { domino: 1 });
    editor.beginNew('domino', { x: 200, y: 300 });
    editor.dragTo({ x: 200, y: 2000 });
    expect(polygonBounds(worldOutline(editor.drag!.spec)).maxY).toBeCloseTo(FIELD.height, 9);
    expect(editor.drag!.valid).toBe(true);
  });

  it('잡은 지점 오프셋을 유지하며 이동한다', () => {
    const editor = new Editor([], { plank: 1 });
    const id = placeAt(editor, 'plank', 270, 400);
    expect(editor.beginMove({ x: 300, y: 400 })).toBe(true);
    editor.dragTo({ x: 300, y: 500 });
    expect(editor.endDrag(false)).toBe('moved');
    const moved = editor.placed.find((s) => s.id === id)!;
    expect([moved.x, moved.y]).toEqual([270, 500]);
  });

  it('이동을 무효한 곳에서 끝내면 원래 위치로 되돌린다', () => {
    const editor = new Editor([fixedBall], { plank: 1 });
    const id = placeAt(editor, 'plank', 270, 400);
    editor.beginMove({ x: 270, y: 400 });
    editor.dragTo({ x: 120, y: 100 });
    expect(editor.endDrag(false)).toBe('reverted');
    const spec = editor.placed.find((s) => s.id === id)!;
    expect([spec.x, spec.y]).toEqual([270, 400]);
  });

  it('놓인 부품을 트레이로 끌면 삭제되고 수량이 돌아온다', () => {
    const editor = new Editor([], { plank: 1 });
    placeAt(editor, 'plank', 270, 400);
    editor.beginMove({ x: 270, y: 400 });
    expect(editor.endDrag(true)).toBe('removed');
    expect(editor.placed).toHaveLength(0);
    expect(editor.remaining('plank')).toBe(1);
    expect(editor.selectedId).toBeNull();
  });

  it('고정 부품은 잡을 수 없다', () => {
    const editor = new Editor([fixedBall], {});
    expect(editor.beginMove({ x: 100, y: 100 })).toBe(false);
  });

  it('빈 곳을 누르면 선택이 해제된다', () => {
    const editor = new Editor([], { plank: 1 });
    placeAt(editor, 'plank', 270, 400);
    expect(editor.beginMove({ x: 50, y: 700 })).toBe(false);
    expect(editor.selectedId).toBeNull();
  });

  it('드래그 중이 아닐 때 endDrag 는 none', () => {
    expect(new Editor([], {}).endDrag(false)).toBe('none');
  });
});

describe('Editor 회전/삭제', () => {
  it('선택된 판자를 회전한다', () => {
    const editor = new Editor([], { plank: 1 });
    placeAt(editor, 'plank', 270, 400);
    expect(editor.rotateSelected(1)).toBe(true);
    expect(editor.placed[0].angle).toBeCloseTo(Math.PI / 12, 9);
  });

  it('회전 결과가 겹치면 거부한다', () => {
    // 벽 아래끝(y=400)은 판자 윗면(y=403)과 떨어져 있지만, 시계 방향 15° 회전 시 판자 왼쪽 끝이 벽을 파고든다
    const editor = new Editor([{ id: 'w', type: 'wall', x: 200, y: 330, angle: 0 }], { plank: 1 });
    placeAt(editor, 'plank', 270, 410);
    expect(editor.rotateSelected(1)).toBe(false);
    expect(editor.placed[0].angle).toBe(0);
  });

  it('회전 불가 부품이나 선택 없음은 false', () => {
    const editor = new Editor([], { ball: 1 });
    expect(editor.rotateSelected(1)).toBe(false);
    placeAt(editor, 'ball', 200, 200);
    expect(editor.rotateSelected(1)).toBe(false);
  });

  it('선택이 없으면 삭제는 false', () => {
    expect(new Editor([], {}).deleteSelected()).toBe(false);
  });

  it('allParts 는 고정 부품 다음 배치 부품 순서', () => {
    const editor = new Editor([fixedBall], { plank: 1 });
    const id = placeAt(editor, 'plank', 270, 400);
    expect(editor.allParts().map((s) => s.id)).toEqual(['fixed-ball', id]);
  });

  it('clearPlaced 는 배치 부품을 모두 회수한다', () => {
    const editor = new Editor([], { plank: 2 });
    placeAt(editor, 'plank', 270, 200);
    placeAt(editor, 'plank', 270, 400);
    editor.clearPlaced();
    expect(editor.placed).toHaveLength(0);
    expect(editor.remaining('plank')).toBe(2);
  });
});
