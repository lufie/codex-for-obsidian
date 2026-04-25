import * as path from 'path';

const INLINE_REFERENCE_TOKEN_REGEX = /\[\[ref:([^[\]]+)\]\]/g;

function trimTrailingSeparators(inputPath: string): string {
  if (!inputPath || inputPath === '/' || /^[A-Za-z]:[\\/]?$/.test(inputPath)) {
    return inputPath;
  }
  return inputPath.replace(/[\\/]+$/g, '');
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeXmlBody(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface InlineReferenceToken {
  raw: string;
  path: string;
  label: string;
  start: number;
  end: number;
}

export function getInlineReferenceLabel(referencePath: string): string {
  const cleaned = trimTrailingSeparators(referencePath);
  const posixLabel = path.posix.basename(cleaned);
  const winLabel = path.win32.basename(cleaned);
  const label = (posixLabel.length <= winLabel.length ? winLabel : posixLabel) || cleaned;
  return label || referencePath;
}

export function encodeInlineReferenceToken(referencePath: string): string {
  return `[[ref:${encodeURIComponent(referencePath)}]]`;
}

export function decodeInlineReferenceToken(tokenValue: string): string {
  try {
    return decodeURIComponent(tokenValue);
  } catch {
    return tokenValue;
  }
}

export function extractInlineReferenceTokens(text: string): InlineReferenceToken[] {
  const references: InlineReferenceToken[] = [];

  for (const match of text.matchAll(INLINE_REFERENCE_TOKEN_REGEX)) {
    const encodedPath = match[1];
    const resolvedPath = decodeInlineReferenceToken(encodedPath);
    const raw = match[0];
    const start = match.index ?? 0;

    references.push({
      raw,
      path: resolvedPath,
      label: getInlineReferenceLabel(resolvedPath),
      start,
      end: start + raw.length,
    });
  }

  return references;
}

export function stripInlineReferenceTokens(text: string): string {
  return text.replace(INLINE_REFERENCE_TOKEN_REGEX, '');
}

export function formatInlineReferencesForDisplay(text: string): string {
  return text.replace(INLINE_REFERENCE_TOKEN_REGEX, (_, encodedPath: string) => {
    const resolvedPath = decodeInlineReferenceToken(encodedPath);
    const label = getInlineReferenceLabel(resolvedPath);
    return `[${label}]`;
  });
}

export function expandInlineReferencesToXml(text: string): string {
  return text.replace(INLINE_REFERENCE_TOKEN_REGEX, (_, encodedPath: string) => {
    const resolvedPath = decodeInlineReferenceToken(encodedPath);
    const label = getInlineReferenceLabel(resolvedPath);
    return `<external_reference path="${escapeXmlAttribute(resolvedPath)}">${escapeXmlBody(label)}</external_reference>`;
  });
}

export function extractOrderedInlineReferencePaths(text: string): string[] {
  return extractInlineReferenceTokens(text).map(reference => reference.path);
}
