/**
 * Plain-text diagnostic log for the image-import pipeline.
 *
 * Each step (request setup, API call, response parsing, schema validation,
 * final counts) appends an entry. On failure the caller downloads the full
 * log as a .txt file the user can share for triage.
 */

export type ImportLogLevel = 'info' | 'warn' | 'error';

export type ImportLogEntry = {
  ts: string;
  level: ImportLogLevel;
  message: string;
};

export class ImportLog {
  private entries: ImportLogEntry[] = [];

  log(level: ImportLogLevel, message: string): void {
    this.entries.push({
      ts: new Date().toISOString(),
      level,
      message,
    });
  }

  info(message: string): void {
    this.log('info', message);
  }

  warn(message: string): void {
    this.log('warn', message);
  }

  error(message: string): void {
    this.log('error', message);
  }

  serialize(): string {
    const header = [
      '# Image Import Diagnostic Log',
      `# Generated: ${new Date().toISOString()}`,
      `# Entries: ${this.entries.length}`,
      '',
    ].join('\n');
    const body = this.entries
      .map((e) => `[${e.ts}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
    return `${header}${body}\n`;
  }

  /** Trigger a browser download of the log as `<filename>.txt`. */
  download(filename: string): void {
    const text = this.serialize();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

/** Mask all but the last 4 characters of a secret for safe inclusion in logs. */
export function maskSecret(secret: string): string {
  if (!secret) return '(empty)';
  if (secret.length <= 8) return '***';
  return `${secret.slice(0, 7)}…${secret.slice(-4)} (length=${secret.length})`;
}
