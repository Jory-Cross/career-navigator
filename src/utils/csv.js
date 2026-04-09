export function toCSV(rows, headers) {
  const h = headers || Object.keys(rows?.[0] || {});
  const esc = (v) => '"' + String(v ?? '').replaceAll('"', '""') + '"';
  const lines = [h.join(',')];
  for (const r of rows || []) lines.push(h.map(k => esc(r[k])).join(','));
  return lines.join('\n');
}
