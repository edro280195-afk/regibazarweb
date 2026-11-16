import { describe, expect, it } from 'vitest';
import type { OrderReminderDto } from '../../../core/models';
import {
  buildReminderRequest,
  DEFAULT_REMINDER_LEAD,
  draftFromReminder,
  draftPreview,
  emptyDraft,
  formatClock,
  formatDayLabel,
  MAX_REMINDER_NOTE,
  reminderState,
  reminderSummary,
  ReminderDraft
} from './order-reminder.util';

// Todas las fechas son locales, así que las pruebas no dependen de la zona horaria de quien las corra.
const NOW = new Date(2026, 10, 16, 15, 0, 0); // 16 nov 2026, 3:00 pm

const draft = (overrides: Partial<ReminderDraft> = {}): ReminderDraft => ({
  date: '2026-11-16',
  time: '16:00',
  leadMinutes: 30,
  note: '',
  ...overrides
});

const reminder = (overrides: Partial<OrderReminderDto> = {}): OrderReminderDto => ({
  id: 1,
  orderId: 10,
  targetAt: new Date(2026, 10, 16, 16, 0).toISOString(),
  leadMinutes: 30,
  remindAt: new Date(2026, 10, 16, 15, 30).toISOString(),
  note: null,
  sentAt: null,
  ...overrides
});

describe('campanita de pedido: borrador', () => {
  it('arranca hoy, sin hora y con 30 min de anticipación', () => {
    expect(emptyDraft(NOW)).toEqual({ date: '2026-11-16', time: '', leadMinutes: DEFAULT_REMINDER_LEAD, note: '' });
    expect(DEFAULT_REMINDER_LEAD).toBe(30);
  });

  it('reconstruye el borrador desde una campanita guardada', () => {
    const restored = draftFromReminder(reminder({ note: 'En su trabajo', leadMinutes: 15 }));
    expect(restored).toEqual({ date: '2026-11-16', time: '16:00', leadMinutes: 15, note: 'En su trabajo' });
  });
});

describe('campanita de pedido: validación y petición', () => {
  it('arma la petición con la hora en UTC y recorta la nota', () => {
    const built = buildReminderRequest(draft({ note: '  en su trabajo, otra dirección  ' }), NOW);
    expect(built.error).toBeUndefined();
    expect(built.request).toEqual({
      targetAt: new Date(2026, 10, 16, 16, 0).toISOString(),
      leadMinutes: 30,
      note: 'en su trabajo, otra dirección'
    });
    expect(built.soundsNow).toBe(false);
  });

  it('no manda nota cuando está vacía', () => {
    const built = buildReminderRequest(draft({ note: '   ' }), NOW);
    expect(built.request && 'note' in built.request).toBe(false);
  });

  it('pide hora y día antes de guardar', () => {
    expect(buildReminderRequest(draft({ time: '' }), NOW).error).toContain('hora');
    expect(buildReminderRequest(draft({ date: '' }), NOW).error).toContain('día');
  });

  it('rechaza una hora que ya pasó, pero tolera 1 minuto de desfase de reloj', () => {
    expect(buildReminderRequest(draft({ time: '14:00' }), NOW).error).toContain('ya pasó');
    expect(buildReminderRequest(draft({ time: '14:59', leadMinutes: 0 }), NOW).error).toBeUndefined();
  });

  it('rechaza una nota demasiado larga', () => {
    const tooLong = 'x'.repeat(MAX_REMINDER_NOTE + 1);
    expect(buildReminderRequest(draft({ note: tooLong }), NOW).error).toContain(String(MAX_REMINDER_NOTE));
  });

  it('avisa cuando el aviso ya debería haber sonado (sonará de inmediato)', () => {
    // La clienta pidió 3:30 pm y son las 3:00 pm: con 60 min de anticipación el aviso era a las 2:30 pm.
    const built = buildReminderRequest(draft({ time: '15:30', leadMinutes: 60 }), NOW);
    expect(built.error).toBeUndefined();
    expect(built.soundsNow).toBe(true);
  });

  it('en el borde exacto (aviso == ahora) también suena de inmediato, igual que el servidor', () => {
    // 4:00 pm - 60 min = 3:00 pm = NOW
    expect(buildReminderRequest(draft({ leadMinutes: 60 }), NOW).soundsNow).toBe(true);
    // un minuto antes del borde todavía no
    expect(buildReminderRequest(draft({ leadMinutes: 59 }), NOW).soundsNow).toBe(false);
  });
});

describe('campanita de pedido: estado', () => {
  it('pending mientras falta para el aviso', () => {
    expect(reminderState(reminder(), new Date(2026, 10, 16, 15, 0))).toBe('pending');
  });

  it('due cuando ya tocaba y aún no sale', () => {
    expect(reminderState(reminder(), new Date(2026, 10, 16, 15, 31))).toBe('due');
  });

  it('sent en cuanto el servidor la procesó, sin importar la hora', () => {
    const sent = reminder({ sentAt: new Date(2026, 10, 16, 15, 30).toISOString() });
    expect(reminderState(sent, new Date(2026, 10, 16, 12, 0))).toBe('sent');
    expect(reminderState(sent, new Date(2026, 10, 16, 18, 0))).toBe('sent');
  });
});

describe('campanita de pedido: textos', () => {
  it.each([
    [0, 0, '12:00 am'],
    [0, 5, '12:05 am'],
    [9, 30, '9:30 am'],
    [12, 0, '12:00 pm'],
    [16, 0, '4:00 pm'],
    [23, 59, '11:59 pm']
  ])('formatea %i:%i como %s', (hour, minute, expected) => {
    expect(formatClock(new Date(2026, 10, 16, hour, minute))).toBe(expected);
  });

  it('etiqueta el día respecto a hoy', () => {
    expect(formatDayLabel(new Date(2026, 10, 16, 23, 0), NOW)).toBe('hoy');
    expect(formatDayLabel(new Date(2026, 10, 17, 0, 5), NOW)).toBe('mañana');
    expect(formatDayLabel(new Date(2026, 10, 15, 9, 0), NOW)).toBe('ayer');
    expect(formatDayLabel(new Date(2026, 10, 20, 9, 0), NOW)).toBe('20/11');
  });

  it('resume la campanita con la hora de la clienta y la del aviso', () => {
    expect(reminderSummary(reminder(), NOW)).toBe('Hoy 4:00 pm · aviso 3:30 pm');
  });

  it('omite la hora del aviso cuando suena a la hora exacta', () => {
    const exact = reminder({ leadMinutes: 0, remindAt: reminder().targetAt });
    expect(reminderSummary(exact, NOW)).toBe('Hoy 4:00 pm');
  });

  it('describe cuándo sonará con el borrador', () => {
    expect(draftPreview(draft(), NOW)).toBe('Sonará hoy a las 3:30 pm.');
    expect(draftPreview(draft({ date: '2026-11-17', leadMinutes: 0 }), NOW)).toBe('Sonará mañana a las 4:00 pm.');
    expect(draftPreview(draft({ time: '15:30', leadMinutes: 60 }), NOW)).toBe('Sonará de inmediato al guardar.');
    expect(draftPreview(draft({ time: '' }), NOW)).toBe('');
  });
});
