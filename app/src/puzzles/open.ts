// Opening puzzles: the bundled examples, or a file the user picks.
import {
  PUZZLE_TYPES,
  PuzzleFileError,
  type PuzzleType,
  type PuzzleTypeName,
} from '@constraintpuzzler/core';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { i18n } from '../i18n';
import { PuzzleSession } from '../logic/session';
import { EXAMPLES } from './examples.generated';

export function exampleText(file: string): string {
  const text = EXAMPLES[file];
  if (text === undefined) throw new Error(`example ${file} is not bundled`);
  return text;
}

/** A session for one of the bundled examples (the type's default example without a label). */
export function openExample(typeName: PuzzleTypeName, label?: string): PuzzleSession {
  const type = PUZZLE_TYPES[typeName];
  const example = label ?? type.defaultExample;
  const file = type.examples[example];
  if (file === undefined) throw new Error(`${type.label} has no example ${example}`);
  return new PuzzleSession(type, exampleText(file), `${type.label}: ${example}`, file);
}

/** A session for puzzle file contents; throws PuzzleFileError (or another Error) if unreadable. */
export function openText(type: PuzzleType, text: string, filename: string): PuzzleSession {
  return new PuzzleSession(type, text, `${type.label}: ${filename}`, filename);
}

/** Let the user pick a puzzle file of a type. Resolves to null when they cancel. */
export async function pickPuzzleFile(type: PuzzleType): Promise<PuzzleSession | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web' ? type.fileExtensions.map((e) => `.${e}`).join(',') : '*/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset === undefined) return null;
  const text =
    asset.file !== undefined ? await asset.file.text() : await new File(asset.uri).text();
  return openText(type, text, asset.name);
}

/** A message for an error from opening a file. */
export function openErrorMessage(error: unknown): string {
  if (error instanceof PuzzleFileError) return error.message;
  return i18n.t('start.openError', {
    error: error instanceof Error ? error.message : String(error),
  });
}
