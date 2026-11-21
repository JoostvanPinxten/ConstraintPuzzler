/**
 * The texts of the guide are in the engine's catalog (keys `guide.rules.<type>.*` and
 * `guide.technique.<id>.*`); these helpers find them. A list (rules, steps) is numbered from 1.
 */
import { CORE_RESOURCES, type MessageKey } from '../i18n/message';

/** The key when the catalog has it, else null (e.g. a technique without an example). */
export function guideKey(key: string): MessageKey | null {
  return Object.hasOwn(CORE_RESOURCES.en, key) ? (key as MessageKey) : null;
}

/** The key, which the catalog must have. */
export function requiredKey(key: string): MessageKey {
  const found = guideKey(key);
  if (found === null) throw new Error(`the guide has no text '${key}'`);
  return found;
}

/** The keys `<prefix>1`, `<prefix>2`, ... that the catalog has. */
export function numberedKeys(prefix: string): MessageKey[] {
  const keys: MessageKey[] = [];
  for (let n = 1; ; n++) {
    const key = guideKey(`${prefix}${n}`);
    if (key === null) return keys;
    keys.push(key);
  }
}
