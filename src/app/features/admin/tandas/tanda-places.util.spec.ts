import { describe, expect, it } from 'vitest';
import { ClientDto } from '../../../core/models';
import {
  areTandaPlacesComplete,
  assignClientToPlace,
  resizeTandaPlaces,
  swapTandaPlaces
} from './tanda-places.util';

const ana: ClientDto = {
  id: 1,
  name: 'Ana',
  tag: 'Regular',
  ordersCount: 0,
  totalSpent: 0
};

const rosa: ClientDto = {
  id: 2,
  name: 'Rosa',
  tag: 'Regular',
  ordersCount: 0,
  totalSpent: 0
};

describe('tanda places', () => {
  it('crea todos los lugares y conserva las asignaciones existentes', () => {
    const initial = assignClientToPlace(resizeTandaPlaces([], 2), 1, ana);
    const resized = resizeTandaPlaces(initial, 4);

    expect(resized.map(place => place.assignedTurn)).toEqual([1, 2, 3, 4]);
    expect(resized[0].client?.id).toBe(ana.id);
    expect(resized[3].client).toBeNull();
  });

  it('intercambia ocupantes sin cambiar los números de lugar', () => {
    let places = resizeTandaPlaces([], 2);
    places = assignClientToPlace(places, 1, ana);
    places = assignClientToPlace(places, 2, rosa);

    const swapped = swapTandaPlaces(places, 2, -1);

    expect(swapped.map(place => place.assignedTurn)).toEqual([1, 2]);
    expect(swapped[0].client?.id).toBe(rosa.id);
    expect(swapped[1].client?.id).toBe(ana.id);
  });

  it('solo considera completa la tanda cuando todos los lugares tienen clienta', () => {
    let places = resizeTandaPlaces([], 2);
    places = assignClientToPlace(places, 1, ana);

    expect(areTandaPlacesComplete(places, 2)).toBe(false);

    places = assignClientToPlace(places, 2, ana);
    expect(areTandaPlacesComplete(places, 2)).toBe(true);
  });
});
