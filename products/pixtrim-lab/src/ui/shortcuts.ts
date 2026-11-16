export function registerShortcuts(onExportZip: () => void): void {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      onExportZip();
    }
  });
}
