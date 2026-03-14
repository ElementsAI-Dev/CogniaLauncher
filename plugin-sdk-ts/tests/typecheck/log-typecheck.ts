import { cognia } from "../../src";
import type { PluginLogEnvelope, PluginLogRecord } from "../../src";

type DemoFields = {
  requestId: string;
  attempt: number;
};

const record: PluginLogRecord<DemoFields> = {
  level: "info",
  message: "Structured log",
  target: "plugin.demo",
  fields: {
    requestId: "req-1",
    attempt: 1,
  },
  tags: ["sdk", "log"],
  correlationId: "corr-1",
};

cognia.log.write(record);
cognia.log.info("Simple log message");
cognia.log.warn<DemoFields>({
  message: "Warning log",
  target: "plugin.warn",
  fields: {
    requestId: "req-2",
    attempt: 2,
  },
  tags: ["warn"],
  correlationId: "corr-2",
});

const parsed = cognia.log.parseEnvelope<DemoFields>(
  JSON.stringify({
    sourceType: "plugin",
    sourcePluginId: "com.example.demo",
    level: "info",
    message: "Envelope log",
    target: "plugin.demo",
    fields: {
      requestId: "req-3",
      attempt: 3,
    },
    tags: ["listener"],
    correlationId: "corr-3",
    timestamp: "2026-03-12T00:00:00Z",
  }),
);

if (parsed) {
  const envelope: PluginLogEnvelope<DemoFields> = parsed;
  const sourceType: string = envelope.sourceType;
  const requestId: string | undefined = envelope.fields?.requestId;
  const attempt: number | undefined = envelope.fields?.attempt;
  const timestamp: string = envelope.timestamp;
  void sourceType;
  void requestId;
  void attempt;
  void timestamp;
}
