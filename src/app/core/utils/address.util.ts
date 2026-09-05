export function normalizeOptionalAddress(address: string | null | undefined): string | undefined {
    const normalized = address?.trim();
    return normalized ? normalized : undefined;
}

export function getEffectiveDeliveryAddress(
    clientAddress: string | null | undefined,
    alternativeAddress: string | null | undefined
): string | undefined {
    return normalizeOptionalAddress(alternativeAddress) ?? normalizeOptionalAddress(clientAddress);
}
