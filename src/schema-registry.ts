import fs from "fs";
import crypto from "crypto";
import { resolve } from "path";

import config from "./config";
import { logger } from "./logger";
import { subscriptionTypeDefs } from "./subscription-schema";

interface PackageJson {
	name: string;
}

const packageJson: PackageJson = JSON.parse(
	fs.readFileSync(resolve("package.json"), "utf8")
);

interface SubscriptionRegistryPayload {
	name: string;
	version: string;
	ws_url: string;
	type_defs: string;
}

function schemaHash(input: string) {
	return crypto.createHash("sha1").update(input).digest("hex");
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushSubscriptions(payload: SubscriptionRegistryPayload, url: string) {
	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Schema-registry rejected subscription push: ${response.status} ${response.statusText} ${body}`
		);
	}
}

export async function registerSubscriptions({
	maxAttempts = 20,
	retryDelayMs = 3_000,
}: {
	maxAttempts?: number;
	retryDelayMs?: number;
} = {}): Promise<void> {
	const url = `${config.schemaRegistryHost}/subscriptions/push`;
	const version =
		process.env.ENV_ID === "dev" ? "latest" : schemaHash(subscriptionTypeDefs);

	const payload: SubscriptionRegistryPayload = {
		name: packageJson.name,
		version,
		ws_url: config.selfWsUrl,
		type_defs: subscriptionTypeDefs,
	};

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			await pushSubscriptions(payload, url);
			logger.info("Registered subscriptions in schema-registry", {
				name: payload.name,
				version: payload.version,
				ws_url: payload.ws_url,
				attempt,
			});
			return;
		} catch (error: any) {
			const isLastAttempt = attempt === maxAttempts;

			if (isLastAttempt) {
				logger.errorEnriched(
					"Failed to register subscriptions in schema-registry",
					error,
					{ url, attempts: attempt }
				);
				return;
			}

			logger.warn("Schema-registry not reachable yet, will retry", {
				attempt,
				nextRetryInMs: retryDelayMs,
				url,
				error: error?.message || String(error),
			});
			await sleep(retryDelayMs);
		}
	}
}
