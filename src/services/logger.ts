import { EventEmitter } from 'events';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error' | 'scanner' | 'dm';
  message: string;
}

class LoggerService extends EventEmitter {
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;

  constructor() {
    super();
    this.log('info', 'Système DJEY Vinted initialisé. En attente de démarrage...');
  }

  public log(level: LogEntry['level'], message: string): LogEntry {
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      level,
      message,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    console.log(`[${entry.timestamp}] [${level.toUpperCase()}] ${message}`);
    this.emit('new_log', entry);
    return entry;
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public clear() {
    this.logs = [];
    this.log('info', 'Console de logs réinitialisée.');
  }
}

export const logger = new LoggerService();
