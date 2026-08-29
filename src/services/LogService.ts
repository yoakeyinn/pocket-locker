/**
 * Entrada individual en el registro de depuración y auditoría.
 */
export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  extra?: string;
}

/**
 * Tipo de función observadora para suscripción reactiva a las actualizaciones de log.
 */
type LogListener = (logs: LogEntry[]) => void;

/**
 * Servicio centralizado de registro (Logging) y diagnóstico de la aplicación.
 * Proporciona:
 * - Registro en memoria con límite circular de 200 entradas para no saturar la RAM.
 * - Serialización segura de objetos y excepciones evitando referencias circulares.
 * - Patrón observador (Pub/Sub) para actualizar en tiempo real la pantalla de diagnóstico.
 */
class LogServiceClass {
  private logs: LogEntry[] = [];
  private listeners: Set<LogListener> = new Set();

  /**
   * Serializa datos adicionales u objetos de error de forma segura.
   */
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

  /**
   * Inserta un nuevo log en el buffer circular y notifica a los suscriptores.
   */
  private addLog(level: 'info' | 'warn' | 'error', message: string, extra?: any) {
    const timestamp = new Date().toISOString();
    const extraStr = extra ? this.serializeExtra(extra) : '';
    const entry: LogEntry = { timestamp, level, message, extra: extraStr };
    this.logs.unshift(entry); // Los más recientes al inicio

    // Límite de 200 elementos para controlar memoria
    if (this.logs.length > 200) {
      this.logs.pop();
    }
    this.listeners.forEach((listener) => listener([...this.logs]));
  }

  /**
   * Registra un mensaje informativo de operación normal.
   */
  info(message: string, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[INFO] [${timestamp}] ${message}`, ...optionalParams);
    this.addLog('info', message, optionalParams.length ? optionalParams : undefined);
  }

  /**
   * Registra un mensaje de advertencia.
   */
  warn(message: string, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.warn(`[WARN] [${timestamp}] ${message}`, ...optionalParams);
    this.addLog('warn', message, optionalParams.length ? optionalParams : undefined);
  }

  /**
   * Registra un mensaje de error con su traza o excepción.
   */
  error(message: string, error?: any, ...optionalParams: any[]) {
    const timestamp = new Date().toISOString();
    console.error(`[ERROR] [${timestamp}] ${message}`, error, ...optionalParams);
    this.addLog('error', message, { error, ...optionalParams });
  }

  /**
   * Obtiene una copia inmutable del historial actual de logs.
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Vacía el historial de logs en memoria.
   */
  clearLogs() {
    this.logs = [];
    this.listeners.forEach((listener) => listener([]));
  }

  /**
   * Suscribe un componente u observador para recibir actualizaciones en tiempo real.
   */
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
