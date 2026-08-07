export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  extra?: string;
}

type LogListener = (logs: LogEntry[]) => void;

class LogServiceClass {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  private serializeExtra(extra: any): string {
    if (!extra) return '';
    try {
      const seen = new WeakSet();
      return JSON.stringify(
        extra,
        (key, value) => {
          if (value instanceof Error) {
            return {
              ...value,
              name: value.name,
              message: value.message,
              stack: value.stack,
            };
          }
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
              return '[Circular]';
            }
            seen.add(value);
          }
          return value;
        },
        2
      );
    } catch (e) {
      return `[Error al serializar detalles: ${e instanceof Error ? e.message : String(e)}]`;
    }
  }

  private addLog(level: 'info' | 'warn' | 'error', message: string, extra?: any) {
    const timestamp = new Date().toISOString();
    const extraStr = extra ? this.serializeExtra(extra) : '';
    const entry: LogEntry = { timestamp, level, message, extra: extraStr };
    this.logs.unshift(entry); // Nuevos primero
    if (this.logs.length > 200) {
      this.logs.pop();
    }
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  info(message: string, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] [${timestamp}] ${message}`, ...optionalParams);
    this.addLog('info', message, optionalParams.length ? optionalParams : undefined);
  }

  warn(message: string, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] [${timestamp}] ${message}`, ...optionalParams);
    this.addLog('warn', message, optionalParams.length ? optionalParams : undefined);
  }

  error(message: string, error?: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] [${timestamp}] ${message}`, error, ...optionalParams);
    this.addLog('error', message, { error, ...optionalParams });
  }

  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => listener([]));
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

const LogService = new LogServiceClass();
export default LogService;
