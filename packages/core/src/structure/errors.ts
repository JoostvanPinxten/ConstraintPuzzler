import { formatMessage, plainText, type Message } from '../i18n/message';

/**
 * An error for the player: its `message` is in English, its `text` a message that the app
 * shows in the player's language. A string is a text that is not translated.
 */
export class MessageError extends Error {
  readonly text: Message;

  constructor(text: string | Message) {
    const message = typeof text === 'string' ? plainText(text) : text;
    super(formatMessage(message));
    this.text = message;
    this.name = 'MessageError';
  }
}

/** The message of any error: its `text` for a MessageError, else its English message. */
export function errorText(error: unknown): Message {
  if (error instanceof MessageError) return error.text;
  return plainText(error instanceof Error ? error.message : String(error));
}

/**
 * Thrown when the puzzle state is inconsistent, e.g. a cell has no options left or a value
 * is removed from a cell where it has already been set.
 */
export class ContradictionError extends MessageError {
  constructor(text: string | Message) {
    super(text);
    this.name = 'ContradictionError';
  }
}
