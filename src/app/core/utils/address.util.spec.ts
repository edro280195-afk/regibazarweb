import { describe, expect, it } from 'vitest';
import { getEffectiveDeliveryAddress, normalizeOptionalAddress } from './address.util';

describe('address utilities', () => {
    it('normalizes blank addresses as missing values', () => {
        expect(normalizeOptionalAddress('   ')).toBeUndefined();
        expect(normalizeOptionalAddress(' Calle Peru 123 ')).toBe('Calle Peru 123');
    });

    it('uses the client address when the alternative address is blank', () => {
        expect(getEffectiveDeliveryAddress('Calle Mina 45', '')).toBe('Calle Mina 45');
        expect(getEffectiveDeliveryAddress('Calle Mina 45', '   ')).toBe('Calle Mina 45');
    });

    it('prefers a non-empty alternative address for the current order', () => {
        expect(getEffectiveDeliveryAddress('Casa', 'Oficina')).toBe('Oficina');
    });
});
