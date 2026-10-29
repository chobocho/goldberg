import type { PartSpec, PartType, Vec } from '../parts/defs';
import { GRID, checkPlacement, clampIntoField, hitTestParts, rotated, snap } from './placement';

/** 부품별 배치 가능 수량. Infinity 는 무제한(샌드박스). */
export type Inventory = Partial<Record<PartType, number>>;

export interface DragState {
  spec: PartSpec;
  valid: boolean;
  isNew: boolean;
}

export type DropResult = 'none' | 'placed' | 'moved' | 'cancelled' | 'reverted' | 'removed';

/**
 * 편집 모드 상태. DOM 과 분리된 순수 로직이라 단위 테스트로 검증한다.
 * 좌표는 모두 필드 로컬 좌표다.
 */
export class Editor {
  placed: PartSpec[];
  selectedId: string | null = null;
  drag: DragState | null = null;
  private grabOffset: Vec = { x: 0, y: 0 };
  private serial = 1;

  constructor(
    readonly fixed: readonly PartSpec[],
    readonly inventory: Inventory,
    placed: readonly PartSpec[] = [],
  ) {
    this.placed = placed.map((s) => ({ ...s }));
  }

  remaining(type: PartType): number {
    const total = this.inventory[type] ?? 0;
    return total - this.placed.filter((s) => s.type === type).length;
  }

  private uniqueId(type: PartType): string {
    const used = new Set([...this.fixed, ...this.placed].map((s) => s.id));
    let id: string;
    do id = `${type}-${this.serial++}`;
    while (used.has(id));
    return id;
  }

  private othersExcept(id: string): PartSpec[] {
    return [...this.fixed, ...this.placed.filter((s) => s.id !== id)];
  }

  /** 트레이에서 새 부품 끌기 시작. grabOffset 은 손가락에 가려지지 않게 띄우는 거리. */
  beginNew(type: PartType, p: Vec, grabOffset: Vec = { x: 0, y: 0 }): boolean {
    if (this.remaining(type) <= 0) return false;
    this.grabOffset = grabOffset;
    this.drag = { spec: { id: this.uniqueId(type), type, x: p.x, y: p.y, angle: 0 }, valid: false, isNew: true };
    this.dragTo(p);
    return true;
  }

  /** 놓인 부품 잡기. 고정 부품은 잡을 수 없고, 빈 곳이면 선택을 해제한다. */
  beginMove(p: Vec): boolean {
    const id = hitTestParts(this.placed, p);
    const spec = id ? this.placed.find((s) => s.id === id) : undefined;
    if (!spec) {
      this.selectedId = null;
      return false;
    }
    this.selectedId = spec.id;
    this.grabOffset = { x: spec.x - p.x, y: spec.y - p.y };
    this.drag = { spec: { ...spec }, valid: true, isNew: false };
    return true;
  }

  dragTo(p: Vec): void {
    if (!this.drag) return;
    const spec = clampIntoField({
      ...this.drag.spec,
      x: snap(p.x + this.grabOffset.x, GRID),
      y: snap(p.y + this.grabOffset.y, GRID),
    });
    this.drag.spec = spec;
    this.drag.valid = checkPlacement(spec, this.othersExcept(spec.id)).ok;
  }

  endDrag(dropInTray: boolean): DropResult {
    const drag = this.drag;
    if (!drag) return 'none';
    this.drag = null;

    if (drag.isNew) {
      if (dropInTray || !drag.valid) return 'cancelled';
      this.placed.push(drag.spec);
      this.selectedId = drag.spec.id;
      return 'placed';
    }
    if (dropInTray) {
      this.placed = this.placed.filter((s) => s.id !== drag.spec.id);
      this.selectedId = null;
      return 'removed';
    }
    if (!drag.valid) return 'reverted';
    this.placed = this.placed.map((s) => (s.id === drag.spec.id ? drag.spec : s));
    return 'moved';
  }

  cancelDrag(): void {
    this.drag = null;
  }

  select(id: string | null): void {
    this.selectedId = id !== null && this.placed.some((s) => s.id === id) ? id : null;
  }

  selected(): PartSpec | null {
    return this.placed.find((s) => s.id === this.selectedId) ?? null;
  }

  rotateSelected(dir: 1 | -1): boolean {
    const spec = this.selected();
    const next = spec && rotated(spec, dir);
    if (!next || !checkPlacement(next, this.othersExcept(next.id)).ok) return false;
    this.placed = this.placed.map((s) => (s.id === next.id ? next : s));
    return true;
  }

  deleteSelected(): boolean {
    if (!this.selected()) return false;
    this.placed = this.placed.filter((s) => s.id !== this.selectedId);
    this.selectedId = null;
    return true;
  }

  clearPlaced(): void {
    this.placed = [];
    this.selectedId = null;
    this.drag = null;
  }

  /** 시뮬레이션에 들어갈 부품: 고정 → 배치 순서 (순서가 결정성에 영향을 준다) */
  allParts(): PartSpec[] {
    return [...this.fixed, ...this.placed];
  }

  /** 화면 표시용: 이동 중인 부품은 드래그 위치로, 새 부품은 맨 뒤에 붙인다 */
  displayParts(): PartSpec[] {
    const drag = this.drag;
    if (!drag) return this.allParts();
    if (drag.isNew) return [...this.allParts(), drag.spec];
    return [...this.fixed, ...this.placed.map((s) => (s.id === drag.spec.id ? drag.spec : s))];
  }
}
