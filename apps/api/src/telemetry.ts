/**
 * OpenTelemetry tracing and metrics (LM-01, LM-05), preloaded with `node --import` so the loader
 * hook can instrument pg, ioredis, http and express before they are imported. Off unless
 * OTEL_EXPORTER_OTLP_ENDPOINT is set: locally and in CI it points at the Collector; the dev host
 * has none (ADR 0010) and relies on logs. Spans carry route templates and IDs only, never bodies.
 */
import { register } from 'import-in-the-middle/register-hooks.mjs';

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (endpoint) {
  // Synchronous loader hooks (Node 24.11+), limited to the instrumented packages.
  register({ include: ['pg', 'ioredis', 'express', 'http'] });
  const [
    { NodeSDK },
    { OTLPTraceExporter },
    { OTLPMetricExporter },
    { PeriodicExportingMetricReader },
    { HttpInstrumentation },
    { ExpressInstrumentation },
    { PgInstrumentation },
    { IORedisInstrumentation },
  ] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/exporter-metrics-otlp-http'),
    import('@opentelemetry/sdk-metrics'),
    import('@opentelemetry/instrumentation-http'),
    import('@opentelemetry/instrumentation-express'),
    import('@opentelemetry/instrumentation-pg'),
    import('@opentelemetry/instrumentation-ioredis'),
  ]);
  const sdk = new NodeSDK({
    serviceName: 'heach-api',
    traceExporter: new OTLPTraceExporter(),
    metricReaders: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: 15_000,
      }),
    ],
    instrumentations: [
      // Never record bodies or query parameters; URLs are route templates in span names.
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => req.url === '/healthz',
        // The root span carries the correlation ID set by correlationMiddleware (LM-01.1).
        applyCustomAttributesOnSpan: (span, _req, res) => {
          const id = 'getHeader' in res ? res.getHeader('x-correlation-id') : undefined;
          if (typeof id === 'string') span.setAttribute('heach.correlation_id', id);
        },
      }),
      new ExpressInstrumentation(),
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new IORedisInstrumentation({ dbStatementSerializer: (command) => command }),
    ],
  });
  sdk.start();
  process.once('SIGTERM', () => {
    void sdk.shutdown();
  });
}
