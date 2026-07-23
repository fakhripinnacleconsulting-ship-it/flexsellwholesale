import * as Sentry from "@sentry/nextjs";

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
  timestamp: string;
}

class Logger {
  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: unknown) {
    const payload: LogPayload = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (error) {
      payload.error = error instanceof Error ? { message: (error as any).message, stack: error.stack } : error;
    }

    const output = JSON.stringify(payload);

    switch (level) {
      case "debug":
        if (process.env.NODE_ENV !== "production") console.debug(output);
        break;
      case "info":
        console.info(output);
        break;
      case "warn":
        console.warn(output);
        break;
      case "error":
        console.error(output);
        if (process.env.NODE_ENV === "production") {
          Sentry.captureException(error instanceof Error ? error : new Error(message), {
            extra: context,
          });
        }
        break;
    }
  }

  debug(message: string, context?: Record<string, unknown>) {
    this.log("debug", message, context);
  }

  info(message: string, context?: Record<string, unknown>) {
    this.log("info", message, context);
  }

  warn(message: string, context?: Record<string, unknown>, error?: unknown) {
    this.log("warn", message, context, error);
  }

  error(message: string, context?: Record<string, unknown>, error?: unknown) {
    this.log("error", message, context, error);
  }
}

export const logger = new Logger();
