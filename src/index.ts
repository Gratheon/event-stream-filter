import {execute, Kind, parse, subscribe, type DocumentNode} from "graphql";
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
import {
    decrementActiveWebsocketConnections,
    incrementActiveWebsocketConnections,
    metricsContentType,
    recordDeliveredEvent,
    recordHttpRequest,
    recordSubscriptionStart,
    recordWebsocketConnection,
    recordWebsocketError,
    renderMetrics,
} from "./metrics";

const app = express();
const requestStartTimes = new WeakMap<object, bigint>();
const activeSockets = new WeakSet<object>();

function extractEventNameFromDocument(document: DocumentNode | undefined): string {
    if (!document?.definitions) {
        return "unknown";
    }

    for (const definition of document.definitions) {
        if (
            definition.kind !== Kind.OPERATION_DEFINITION ||
            definition.operation !== "subscription"
        ) {
            continue;
        }
        const firstSelection = definition.selectionSet.selections[0];
        if (firstSelection?.kind === Kind.FIELD && firstSelection.name?.value) {
            return firstSelection.name.value;
        }
    }

    return "unknown";
}

function extractUserId(value: unknown): string {
    if (!value || typeof value !== "string" || value.trim().length === 0) {
        return "unknown";
    }
    return value;
}

function parseSubscriptionDocument(query: unknown): DocumentNode | undefined {
    if (typeof query !== "string" || query.trim().length === 0) {
        return undefined;
    }

    try {
        return parse(query);
    } catch (_error) {
        return undefined;
    }
}

function getSocketFromContext(ctx: any): object | undefined {
    return ctx?.extra?.socket;
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
app.use((req, res, next) => {
    requestStartTimes.set(req, process.hrtime.bigint());
    res.on("finish", () => {
        const start = requestStartTimes.get(req);
        if (!start) {
            return;
        }
        requestStartTimes.delete(req);

        const elapsedNanoseconds = Number(process.hrtime.bigint() - start);
        const durationSeconds = elapsedNanoseconds / 1_000_000_000;
        const route = req.route?.path || req.path || req.url?.split("?")[0] || "unknown";

        recordHttpRequest({
            method: req.method,
            route,
            statusCode: res.statusCode,
            durationSeconds,
        });
    });
    next();
});
app.use("/graphql", graphqlHTTP({schema}));
app.use("/", express.static("public"));
app.get(`/health`, (_, res) => {
    return res.status(200).send("ok");
});
app.get("/metrics", async (_req, res) => {
    res.setHeader("Content-Type", metricsContentType);
    return res.status(200).send(await renderMetrics());
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
                        recordWebsocketConnection({ status: "rejected", reason: "missing_token" });
                        return false;
                    }

                    const uid = await getUserIdByToken(token);

                    if (!uid) {
                        logger.error('WebSocket connection rejected: getUserIdByToken returned empty user ID');
                        recordWebsocketConnection({ status: "rejected", reason: "empty_user_id" });
                        return false;
                    }

                    logger.debug('WebSocket connection authenticated', { uid });
                    //@ts-ignore
                    ctx.uid = uid;
                    recordWebsocketConnection({ status: "accepted", reason: "authenticated" });
                    incrementActiveWebsocketConnections();
                    const socket = getSocketFromContext(ctx);
                    if (socket) {
                        activeSockets.add(socket);
                    }
                } catch (error: any) {
                    logger.errorEnriched('WebSocket connection failed during authentication', error, {
                        hasConnectionParams: !!ctx.connectionParams,
                        hasToken: !!ctx.connectionParams?.token
                    });
                    recordWebsocketConnection({ status: "error", reason: "auth_error" });
                    recordWebsocketError({ eventName: "authentication", phase: "connect" });
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
                const eventName = extractEventNameFromDocument(parseSubscriptionDocument(payload.query));
                const userId = extractUserId((ctx as any)?.uid || (ctx as any)?.extra?.uid);

                recordSubscriptionStart({
                    eventName,
                    userId,
                });
                publishSubscriptionUsage({
                    query: payload.query,
                    operationName: payload.operationName,
                    connectionParams: (ctx as any)?.connectionParams as
                        | Record<string, unknown>
                        | undefined,
                }).catch((error) => {
                    logger.errorEnriched("Failed to record onSubscribe usage", error, {
                        operationName: payload.operationName || null,
                    });
                    recordWebsocketError({ eventName, phase: "subscribe" });
                });
            },
            onNext: (ctx, msg, args, result) => {
                const eventName = extractEventNameFromDocument((args as any)?.document as DocumentNode | undefined);
                const userId = extractUserId((args as any)?.contextValue?.uid || (ctx as any)?.uid || (ctx as any)?.extra?.uid);
                recordDeliveredEvent({
                    eventName,
                    userId,
                    payload: result,
                });
                logger.debug("Next", {ctx, msg, args, result});
            },
            onError: (ctx, msg, errors) => {
                const eventName = extractEventNameFromDocument(parseSubscriptionDocument((msg as any)?.payload?.query));
                recordWebsocketError({ eventName, phase: "deliver" });
                logger.error("Error", {ctx, msg, errors});
            },
            onDisconnect: (ctx) => {
                const socket = getSocketFromContext(ctx);
                if (socket && activeSockets.has(socket)) {
                    activeSockets.delete(socket);
                    decrementActiveWebsocketConnections();
                }
            },
            onComplete: (ctx, msg) => {
                logger.debug("Complete", {ctx, msg});
            },
        },
        wsServer
    );
});
