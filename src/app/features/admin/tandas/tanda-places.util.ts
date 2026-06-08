import { ClientDto } from '../../../core/models';

export interface TandaPlaceDraft {
  assignedTurn: number;
  client: ClientDto | null;
  variant: string;
  weeklyAmount?: number;
}

export function resizeTandaPlaces(
  currentPlaces: TandaPlaceDraft[],
  totalWeeks: number
): TandaPlaceDraft[] {
  const safeTotal = Math.max(1, Math.trunc(totalWeeks || 1));

  return Array.from({ length: safeTotal }, (_, index) => {
    const assignedTurn = index + 1;
    const current = currentPlaces.find(place => place.assignedTurn === assignedTurn);

    return current
      ? { ...current, assignedTurn }
      : { assignedTurn, client: null, variant: '' };
  });
}

export function assignClientToPlace(
  currentPlaces: TandaPlaceDraft[],
  assignedTurn: number,
  client: ClientDto | null
): TandaPlaceDraft[] {
  return currentPlaces.map(place =>
    place.assignedTurn === assignedTurn ? { ...place, client } : place
  );
}

export function swapTandaPlaces(
  currentPlaces: TandaPlaceDraft[],
  assignedTurn: number,
  direction: -1 | 1
): TandaPlaceDraft[] {
  const targetTurn = assignedTurn + direction;
  const source = currentPlaces.find(place => place.assignedTurn === assignedTurn);
  const target = currentPlaces.find(place => place.assignedTurn === targetTurn);

  if (!source || !target) {
    return currentPlaces;
  }

  return currentPlaces.map(place => {
    if (place.assignedTurn === assignedTurn) {
      return { ...target, assignedTurn };
    }

    if (place.assignedTurn === targetTurn) {
      return { ...source, assignedTurn: targetTurn };
    }

    return place;
  });
}

export function areTandaPlacesComplete(
  places: TandaPlaceDraft[],
  totalWeeks: number
): boolean {
  return places.length === totalWeeks
    && places.every((place, index) =>
      place.assignedTurn === index + 1 && place.client !== null
    );
}
