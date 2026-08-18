// Shared browser-download helper (Blob + a throwaway <a download> click) —
// the actual file-save mechanics behind every "export" button in the app
// (Arsenal's JSON library export, the Trajectory table's CSV export, both
// charts' SVG export). Framework-free and DOM-minimal on purpose: this is
// the one place that needs to know how a browser download is triggered at
// all.
export function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
