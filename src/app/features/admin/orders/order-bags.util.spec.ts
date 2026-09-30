import { describe, expect, it } from 'vitest';
import {
  bagLabel,
  describeBagsOutcome,
  MAX_BAGS_PER_ORDER,
  missingPackageCount
} from './order-bags.util';

describe('utilidades de bolsas del pedido', () => {
  it('pluraliza las bolsas', () => {
    expect(bagLabel(1)).toBe('1 bolsa');
    expect(bagLabel(0)).toBe('0 bolsas');
    expect(bagLabel(3)).toBe('3 bolsas');
  });

  it('detecta las bolsas capturadas que aún no tienen QR', () => {
    expect(missingPackageCount({ packagesConfirmed: true, totalPackages: 3 }, 0)).toBe(3);
    expect(missingPackageCount({ packagesConfirmed: true, totalPackages: 3 }, 1)).toBe(2);
  });

  it('no marca faltantes cuando el número y las bolsas coinciden', () => {
    expect(missingPackageCount({ packagesConfirmed: true, totalPackages: 3 }, 3)).toBe(0);
    expect(missingPackageCount({ packagesConfirmed: true, totalPackages: 0 }, 0)).toBe(0);
  });

  it('nunca devuelve faltantes negativos si hay más bolsas que el número', () => {
    expect(missingPackageCount({ packagesConfirmed: true, totalPackages: 1 }, 4)).toBe(0);
  });

  it('ignora pedidos con bolsas pendientes o sin pedido seleccionado', () => {
    expect(missingPackageCount({ packagesConfirmed: false, totalPackages: 3 }, 0)).toBe(0);
    expect(missingPackageCount({ totalPackages: 3 }, 0)).toBe(0);
    expect(missingPackageCount(null, 0)).toBe(0);
    expect(missingPackageCount(undefined, 0)).toBe(0);
  });

  it('no dice nada de bolsas cuando la dueña eligió "No sé"', () => {
    expect(describeBagsOutcome(null, undefined)).toBeNull();
    expect(describeBagsOutcome(null, 2)).toBeNull();
  });

  it('avisa que las bolsas ya tienen QR listas para imprimir', () => {
    expect(describeBagsOutcome(3, 3)).toBe('🛍️ 3 bolsas con QR listas para imprimir');
    expect(describeBagsOutcome(1, 1)).toBe('🛍️ 1 bolsa con QR listas para imprimir');
  });

  it('avisa cuando el pedido va sin bolsas', () => {
    expect(describeBagsOutcome(0, 0)).toBe('va sin bolsas');
    expect(describeBagsOutcome(0, null)).toBe('va sin bolsas');
  });

  it('avisa cuando se respetaron bolsas que ya existían', () => {
    expect(describeBagsOutcome(1, 2)).toBe('ya tenía 2 bolsas con QR; se respetaron');
    expect(describeBagsOutcome(0, 3)).toBe('ya tenía 3 bolsas con QR; se respetaron');
  });

  it('mantiene el mismo tope que el backend', () => {
    expect(MAX_BAGS_PER_ORDER).toBe(50);
  });
});
