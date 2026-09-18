import { describe, expect, it } from 'vitest';
import { TandaParticipantDto, TandaPaymentDto } from '../../../core/models';
import {
  buildPlaceAssignments,
  buildTandaSlots,
  getVerifiedWeekPaidAmount
} from './tanda-admin.util';

function createParticipant(id: string, assignedTurn: number): TandaParticipantDto {
  return {
    id,
    tandaId: 'tanda-1',
    customerId: assignedTurn,
    assignedTurn,
    isDelivered: false,
    status: 'Active',
    expectedAmount: 1000,
    collectedAmount: 0,
    balanceDue: 1000,
    paidInstallments: 0,
    payments: []
  };
}

describe('utilidades administrativas de tandas', () => {
  it('conserva lugares vacíos al construir y guardar el orden', () => {
    const first = createParticipant('p1', 1);
    const third = createParticipant('p3', 3);

    const slots = buildTandaSlots([third, first], 4);
    const assignments = buildPlaceAssignments(slots);

    expect(slots).toEqual([first, null, third, null]);
    expect(assignments).toEqual([
      { participantId: 'p1', assignedTurn: 1 },
      { participantId: 'p3', assignedTurn: 3 }
    ]);
  });

  it('suma abonos parciales verificados de una misma semana', () => {
    const payments: TandaPaymentDto[] = [
      { id: '1', participantId: 'p1', weekNumber: 2, amountPaid: 60, penaltyPaid: 0, paymentDate: '', isVerified: true },
      { id: '2', participantId: 'p1', weekNumber: 2, amountPaid: 40, penaltyPaid: 0, paymentDate: '', isVerified: true },
      { id: '3', participantId: 'p1', weekNumber: 2, amountPaid: 50, penaltyPaid: 0, paymentDate: '', isVerified: false },
      { id: '4', participantId: 'p1', weekNumber: 3, amountPaid: 100, penaltyPaid: 0, paymentDate: '', isVerified: true }
    ];

    expect(getVerifiedWeekPaidAmount(payments, 2)).toBe(100);
  });
});
