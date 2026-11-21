/**
 * The messages a session shows (notices, hints, solver steps, input errors) as data: a key of the
 * app's catalog with parameters, formatted only when shown. So a message that is on screen
 * follows the language when it changes, and the session itself has no texts.
 */
import { isMessage, type Deduction, type Message } from '@constraintpuzzler/core';

import { formatCore, i18n, type AppKey } from '../i18n';

/** A parameter: text and numbers as they are, or a message (of the app or the engine). */
export type UiParam = string | number | UiMessage | Message;

export interface UiMessage {
  readonly text: AppKey;
  readonly params?: Readonly<Record<string, UiParam>>;
}

export function ui(text: AppKey, params?: Readonly<Record<string, UiParam>>): UiMessage {
  return params === undefined ? { text } : { text, params };
}

/** A text that is already formatted, e.g. an error message from elsewhere. */
export function plain(text: string): UiMessage {
  return ui('message.plain', { text });
}

function isUiMessage(value: unknown): value is UiMessage {
  return typeof value === 'object' && value !== null && 'text' in value;
}

type AppT = (key: string, options: object) => string;

/** The message in the current language. */
export function formatUi(message: UiMessage): string {
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(message.params ?? {})) {
    params[name] =
      typeof value === 'string' || typeof value === 'number'
        ? value
        : isUiMessage(value)
          ? formatUi(value)
          : isMessage(value)
            ? formatCore(value)
            : String(value);
  }
  const t = i18n.t.bind(i18n) as unknown as AppT;
  return t(message.text, {
    replace: params,
    ...(typeof params['count'] === 'number' ? { count: params['count'] } : {}),
  });
}

/** A message for the user, shown as a dialog; with `confirm`, the dialog offers an action. */
export interface Notice {
  readonly title: UiMessage;
  readonly text: UiMessage;
  readonly confirm?: { readonly label: UiMessage; readonly action: () => void };
}

export const BUSY = ui('session.busy');

/** The notice for a contradiction the solver ran into. */
export function contradictionNotice(error: Error): Notice {
  return {
    title: ui('notice.contradictionTitle'),
    text: ui('notice.contradiction', { error: error.message }),
  };
}

/**
 * What a step that only removed candidates did: the first reason, and how many candidates
 * went, e.g. after an X-Wing.
 */
export function narrowingMessage(deductions: readonly Deduction[]): UiMessage {
  const count = deductions.reduce((n, d) => n + d.removed.size, 0);
  const reasons = [...new Set(deductions.map((d) => d.reason()))];
  const reason = reasons[0] ?? '';
  return reasons.length > 1
    ? ui('step.narrowingMore', { count, reason, more: reasons.length - 1 })
    : ui('step.narrowing', { count, reason });
}
