import {execute, subscribe} from "graphql";
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

const app = express();

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
    typeDefs: gql`
    scalar JSON
    type Query {
      hello: String
    }
    type Subscription {
      onApiaryUpdated: ApiaryEvent
      onFrameSideBeesPartiallyDetected(frameSideId: String): BeesDetectedEvent
      onFrameSideResourcesDetected(frameSideId: String): FrameResourcesDetectedEvent
      onHiveFrameSideCellsDetected(hiveId: String): FrameResourcesDetectedEvent
      onFrameQueenCupsDetected(frameSideId: String): QueenCupsDetectedEvent
      onFrameQueenDetected(frameSideId: String): QueenDetectedEvent
      onFrameVarroaDetected(frameSideId: String): VarroaDetectedEvent # Added Varroa subscription
    }

    type BeesDetectedEvent{
      delta: JSON
      detectedQueenCount: Int
      detectedWorkerBeeCount: Int
      detectedDroneCount: Int
      isBeeDetectionComplete: Boolean
    }

    type FrameResourcesDetectedEvent{
      delta: JSON
      isCellsDetectionComplete: Boolean
      frameSideId: String
      
      broodPercent: Int
      cappedBroodPercent: Int
      eggsPercent: Int
      pollenPercent: Int
      honeyPercent: Int
    }

    type QueenCupsDetectedEvent{
      delta: JSON
      isQueenCupsDetectionComplete: Boolean
    }

    # Added type for queen detection event
    type QueenDetectedEvent{
      delta: JSON
      isQueenDetectionComplete: Boolean
    }

    # Added type for varroa detection event
    type VarroaDetectedEvent {
      delta: JSON
      isVarroaDetectionComplete: Boolean
      varroaCount: Int
    }

    # Removed QueenConfirmationEvent type
    
    type ApiaryEvent {
      id: String
      name: String
    }
  `,
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
                const uid = await getUserIdByToken(
                    ctx.connectionParams?.token as string
                );

                if (!uid) {
                    return false;
                }

                //@ts-ignore
                ctx.uid = uid;
            },


            // pass context from ws -> graphql-ws
            context: (wsCtx: any) => {
                return {
                    uid: wsCtx.uid
                }
            },

            onSubscribe: (ctx, msg) => {
                // if (!(await isTokenValid(ctx.connectionParams?.token)))
                // return ctx.extra.socket.close(CloseCode.Forbidden, 'Forbidden');
            },
            onNext: (ctx, msg, args, result) => {
                logger.debug("Next", {ctx, msg, args, result});
            },
            onError: (ctx, msg, errors) => {
                logger.error("Error", {ctx, msg, errors});
            },
            onComplete: (ctx, msg) => {
                logger.debug("Complete", {ctx, msg});
            },
        },
        wsServer
    );
});
