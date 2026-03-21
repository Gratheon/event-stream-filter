import type Redis from "ioredis";

import { recordDataStoreOperation } from "./metrics";

type RedisCommandLike = {
	name?: string;
};

function nowInSeconds(): bigint {
	return process.hrtime.bigint();
}

function elapsedSeconds(start: bigint): number {
	return Number(process.hrtime.bigint() - start) / 1_000_000_000;
}

export function instrumentRedisClient(redis: Redis, clientName: string): Redis {
	const instrumentedRedis = redis as Redis & { __metricsInstrumented?: boolean };
	if (instrumentedRedis.__metricsInstrumented) {
		return redis;
	}

	const originalSendCommand = redis.sendCommand.bind(redis);

	redis.sendCommand = ((command: RedisCommandLike, stream?: unknown) => {
		const start = nowInSeconds();
		const operation = command?.name || "unknown";
		const result = originalSendCommand(command as any, stream as any);

		return Promise.resolve(result)
			.then((value) => {
				recordDataStoreOperation({
					datastore: "redis",
					client: clientName,
					operation,
					status: "success",
					durationSeconds: elapsedSeconds(start),
				});
				return value;
			})
			.catch((error) => {
				recordDataStoreOperation({
					datastore: "redis",
					client: clientName,
					operation,
					status: "error",
					durationSeconds: elapsedSeconds(start),
				});
				throw error;
			});
	}) as typeof redis.sendCommand;

	instrumentedRedis.__metricsInstrumented = true;
	return redis;
}
