import type { OrderReminderDto, SaveOrderReminderRequest } from '../../../core/models';

/**
 * Utilidades de la "campanita" de un pedido (recordatorio privado de la dueña).
 * Funciones puras y sin reloj propio (siempre reciben `now`) para poder probarlas.
 */

export const REMINDER_LEAD_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: 'A la hora exacta' },
  { value: 15, label: '15 min antes' },
  { value: 30, label: '30 min antes' },
  { value: 60, label: '1 hora antes' }
];

export const DEFAULT_REMINDER_LEAD = 30;
export const MAX_REMINDER_NOTE = 500;

/** Tolerancia con el servidor: mismo margen que valida el API (2 min). */
const PAST_TOLERANCE_MS = 2 * 60_000;

export interface ReminderDraft {
  /** yyyy-MM-dd (hora local) */
  date: string;
  /** HH:mm (hora local); vacío = aún sin elegir */
  time: string;
  leadMinutes: number;
  note: string;
}

export type ReminderState = 'pending' | 'due' | 'sent';

const pad = (n: number): string => String(n).padStart(2, '0');

export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Borrador nuevo: hoy, sin hora (la dueña la teclea), con la anticipación por defecto. */
export function emptyDraft(now: Date): ReminderDraft {
  return { date: toDateInputValue(now), time: '', leadMinutes: DEFAULT_REMINDER_LEAD, note: '' };
}

export function draftFromReminder(reminder: OrderReminderDto): ReminderDraft {
  const target = new Date(reminder.targetAt);
  return {
    date: toDateInputValue(target),
    time: toTimeInputValue(target),
    leadMinutes: reminder.leadMinutes,
    note: reminder.note ?? ''
  };
}

/** Fecha/hora local que representa el borrador, o null si falta algo o es inválido. */
export function draftTarget(draft: ReminderDraft): Date | null {
  if (!draft.date || !draft.time) return null;
  const target = new Date(`${draft.date}T${draft.time}`);
  return Number.isNaN(target.getTime()) ? null : target;
}

/** Cuándo sonaría el aviso con este borrador, o null si aún no hay hora válida. */
export function draftRemindAt(draft: ReminderDraft): Date | null {
  const target = draftTarget(draft);
  return target ? new Date(target.getTime() - draft.leadMinutes * 60_000) : null;
}

export interface BuiltReminderRequest {
  request?: SaveOrderReminderRequest;
  /** Mensaje para mostrar a la dueña cuando el borrador no se puede guardar. */
  error?: string;
  /** El aviso ya debería haber sonado: saldrá de inmediato al guardar. */
  soundsNow?: boolean;
}

/** Valida el borrador (mismas reglas que el API) y arma la petición. */
export function buildReminderRequest(draft: ReminderDraft, now: Date): BuiltReminderRequest {
  if (!draft.date) return { error: 'Elige el día que pidió la clienta.' };
  if (!draft.time) return { error: 'Pon la hora que pidió la clienta.' };

  const target = draftTarget(draft);
  if (!target) return { error: 'La fecha u hora no es válida.' };

  if (target.getTime() < now.getTime() - PAST_TOLERANCE_MS) {
    return { error: 'Esa hora ya pasó. Elige una hora futura.' };
  }

  const note = draft.note.trim();
  if (note.length > MAX_REMINDER_NOTE) {
    return { error: `La nota no puede pasar de ${MAX_REMINDER_NOTE} caracteres.` };
  }

  const remindAt = new Date(target.getTime() - draft.leadMinutes * 60_000);
  return {
    request: {
      targetAt: target.toISOString(),
      leadMinutes: draft.leadMinutes,
      ...(note ? { note } : {})
    },
    soundsNow: remindAt.getTime() <= now.getTime()
  };
}

/**
 * pending = aún falta para que suene · due = ya tocaba y todavía no sale (ej. el servidor
 * aún no la procesa o ningún dispositivo la recibió) · sent = ya sonó.
 */
export function reminderState(reminder: OrderReminderDto, now: Date): ReminderState {
  if (reminder.sentAt) return 'sent';
  return new Date(reminder.remindAt).getTime() <= now.getTime() ? 'due' : 'pending';
}

/** "4:05 pm" en reloj de 12 horas. */
export function formatClock(date: Date): string {
  const hour12 = date.getHours() % 12 === 0 ? 12 : date.getHours() % 12;
  return `${hour12}:${pad(date.getMinutes())} ${date.getHours() < 12 ? 'am' : 'pm'}`;
}

/** "hoy", "mañana", "ayer" o "dd/MM", comparando días calendario locales. */
export function formatDayLabel(date: Date, now: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'mañana';
  if (days === -1) return 'ayer';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** Texto corto de la campanita, ej. "Hoy 4:00 pm · aviso 3:30 pm". */
export function reminderSummary(reminder: OrderReminderDto, now: Date): string {
  const target = new Date(reminder.targetAt);
  const day = formatDayLabel(target, now);
  const head = `${day.charAt(0).toUpperCase()}${day.slice(1)} ${formatClock(target)}`;
  if (reminder.leadMinutes === 0) return head;
  return `${head} · aviso ${formatClock(new Date(reminder.remindAt))}`;
}

/** Texto de vista previa del editor, ej. "Sonará hoy a las 3:30 pm". */
export function draftPreview(draft: ReminderDraft, now: Date): string {
  const remindAt = draftRemindAt(draft);
  if (!remindAt) return '';
  if (remindAt.getTime() <= now.getTime()) return 'Sonará de inmediato al guardar.';
  return `Sonará ${formatDayLabel(remindAt, now)} a las ${formatClock(remindAt)}.`;
}
