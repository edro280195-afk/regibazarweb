/** Tope de bolsas por pedido. El backend lo valida igual (OrderPackagePolicy.MaxPackagesPerOrder). */
export const MAX_BAGS_PER_ORDER = 50;

export function bagLabel(count: number): string {
  return `${count} bolsa${count === 1 ? '' : 's'}`;
}

/**
 * Bolsas que el pedido declara pero todavía no tienen su QR generado. Solo pasa con pedidos
 * capturados antes de que el número creara las bolsas reales (o si alguien borró bolsas a mano).
 */
export function missingPackageCount(
  order: { packagesConfirmed?: boolean; totalPackages?: number | null } | null | undefined,
  generated: number
): number {
  if (!order?.packagesConfirmed) return 0;
  return Math.max(0, (order.totalPackages ?? 0) - generated);
}

/**
 * Cierre del aviso de "pedido creado" sobre las bolsas. `requested` es lo que eligió la dueña
 * (null = "No sé todavía") y `actual` el total real que devolvió el backend.
 */
export function describeBagsOutcome(
  requested: number | null,
  actual: number | null | undefined
): string | null {
  if (requested === null) return null;
  const total = actual ?? 0;
  if (total > requested) return `ya tenía ${bagLabel(total)} con QR; se respetaron`;
  if (requested === 0) return 'va sin bolsas';
  return `🛍️ ${bagLabel(total)} con QR listas para imprimir`;
}
