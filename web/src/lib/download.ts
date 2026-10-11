import { zipSync } from 'fflate';

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}

/** Stores already-compressed files (PNGs) in a zip without recompressing. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, [Uint8Array, { level: 0 }]> = {};
  for (const file of files) {
    entries[file.name] = [new Uint8Array(await file.blob.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(entries)], { type: 'application/zip' });
}
