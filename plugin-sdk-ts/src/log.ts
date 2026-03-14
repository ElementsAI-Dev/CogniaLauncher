import { callHost } from './host';
import type { PluginLogEnvelope, PluginLogRecord } from './types';

type LogRecordInput<
  TFields extends Record<string, unknown> = Record<string, unknown>,
> = Omit<PluginLogRecord<TFields>, 'level'>;

function normalizeLogRecord<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(
  level: string,
  messageOrRecord: string | LogRecordInput<TFields>,
): PluginLogRecord<TFields> {
  if (typeof messageOrRecord === 'string') {
    return { level, message: messageOrRecord };
  }

  return {
    level,
    message: messageOrRecord.message,
    target: messageOrRecord.target,
    fields: messageOrRecord.fields,
    tags: messageOrRecord.tags,
    correlationId: messageOrRecord.correlationId,
  };
}

/** Write a structured log record. */
export function write<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(record: PluginLogRecord<TFields>): void {
  callHost('cognia_log', JSON.stringify(record));
}

/** Log an info message or structured record. */
export function info(message: string): void;
export function info<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(record: LogRecordInput<TFields>): void;
export function info<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(messageOrRecord: string | LogRecordInput<TFields>): void {
  write(normalizeLogRecord('info', messageOrRecord));
}

/** Log a warning message or structured record. */
export function warn(message: string): void;
export function warn<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(record: LogRecordInput<TFields>): void;
export function warn<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(messageOrRecord: string | LogRecordInput<TFields>): void {
  write(normalizeLogRecord('warn', messageOrRecord));
}

/** Log an error message or structured record. */
export function error(message: string): void;
export function error<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(record: LogRecordInput<TFields>): void;
export function error<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(messageOrRecord: string | LogRecordInput<TFields>): void {
  write(normalizeLogRecord('error', messageOrRecord));
}

/** Log a debug message or structured record. */
export function debug(message: string): void;
export function debug<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(record: LogRecordInput<TFields>): void;
export function debug<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(messageOrRecord: string | LogRecordInput<TFields>): void {
  write(normalizeLogRecord('debug', messageOrRecord));
}

/** Parse the host log-listener callback envelope received by `cognia_on_log`. */
export function parseEnvelope<
  TFields extends Record<string, unknown> = Record<string, unknown>,
>(input: string): PluginLogEnvelope<TFields> | null {
  try {
    return JSON.parse(input) as PluginLogEnvelope<TFields>;
  } catch {
    return null;
  }
}
