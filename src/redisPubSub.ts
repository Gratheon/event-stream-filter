import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";
import { instrumentRedisClient } from "./instrument-redis";

const subscriber = instrumentRedisClient(
	new Redis({
		port: 6379,
		host: process.env.ENV_ID === "dev" ? "redis" : "127.0.0.1",
		username: "default",
		password: "pass",
		showFriendlyErrorStack: true,
		db: 0,

		enableReadyCheck: true,
		autoResubscribe: true,
		retryStrategy: (times) => {
			return Math.min(times * 500, 5000);
		},
	}),
	"pubsub_subscriber"
);

const publisher = instrumentRedisClient(
	new Redis({
		port: 6379,
		host: process.env.ENV_ID === "dev" ? "redis" :  "127.0.0.1",
		username: "default",
		password: "pass",
	}),
	"pubsub_publisher"
);

const redisPubSub = new RedisPubSub({
	subscriber,
	publisher,
});

export default redisPubSub
