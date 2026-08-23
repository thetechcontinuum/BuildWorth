export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export interface LogPayload {
  message: string;
  level?: LogLevel;
  context?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export class Logger {
  private context: string;

  constructor(context = "App") {
    this.context = context;
  }

  public log(payload: LogPayload): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level: payload.level || "info",
      context: payload.context || this.context,
      message: payload.message,
      correlationId: payload.correlationId,
      metadata: payload.metadata,
      error: payload.error
        ? { message: payload.error.message, stack: payload.error.stack }
        : undefined,
    };
    const output = JSON.stringify(entry);
    if (payload.level === "error") {
      console.error(output);
    } else if (payload.level === "warn") {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  public info(message: string, metadata?: Record<string, unknown>, correlationId?: string): void {
    this.log({ message, level: "info", metadata, correlationId });
  }

  public warn(message: string, metadata?: Record<string, unknown>, correlationId?: string): void {
    this.log({ message, level: "warn", metadata, correlationId });
  }

  public error(
    message: string,
    error?: Error,
    metadata?: Record<string, unknown>,
    correlationId?: string,
  ): void {
    this.log({ message, level: "error", error, metadata, correlationId });
  }
}

export const logger = new Logger("BuildWorth");
