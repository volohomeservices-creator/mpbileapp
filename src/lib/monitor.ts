import { Platform } from 'react-native';

export enum LogLevel {
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  message: string;
  meta?: any;
  platform: typeof Platform.OS;
}

class MobileProductionMonitor {
  private isDev = __DEV__;

  private formatLog(level: LogLevel, message: string, meta?: any): LogPayload {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      meta: meta || null,
      platform: Platform.OS,
    };
  }

  private dispatchLog(payload: LogPayload) {
    if (this.isDev) {
      // In development, print formatted logs
      const color = {
        [LogLevel.INFO]: '\x1b[32m',
        [LogLevel.WARN]: '\x1b[33m',
        [LogLevel.ERROR]: '\x1b[31m',
        [LogLevel.FATAL]: '\x1b[41m\x1b[37m',
      }[payload.level];
      console.log(`${color}[${payload.level}] [${payload.timestamp}] ${payload.message}\x1b[0m`, payload.meta || '');
    } else {
      // In production, we log structured payloads to terminal/diagnostic files.
      // If a third-party logger (like Sentry or Crashlytics) is configured, it binds here.
      console.warn(JSON.stringify(payload));
    }
  }

  info(message: string, meta?: any) {
    this.dispatchLog(this.formatLog(LogLevel.INFO, message, meta));
  }

  warn(message: string, meta?: any) {
    this.dispatchLog(this.formatLog(LogLevel.WARN, message, meta));
  }

  error(message: string, error?: any, meta?: any) {
    const errorMeta = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...meta
    } : { error, ...meta };
    this.dispatchLog(this.formatLog(LogLevel.ERROR, message, errorMeta));
  }

  fatal(message: string, error?: any, meta?: any) {
    const errorMeta = error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...meta
    } : { error, ...meta };
    this.dispatchLog(this.formatLog(LogLevel.FATAL, message, errorMeta));
  }

  logGpsFailure(message: string, error?: any) {
    this.error(`[GPS Failure] ${message}`, error);
  }

  logApiFailure(endpoint: string, method: string, error?: any) {
    this.error(`[API Failure] ${method} ${endpoint}`, error);
  }

  logUploadFailure(fileKey: string, error?: any) {
    this.error(`[Upload Failure] Failed uploading file matching: ${fileKey}`, error);
  }
}

export const monitor = new MobileProductionMonitor();
