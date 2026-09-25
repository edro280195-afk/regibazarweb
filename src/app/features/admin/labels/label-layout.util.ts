import { LabelElementDefinition } from '../../../core/models';

export type LabelSelectionAlignment = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';
export type LabelDistributionDirection = 'horizontal' | 'vertical';

export interface LabelElementPosition {
    id: string;
    x: number;
    y: number;
}

export function alignSelection(
    elements: readonly LabelElementDefinition[],
    position: LabelSelectionAlignment
): Map<string, LabelElementPosition> {
    if (elements.length < 2) return new Map();
    const left = Math.min(...elements.map(element => element.x));
    const right = Math.max(...elements.map(element => element.x + element.width));
    const top = Math.min(...elements.map(element => element.y));
    const bottom = Math.max(...elements.map(element => element.y + element.height));

    return new Map(elements.map(element => [element.id, {
        id: element.id,
        x: position === 'left' ? left : position === 'center' ? (left + right - element.width) / 2 : position === 'right' ? right - element.width : element.x,
        y: position === 'top' ? top : position === 'middle' ? (top + bottom - element.height) / 2 : position === 'bottom' ? bottom - element.height : element.y
    }]));
}

export function distributeSelection(
    elements: readonly LabelElementDefinition[],
    direction: LabelDistributionDirection
): Map<string, LabelElementPosition> {
    if (elements.length < 3) return new Map();
    const ordered = [...elements].sort((left, right) => direction === 'horizontal' ? left.x - right.x : left.y - right.y);
    const totalSize = ordered.reduce((sum, element) => sum + (direction === 'horizontal' ? element.width : element.height), 0);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const available = direction === 'horizontal'
        ? last.x + last.width - first.x - totalSize
        : last.y + last.height - first.y - totalSize;
    const gap = available / (ordered.length - 1);
    let cursor = direction === 'horizontal' ? first.x : first.y;
    const positions = new Map<string, LabelElementPosition>();

    for (const element of ordered) {
        positions.set(element.id, {
            id: element.id,
            x: direction === 'horizontal' ? cursor : element.x,
            y: direction === 'vertical' ? cursor : element.y
        });
        cursor += (direction === 'horizontal' ? element.width : element.height) + gap;
    }
    return positions;
}
