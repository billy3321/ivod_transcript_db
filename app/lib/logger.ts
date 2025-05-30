/**
 * Logging utility for the IVOD transcript web application
 * Provides structured logging for API errors, database issues, and user interactions
 */

import { NextApiRequest } from 'next';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: {
    // Request information
    method?: string;
    url?: string;
    userAgent?: string;
    ip?: string;
    
    // Error details
    error?: string;
    stack?: string;
    
    // Application context
    component?: string;
    action?: string;
    userId?: string;
    sessionId?: string;
    
    // Additional metadata
    metadata?: Record<string, any>;
  };
}

export interface LoggerOptions {
  logToFile?: boolean;
  logToConsole?: boolean;
  logLevel?: LogLevel;
  logDirectory?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

class Logger {
  private options: Required<LoggerOptions>;
  private logLevels: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  };

  constructor(options: LoggerOptions = {}) {
    this.options = {
      logToFile: options.logToFile ?? true,
      logToConsole: options.logToConsole ?? (process.env.NODE_ENV === 'development'),
      logLevel: (options.logLevel as LogLevel) ?? 'info',
      logDirectory: options.logDirectory ?? process.env.LOG_PATH ?? 'logs',
      maxFileSize: options.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles ?? 5,
    };

    // Ensure log directory exists
    if (this.options.logToFile) {
      this.ensureLogDirectory();
    }
  }

  private ensureLogDirectory(): void {
    try {
      const fs = require('fs');
      if (!fs.existsSync(this.options.logDirectory)) {
        fs.mkdirSync(this.options.logDirectory, { recursive: true });
      }
    } catch (error) {
      console.error('Failed to create log directory:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] <= this.logLevels[this.options.logLevel];
  }

  private formatLogEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    const baseLog = `${timestamp} [${level.toUpperCase()}] ${message}`;
    
    if (!context) return baseLog;

    const contextParts: string[] = [];
    
    if (context.method && context.url) {
      contextParts.push(`${context.method} ${context.url}`);
    }
    
    if (context.component) {
      contextParts.push(`component=${context.component}`);
    }
    
    if (context.action) {
      contextParts.push(`action=${context.action}`);
    }
    
    if (context.ip) {
      contextParts.push(`ip=${context.ip}`);
    }
    
    if (context.userId) {
      contextParts.push(`userId=${context.userId}`);
    }

    const contextStr = contextParts.length > 0 ? ` [${contextParts.join(', ')}]` : '';
    
    let result = baseLog + contextStr;
    
    if (context.error) {
      result += `\nError: ${context.error}`;
    }
    
    if (context.stack) {
      result += `\nStack: ${context.stack}`;
    }
    
    if (context.metadata) {
      result += `\nMetadata: ${JSON.stringify(context.metadata, null, 2)}`;
    }
    
    return result;
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.options.logToFile) return;

    try {
      const path = require('path');
      const logFileName = `app_${new Date().toISOString().split('T')[0]}.log`;
      const logFilePath = path.join(this.options.logDirectory, logFileName);
      const logLine = this.formatLogEntry(entry) + '\n';

      // Check file size and rotate if necessary
      this.rotateLogFile(logFilePath);

      const fs = require('fs');
      fs.appendFileSync(logFilePath, logLine, 'utf8');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private rotateLogFile(logFilePath: string): void {
    try {
      const fs = require('fs');
      if (!fs.existsSync(logFilePath)) return;

      const stats = fs.statSync(logFilePath);
      if (stats.size >= this.options.maxFileSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedPath = logFilePath.replace('.log', `_${timestamp}.log`);
        fs.renameSync(logFilePath, rotatedPath);
        
        // Clean up old log files
        this.cleanupOldLogs();
      }
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  private cleanupOldLogs(): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const files = fs.readdirSync(this.options.logDirectory)
        .filter((file: string) => file.startsWith('app_') && file.endsWith('.log'))
        .map((file: string) => ({
          name: file,
          path: path.join(this.options.logDirectory, file),
          mtime: fs.statSync(path.join(this.options.logDirectory, file)).mtime,
        }))
        .sort((a: any, b: any) => b.mtime.getTime() - a.mtime.getTime());

      // Keep only the most recent files
      if (files.length > this.options.maxFiles) {
        files.slice(this.options.maxFiles).forEach((file: any) => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      console.error('Failed to cleanup old logs:', error);
    }
  }

  private log(level: LogLevel, message: string, context?: LogEntry['context']): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
    };

    if (this.options.logToConsole) {
      const formatted = this.formatLogEntry(entry);
      
      switch (level) {
        case 'error':
          console.error(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'info':
          console.info(formatted);
          break;
        case 'debug':
          console.debug(formatted);
          break;
      }
    }

    this.writeToFile(entry);
  }

  public error(message: string, context?: LogEntry['context']): void {
    this.log('error', message, context);
  }

  public warn(message: string, context?: LogEntry['context']): void {
    this.log('warn', message, context);
  }

  public info(message: string, context?: LogEntry['context']): void {
    this.log('info', message, context);
  }

  public debug(message: string, context?: LogEntry['context']): void {
    this.log('debug', message, context);
  }

  // API-specific logging methods
  public logApiError(error: Error, req: NextApiRequest, context?: Record<string, any>): void {
    this.error(`API Error: ${error.message}`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: this.getClientIP(req),
      error: error.message,
      stack: error.stack,
      metadata: context,
    });
  }

  public logApiRequest(req: NextApiRequest, context?: Record<string, any>): void {
    this.info(`API Request`, {
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'],
      ip: this.getClientIP(req),
      metadata: context,
    });
  }

  public logDatabaseError(error: Error, operation: string, context?: Record<string, any>): void {
    this.error(`Database Error: ${error.message}`, {
      action: `database_${operation}`,
      error: error.message,
      stack: error.stack,
      metadata: context,
    });
  }

  public logSearchError(error: Error, query: string, searchType: string, context?: Record<string, any>): void {
    this.error(`Search Error: ${error.message}`, {
      action: 'search',
      error: error.message,
      stack: error.stack,
      metadata: {
        query,
        searchType,
        ...context,
      },
    });
  }

  private getClientIP(req: NextApiRequest): string | undefined {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.socket.remoteAddress
    );
  }
}

// Export singleton instance
export const logger = new Logger({
  logToFile: process.env.NODE_ENV === 'production',
  logToConsole: process.env.NODE_ENV === 'development',
  logLevel: (process.env.LOG_LEVEL as LogLevel) || 'info',
  logDirectory: process.env.LOG_PATH || 'logs',
});

// Export class for custom instances
export { Logger };

