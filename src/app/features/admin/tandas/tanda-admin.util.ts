import {
  TandaParticipantDto,
  TandaPaymentDto,
  TandaPlaceAssignmentDto
} from '../../../core/models';

export function buildTandaSlots(
  participants: TandaParticipantDto[],
  totalWeeks: number
): Array<TandaParticipantDto | null> {
  const slots: Array<TandaParticipantDto | null> = Array.from(
    { length: Math.max(0, totalWeeks) },
    () => null
  );

  for (const participant of participants) {
    const index = participant.assignedTurn - 1;
    if (index >= 0 && index < slots.length) {
      slots[index] = participant;
    }
  }

  return slots;
}

export function buildPlaceAssignments(
  slots: Array<TandaParticipantDto | null>
): TandaPlaceAssignmentDto[] {
  return slots.flatMap((participant, index) => participant
    ? [{ participantId: participant.id, assignedTurn: index + 1 }]
    : []
  );
}

export function getVerifiedWeekPaidAmount(
  payments: TandaPaymentDto[] | undefined,
  week: number
): number {
  return (payments ?? [])
    .filter(payment => payment.weekNumber === week && payment.isVerified)
    .reduce((total, payment) => total + payment.amountPaid, 0);
}
