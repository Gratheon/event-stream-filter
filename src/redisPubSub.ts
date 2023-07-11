import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";


const redisPubSub = new RedisPubSub({
	subscriber: new Redis({
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
	publisher: new Redis({
		port: 6379,
		host: process.env.ENV_ID === "dev" ? "redis" :  "127.0.0.1",
		username: "default",
		password: "pass",
	}),
});

export default redisPubSub