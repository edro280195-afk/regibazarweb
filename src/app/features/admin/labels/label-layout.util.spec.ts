import { describe, expect, it } from 'vitest';
import { LabelElementDefinition } from '../../../core/models';
import { alignSelection, distributeSelection } from './label-layout.util';

function createElement(id: string, x: number, y: number, width: number, height: number): LabelElementDefinition {
    return {
        id,
        type: 'text',
        x,
        y,
        width,
        height,
        rotation: 0,
        visible: true,
        zIndex: 1,
        properties: { text: id }
    };
}

describe('label layout utilities', () => {
    it('aligns selected elements to the shared horizontal center without resizing them', () => {
        const elements = [
            createElement('a', 0, 4, 10, 8),
            createElement('b', 30, 9, 20, 8),
            createElement('c', 60, 15, 10, 8)
        ];

        const positions = alignSelection(elements, 'center');

        expect(positions.get('a')).toMatchObject({ x: 30, y: 4 });
        expect(positions.get('b')).toMatchObject({ x: 25, y: 9 });
        expect(positions.get('c')).toMatchObject({ x: 30, y: 15 });
    });

    it('distributes selected elements horizontally with equal gaps and preserves the endpoints', () => {
        const elements = [
            createElement('a', 0, 5, 10, 5),
            createElement('b', 22, 5, 20, 5),
            createElement('c', 70, 5, 10, 5)
        ];

        const positions = distributeSelection(elements, 'horizontal');

        expect(positions.get('a')).toMatchObject({ x: 0, y: 5 });
        expect(positions.get('b')).toMatchObject({ x: 30, y: 5 });
        expect(positions.get('c')).toMatchObject({ x: 70, y: 5 });
    });

    it('does not attempt distribution when fewer than three elements are selected', () => {
        const positions = distributeSelection([
            createElement('a', 0, 0, 10, 10),
            createElement('b', 30, 0, 10, 10)
        ], 'vertical');

        expect(positions.size).toBe(0);
    });
});
