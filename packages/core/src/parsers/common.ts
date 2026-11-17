/** Building blocks shared by the puzzle file parsers. */
import { Position } from '../structure/position';

const POSITION_PATTERN = /^\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;
const INDEX_PATTERN = /^\(\s*(-?\d+)\s*\)$/;
const INTEGER_PATTERN = /^[+-]?\d+$/;

/** A puzzle file could not be parsed; the message names the file and line. */
export class PuzzleFileError extends Error {
  constructor(
    readonly filename: string,
    readonly lineNumber: number,
    message: string,
  ) {
    super(`${filename}, line ${lineNumber}: ${message}`);
    this.name = 'PuzzleFileError';
  }
}

/** Splits file contents into lines (any line ending). */
export function splitLines(text: string): string[] {
  return text.split(/\r\n|\r|\n/);
}

/** Parses a whole number (whitespace around it allowed), like Python's int(), or throws. */
export function parseInteger(text: string): number {
  const trimmed = text.trim();
  if (!INTEGER_PATTERN.test(trimmed)) throw new Error(`expected a whole number, got '${trimmed}'`);
  return Number.parseInt(trimmed, 10);
}

/** Parses '(x,y)' (whitespace allowed) into a Position, or throws. */
export function parsePosition(text: string): Position {
  const match = POSITION_PATTERN.exec(text.trim());
  if (match === null) throw new Error(`expected a cell like (x,y), got '${text.trim()}'`);
  return new Position(Number(match[1]), Number(match[2]));
}

/** Parses '(x,y);(x,y);...' (whitespace allowed) into a list of Positions, or throws. */
export function parsePositionList(text: string): Position[] {
  return text.split(';').map(parsePosition);
}

/** Parses '(n)' (whitespace allowed) into a number, or throws. */
export function parseIndex(text: string): number {
  const match = INDEX_PATTERN.exec(text.trim());
  if (match === null) throw new Error(`expected a number like (n), got '${text.trim()}'`);
  return Number(match[1]);
}

/** Parses 'min,max' into the inclusive range of values, or throws. */
export function parseRange(text: string): number[] {
  const parts = text.split(',');
  if (parts.length !== 2) throw new Error(`expected a range like 1,9, got '${text.trim()}'`);
  const [minimum, maximum] = parts.map(parseInteger) as [number, number];
  if (minimum > maximum) throw new Error(`range ${minimum},${maximum} is empty`);
  return Array.from({ length: maximum - minimum + 1 }, (_, i) => minimum + i);
}

/** Python's // (floor division). */
export function floorDiv(a: number, b: number): number {
  return Math.floor(a / b);
}

/** Python's % (the result has the sign of the divisor). */
export function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}
