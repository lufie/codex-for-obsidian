function escapeXmlBody(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function formatExternalReferences(paths: string[]): string {
  const normalizedPaths = paths
    .map(path => path.trim())
    .filter(path => path.length > 0);

  if (normalizedPaths.length === 0) {
    return '';
  }

  const lines = normalizedPaths.map((path, index) => `${index + 1}. ${escapeXmlBody(path)}`);
  return `<external_references>\n${lines.join('\n')}\n</external_references>`;
}

export function appendExternalReferences(prompt: string, paths: string[]): string {
  const formatted = formatExternalReferences(paths);
  return formatted ? `${prompt}\n\n${formatted}` : prompt;
}
