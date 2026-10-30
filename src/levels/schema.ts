import { checkPlacement } from '../editor/placement';
import type { Inventory } from '../editor/editor';
import { PART_DEFS, type PartSpec, type PartType } from '../parts/defs';

export interface LevelData {
  id: string;
  name: string;
  /** 레벨 시작 시 보여 줄 한 줄 힌트 */
  hint: string;
  /** 플레이어가 움직일 수 없는 고정 부품 */
  fixed: PartSpec[];
  /** 플레이어가 배치할 수 있는 부품과 수량 */
  inventory: Inventory;
}

export const GOAL_TYPES: readonly PartType[] = ['basket', 'bell'];

/**
 * 레벨 데이터 정합성 검사. 오류 메시지 목록을 반환하며, 빈 배열이면 유효하다.
 * 손으로 작성한 레벨 데이터의 실수를 테스트 단계에서 잡기 위한 용도다.
 */
export function validateLevel(level: LevelData): string[] {
  const errors: string[] = [];
  if (!level.id?.trim()) errors.push('level id must be non-empty');
  if (!level.name?.trim()) errors.push('level name must be non-empty');

  const seen = new Set<string>();
  const valid: PartSpec[] = [];
  for (const spec of level.fixed) {
    if (seen.has(spec.id)) errors.push(`duplicate part id: ${spec.id}`);
    seen.add(spec.id);
    if (!Object.prototype.hasOwnProperty.call(PART_DEFS, spec.type)) {
      errors.push(`unknown part type: ${String(spec.type)} (${spec.id})`);
      continue;
    }
    if (![spec.x, spec.y, spec.angle].every(Number.isFinite)) {
      errors.push(`part ${spec.id} must have finite x/y/angle`);
      continue;
    }
    const result = checkPlacement(spec, valid);
    if (!result.ok) {
      errors.push(
        result.reason === 'out-of-bounds'
          ? `part ${spec.id} is out of field bounds`
          : `part ${spec.id} overlaps ${result.otherId}`,
      );
    }
    valid.push(spec);
  }
  if (!level.fixed.some((s) => GOAL_TYPES.includes(s.type))) errors.push('level needs at least one goal (basket or bell)');

  const entries = Object.entries(level.inventory) as [PartType, number][];
  let total = 0;
  for (const [type, count] of entries) {
    if (!Object.prototype.hasOwnProperty.call(PART_DEFS, type)) errors.push(`inventory has unknown type: ${type}`);
    if (GOAL_TYPES.includes(type)) errors.push(`goal part ${type} cannot be in inventory`);
    if (!(Number.isInteger(count) && count >= 0)) errors.push(`inventory count for ${type} must be a non-negative integer`);
    else total += count;
  }
  if (total === 0) errors.push('inventory must offer at least one part');
  return errors;
}
