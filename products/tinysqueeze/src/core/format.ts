export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  // Drop trailing .00, keep one decimal if non-zero
  if (size % 1 === 0) return `${size} ${units[unitIndex]}`;
  return `${size.toFixed(1).replace(/\.0$/, '')} ${units[unitIndex]}`;
}

export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return '0%';
  return `${Math.round(percent)}%`;
}

export function computeSavingsPercent(original: number, compressed: number): number {
  if (!original || original <= 0) return 0;
  const pct = (1 - compressed / original) * 100;
  return Math.max(0, Math.min(100, Math.round(pct * 100) / 100));
}