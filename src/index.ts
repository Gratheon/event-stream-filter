import {execute, subscribe, Kind, parse} from "graphql";
// @ts-ignore
import express from "express";
import {graphqlHTTP} from "express-graphql";
import {useServer} from "graphql-ws/lib/use/ws";
import {WebSocketServer} from "ws";
import {makeExecutableSchema} from "@graphql-tools/schema";
import gql from "gql-tag";
import {withFilter} from "graphql-subscriptions";
import * as Sentry from "@sentry/node";

import {getUserIdByToken} from "./auth";
import "./shutdown";
import redisPubSub from './redisPubSub'
import config from './config'
import {logger} from "./logger";
import { subscriptionTypeDefs } from "./subscription-schema";
import { registerSubscriptions } from "./schema-registry";
import { publishSubscriptionUsage } from "./usage-publisher";

const app = express();
const SUBSCRIPTION_USAGE_SAMPLE_RATE = Math.min(
	1,
	Math.max(
		0.01,
			Number.isFinite(Number(process.env.SUBSCRIPTION_USAGE_SAMPLE_RATE))
				? Number(process.env.SUBSCRIPTION_USAGE_SAMPLE_RATE)
				: 1
		)
);

type ActiveSubscriptionSession = {
	subscriptionName: string;
	operationName?: string;
	query?: string;
	startedAtMs: number;
	transportedEvents: number;
	sampleRate: number;
};

const activeSubscriptionsBySocket = new WeakMap<
	object,
	Map<string, ActiveSubscriptionSession>
>();

function getOperationId(msg: unknown): string | null {
	const id = (msg as any)?.id;
	if (typeof id === "string" || typeof id === "number") {
		return String(id);
	}

	return null;
}

function getSocketFromCtx(ctx: unknown): object | null {
	const socket = (ctx as any)?.extra?.socket;
	return socket && typeof socket === "object" ? socket : null;
}

function getActiveSocketSubscriptions(socket: object) {
	let map = activeSubscriptionsBySocket.get(socket);
	if (!map) {
		map = new Map<string, ActiveSubscriptionSession>();
		activeSubscriptionsBySocket.set(socket, map);
	}

	return map;
}

function extractSubscriptionName({
	query,
	operationName,
}: {
	query?: string;
	operationName?: string;
}) {
	if (!query) {
		return operationName || "anonymous";
	}

	try {
		const ast = parse(query);
		const operation = ast.definitions.find((definition) => {
			if (definition.kind !== Kind.OPERATION_DEFINITION) {
				return false;
			}

			if (definition.operation !== "subscription") {
				return false;
			}

			if (!operationName) {
				return true;
			}

			return definition.name?.value === operationName;
		});

		if (
			operation &&
			operation.kind === Kind.OPERATION_DEFINITION &&
			operation.selectionSet?.selections?.length
		) {
			const firstField = operation.selectionSet.selections.find(
				(selection) => selection.kind === Kind.FIELD
			);

			if (firstField && firstField.kind === Kind.FIELD) {
				return firstField.name.value;
			}
		}
	} catch (_error) {
		// ignore parse failures, fallback to operationName
	}

	return operationName || "anonymous";
}

function finalizeTrackedSubscription(
	socket: object,
	operationId: string,
	reason: string
) {
	const sessions = activeSubscriptionsBySocket.get(socket);
	if (!sessions) {
		logger.info("Subscription metrics end skipped: socket not tracked", {
			operationId,
			reason,
		});
		return;
	}

	const session = sessions.get(operationId);
	if (!session) {
		logger.info("Subscription metrics end skipped: session not tracked", {
			operationId,
			reason,
		});
		return;
	}

	sessions.delete(operationId);
	const sessionDurationMs = Date.now() - session.startedAtMs;

	logger.info("Tracking subscription end", {
		operationId,
		reason,
		subscriptionName: session.subscriptionName,
		operationName: session.operationName || null,
		transportedEvents: session.transportedEvents,
		sessionDurationMs,
	});

	publishSubscriptionUsage({
		operationName: session.operationName,
		eventType: "subscription_end",
		subscriptionName: session.subscriptionName,
		sampleRate: session.sampleRate,
		sessionDurationMs,
		transportedEvents: session.transportedEvents,
	}).catch((error) => {
		logger.errorEnriched("Failed to publish subscription_end usage event", error, {
			operationName: session.operationName || null,
			subscriptionName: session.subscriptionName,
			reason,
		});
	});
}

Sentry.init({
    dsn: config.sentryDsn,
    environment: process.env.ENV_ID,
    integrations: [
        // enable HTTP calls tracing
        new Sentry.Integrations.Http({tracing: true}),
        // enable Express.js middleware tracing
        new Sentry.Integrations.Express({
            // to trace all requests to the default router
            app,
            // alternatively, you can specify the routes you want to trace:
            // router: someRouter,
        }),
    ],

    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1.0,
});

// schema and resolvers
const schema = makeExecutableSchema({
    typeDefs: gql`${subscriptionTypeDefs}`,
    resolvers: {
        Query: {
            hello: () => "Hello World!",
        },
        Subscription: {
            onFrameSideBeesPartiallyDetected: {
                subscribe: withFilter(
                    (_, {frameSideId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.frame_side.${frameSideId}.bees_partially_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.frame_side.${frameSideId}.bees_partially_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            onFrameSideResourcesDetected: {
                subscribe: withFilter(
                    (_, {frameSideId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.frame_side.${frameSideId}.frame_resources_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.frame_side.${frameSideId}.frame_resources_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            onHiveFrameSideCellsDetected: {
                subscribe: withFilter(
                    (_, {hiveId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.hive.${hiveId}.frame_resources_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.hive.${hiveId}.frame_resources_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            onFrameQueenCupsDetected: {
                subscribe: withFilter(
                    (_, {frameSideId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.frame_side.${frameSideId}.queen_cups_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.frame_side.${frameSideId}.queen_cups_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            // Added resolver for queen detection
            onFrameQueenDetected: {
                subscribe: withFilter(
                    (_, {frameSideId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.frame_side.${frameSideId}.queens_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.frame_side.${frameSideId}.queens_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            // Added resolver for varroa detection
            onFrameVarroaDetected: {
                subscribe: withFilter(
                    (_, {frameSideId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.frame_side.${frameSideId}.varroa_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.frame_side.${frameSideId}.varroa_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            onBoxVarroaDetected: {
                subscribe: withFilter(
                    (_, {boxId}, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.box.${boxId}.varroa_detected`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.box.${boxId}.varroa_detected`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },

            // Removed resolver for onQueenConfirmationUpdated

            onApiaryUpdated: {
                subscribe: withFilter(
                    (_, __, ctx) => {
                        logger.debug(`subscribing to ${ctx.uid}.apiary`)
                        return redisPubSub.asyncIterator(`${ctx.uid}.apiary`);
                    },
                    (payload, variables) => true
                ),
                resolve: (rawPayload) => rawPayload
            },
        },
    },
});

app.use(Sentry.Handlers.errorHandler());
app.use("/graphql", graphqlHTTP({schema}));
app.use("/", express.static("public"));
app.get(`/health`, (_, res) => {
    return res.status(200).send("ok");
});

logger.info("⛲️ Listening on port 8300");
app.listen(8300, () => {
    registerSubscriptions().catch((error) => {
        logger.errorEnriched("Subscription registry push failed", error, {});
    });

    const wsServer = new WebSocketServer({
        port: 8350,
        path: "/graphql",
    });
    wsServer.on("connection", (socket) => {
        socket.on("close", () => {
            const sessions = activeSubscriptionsBySocket.get(socket);
            if (!sessions || sessions.size === 0) {
                return;
            }

            for (const operationId of Array.from(sessions.keys())) {
                finalizeTrackedSubscription(socket, operationId, "socket_close");
            }
        });
    });

    useServer(
        {
            schema,
            execute,
            subscribe,

            onConnect: async (ctx) => {
                // // returning false from the onConnect callback will close with `4403: Forbidden`;
                // // therefore, being synonymous to ctx.extra.socket.close(4403, 'Forbidden');
                try {
                    const token = ctx.connectionParams?.token as string;
                    
                    if (!token) {
                        logger.error('WebSocket connection rejected: No authentication token provided in connection params');
                        return false;
                    }

                    const uid = await getUserIdByToken(token);

                    if (!uid) {
                        logger.error('WebSocket connection rejected: getUserIdByToken returned empty user ID');
                        return false;
                    }

                    logger.debug('WebSocket connection authenticated', { uid });
                    //@ts-ignore
                    ctx.uid = uid;
                } catch (error: any) {
                    logger.errorEnriched('WebSocket connection failed during authentication', error, {
                        hasConnectionParams: !!ctx.connectionParams,
                        hasToken: !!ctx.connectionParams?.token
                    });
                    return false;
                }
            },


            // pass context from ws -> graphql-ws
            context: (wsCtx: any) => {
                return {
                    uid: wsCtx.uid
                }
            },

            onSubscribe: (ctx, msg) => {
                const payload: any = (msg as any)?.payload || {};
                const socket = getSocketFromCtx(ctx);
                const operationId = getOperationId(msg);

                if (!socket || !operationId) {
                    logger.info("Subscription metrics skipped on subscribe: missing socket or operationId", {
                        hasSocket: Boolean(socket),
                        operationId: operationId || null,
                        operationName: payload.operationName || null,
                    });
                    return;
                }

                const shouldSample = Math.random() <= SUBSCRIPTION_USAGE_SAMPLE_RATE;
                if (!shouldSample) {
                    logger.info("Subscription metrics skipped by sampling", {
                        operationId,
                        operationName: payload.operationName || null,
                        sampleRate: SUBSCRIPTION_USAGE_SAMPLE_RATE,
                    });
                    return;
                }

                const subscriptionName = extractSubscriptionName({
                    query: payload.query,
                    operationName: payload.operationName,
                });

                getActiveSocketSubscriptions(socket).set(operationId, {
                    subscriptionName,
                    operationName: payload.operationName || undefined,
                    query: payload.query,
                    startedAtMs: Date.now(),
                    transportedEvents: 0,
                    sampleRate: SUBSCRIPTION_USAGE_SAMPLE_RATE,
                });

                logger.info("Tracking subscription start", {
                    operationId,
                    operationName: payload.operationName || null,
                    subscriptionName,
                    sampleRate: SUBSCRIPTION_USAGE_SAMPLE_RATE,
                });

                publishSubscriptionUsage({
                    query: payload.query,
                    operationName: payload.operationName,
                    connectionParams: (ctx as any)?.connectionParams as
                        | Record<string, unknown>
                        | undefined,
                    eventType: "subscription_start",
                    subscriptionName,
                    sampleRate: SUBSCRIPTION_USAGE_SAMPLE_RATE,
                }).catch((error) => {
                    logger.errorEnriched("Failed to record onSubscribe usage", error, {
                        operationName: payload.operationName || null,
                        subscriptionName,
                    });
                });
            },
            onNext: (ctx, msg, args, result) => {
                const socket = getSocketFromCtx(ctx);
                const operationId = getOperationId(msg);
                if (socket && operationId) {
                    const session = activeSubscriptionsBySocket
                        .get(socket)
                        ?.get(operationId);
                    if (session) {
                        session.transportedEvents += 1;
                        logger.debug("Tracked subscription event payload", {
                            operationId,
                            subscriptionName: session.subscriptionName,
                            transportedEvents: session.transportedEvents,
                        });
                    }
                }
                logger.debug("Next", {ctx, msg, args, result});
            },
            onError: (ctx, msg, errors) => {
                const socket = getSocketFromCtx(ctx);
                const operationId = getOperationId(msg);
                if (socket && operationId) {
                    finalizeTrackedSubscription(socket, operationId, "graphql_error");
                }
                logger.error("Error", {ctx, msg, errors});
            },
            onComplete: (ctx, msg) => {
                const socket = getSocketFromCtx(ctx);
                const operationId = getOperationId(msg);
                if (socket && operationId) {
                    finalizeTrackedSubscription(socket, operationId, "complete");
                }
                logger.debug("Complete", {ctx, msg});
            },
        },
        wsServer
    );
});
