import * as client from "prom-client";

const register = new client.Registry();

register.setDefaultLabels({
	service: "event-stream-filter",
});

client.collectDefaultMetrics({ register });

export const httpRequestDurationSeconds = new client.Histogram({
	name: "event_stream_filter_http_request_duration_seconds",
	help: "HTTP request duration in seconds",
	labelNames: ["method", "route", "status_code"] as const,
	buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
	registers: [register],
});

export const httpRequestsTotal = new client.Counter({
	name: "event_stream_filter_http_requests_total",
	help: "Total number of HTTP requests",
	labelNames: ["method", "route", "status_code"] as const,
	registers: [register],
});

export const websocketConnectionsTotal = new client.Counter({
	name: "event_stream_filter_websocket_connections_total",
	help: "Total number of websocket connection attempts",
	labelNames: ["status", "reason"] as const,
	registers: [register],
});

export const websocketActiveConnections = new client.Gauge({
	name: "event_stream_filter_websocket_active_connections",
	help: "Current number of active websocket connections",
	registers: [register],
});

export const subscriptionStartsTotal = new client.Counter({
	name: "event_stream_filter_subscription_starts_total",
	help: "Total number of subscription start requests",
	labelNames: ["event_name", "user_id"] as const,
	registers: [register],
});

export const eventsDeliveredTotal = new client.Counter({
	name: "event_stream_filter_events_delivered_total",
	help: "Total number of subscription events delivered",
	labelNames: ["event_name", "user_id"] as const,
	registers: [register],
});

export const eventsDeliveredPayloadBytesTotal = new client.Counter({
	name: "event_stream_filter_events_delivered_payload_bytes_total",
	help: "Total payload bytes delivered through subscriptions",
	labelNames: ["event_name"] as const,
	registers: [register],
});

export const websocketErrorsTotal = new client.Counter({
	name: "event_stream_filter_websocket_errors_total",
	help: "Total number of websocket/subscription errors",
	labelNames: ["event_name", "phase"] as const,
	registers: [register],
});

export const dataStoreOperationDurationSeconds = new client.Histogram({
	name: "event_stream_filter_data_store_operation_duration_seconds",
	help: "Data store operation duration in seconds",
	labelNames: ["datastore", "client", "operation", "status"] as const,
	buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
	registers: [register],
});

export const dataStoreSlowOperationsTotal = new client.Counter({
	name: "event_stream_filter_data_store_slow_operations_total",
	help: "Total number of slow data store operations",
	labelNames: ["datastore", "client", "operation", "status"] as const,
	registers: [register],
});

const SLOW_DATA_STORE_OPERATION_SECONDS = 0.05;

function normalizeLabel(value: string | undefined | null): string {
	if (!value) {
		return "unknown";
	}
	const normalized = String(value).trim();
	return normalized.length > 0 ? normalized : "unknown";
}

export function recordHttpRequest(input: {
	method: string;
	route: string;
	statusCode: number;
	durationSeconds: number;
}) {
	const labels = {
		method: normalizeLabel(input.method).toUpperCase(),
		route: normalizeLabel(input.route),
		status_code: String(input.statusCode),
	};

	httpRequestsTotal.inc(labels);
	httpRequestDurationSeconds.observe(labels, input.durationSeconds);
}

export function recordWebsocketConnection(input: {
	status: "accepted" | "rejected" | "error";
	reason: string;
}) {
	websocketConnectionsTotal.inc({
		status: input.status,
		reason: normalizeLabel(input.reason),
	});
}

export function incrementActiveWebsocketConnections() {
	websocketActiveConnections.inc();
}

export function decrementActiveWebsocketConnections() {
	websocketActiveConnections.dec();
}

export function recordSubscriptionStart(input: {
	eventName: string;
	userId?: string;
}) {
	subscriptionStartsTotal.inc({
		event_name: normalizeLabel(input.eventName),
		user_id: normalizeLabel(input.userId),
	});
}

function estimatePayloadBytes(payload: unknown): number {
	if (payload === undefined || payload === null) {
		return 0;
	}

	try {
		return Buffer.byteLength(JSON.stringify(payload), "utf8");
	} catch (_error) {
		return 0;
	}
}

export function recordDeliveredEvent(input: {
	eventName: string;
	userId?: string;
	payload?: unknown;
}) {
	const eventName = normalizeLabel(input.eventName);
	eventsDeliveredTotal.inc({
		event_name: eventName,
		user_id: normalizeLabel(input.userId),
	});

	const payloadSize = estimatePayloadBytes(input.payload);
	if (payloadSize > 0) {
		eventsDeliveredPayloadBytesTotal.inc(
			{
				event_name: eventName,
			},
			payloadSize
		);
	}
}

export function recordWebsocketError(input: {
	eventName?: string;
	phase: "subscribe" | "deliver" | "connect";
}) {
	websocketErrorsTotal.inc({
		event_name: normalizeLabel(input.eventName),
		phase: input.phase,
	});
}

export function recordDataStoreOperation(input: {
	datastore: "redis";
	client: string;
	operation: string;
	status: "success" | "error";
	durationSeconds: number;
}) {
	const labels = {
		datastore: input.datastore,
		client: normalizeLabel(input.client),
		operation: normalizeLabel(input.operation),
		status: input.status,
	};

	dataStoreOperationDurationSeconds.observe(labels, input.durationSeconds);

	if (input.durationSeconds >= SLOW_DATA_STORE_OPERATION_SECONDS) {
		dataStoreSlowOperationsTotal.inc(labels);
	}
}

export async function renderMetrics(): Promise<string> {
	return register.metrics();
}

export const metricsContentType = register.contentType;
