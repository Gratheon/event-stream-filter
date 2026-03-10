import Redis from "ioredis";
import { logger } from "./logger";

const REDIS_CHANNEL = process.env.REDIS_QUERIES_CHANNEL || "graphql-queries";

let publisher: Redis | null = null;

function getPublisher() {
	if (publisher) {
		return publisher;
	}

	publisher = new Redis({
		port: Number(process.env.REDIS_PORT || 6379),
		host:
			process.env.REDIS_HOST ||
			(process.env.ENV_ID === "dev" ? "redis" : "127.0.0.1"),
		username: process.env.REDIS_USERNAME || "default",
		password: process.env.REDIS_SECRET || process.env.REDIS_PASSWORD || "pass",
		lazyConnect: true,
		maxRetriesPerRequest: 1,
	});

	publisher.on("error", (error) => {
		logger.error("Subscription usage redis publisher error", { error });
	});

	return publisher;
}

function asString(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim().length > 0) {
		return value;
	}

	return undefined;
}

function buildHeaders(connectionParams: Record<string, unknown> | undefined) {
	const clientName =
		asString(connectionParams?.["apollographql-client-name"]) ||
		asString(connectionParams?.["x-client-name"]) ||
		"websocket-client";

	const clientVersion =
		asString(connectionParams?.["apollographql-client-version"]) ||
		asString(connectionParams?.["x-client-version"]) ||
		"unknown";

	return {
		"apollographql-client-name": clientName,
		"apollographql-client-version": clientVersion,
	};
}

export async function publishSubscriptionUsage({
	query,
	operationName,
	connectionParams,
	eventType,
	subscriptionName,
	sampleRate,
	sessionDurationMs,
	transportedEvents,
}: {
	query?: string;
	operationName?: string;
	connectionParams?: Record<string, unknown>;
	eventType: "subscription_start" | "subscription_end";
	subscriptionName: string;
	sampleRate: number;
	sessionDurationMs?: number;
	transportedEvents?: number;
}) {
	if (!subscriptionName || sampleRate <= 0) {
		return;
	}

	try {
		const redis = getPublisher();

		if (redis.status === "wait") {
			await redis.connect();
		}

		await redis.publish(
			REDIS_CHANNEL,
			JSON.stringify({
				query,
				operationName: operationName || null,
				subscriptionName,
				timestamp: Date.now(),
				headers:
					eventType === "subscription_start"
						? buildHeaders(connectionParams)
						: undefined,
				transport: "websocket",
				eventType,
				sampleRate,
				sessionDurationMs: Number.isFinite(sessionDurationMs)
					? Math.max(0, Math.floor(Number(sessionDurationMs)))
					: undefined,
				transportedEvents: Number.isFinite(transportedEvents)
					? Math.max(0, Math.floor(Number(transportedEvents)))
					: undefined,
			})
		);

		logger.info("Published subscription usage event", {
			eventType,
			subscriptionName,
			operationName: operationName || null,
			sampleRate,
			sessionDurationMs:
				Number.isFinite(sessionDurationMs) && sessionDurationMs !== undefined
					? Math.max(0, Math.floor(Number(sessionDurationMs)))
					: null,
			transportedEvents:
				Number.isFinite(transportedEvents) && transportedEvents !== undefined
					? Math.max(0, Math.floor(Number(transportedEvents)))
					: null,
		});
	} catch (error: any) {
		logger.errorEnriched("Failed to publish subscription usage event", error, {
			operationName: operationName || null,
			subscriptionName,
			eventType,
		});
	}
}
