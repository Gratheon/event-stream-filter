import { execute, subscribe } from "graphql";
import express from "express";
import { graphqlHTTP } from "express-graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import gql from "gql-tag";

import { withFilter } from "graphql-subscriptions";
import { RedisPubSub } from "graphql-redis-subscriptions";
import Redis from "ioredis";

import { getUserIdByToken } from "./auth";
import "./shutdown";

const redisPubSub = new RedisPubSub({
  subscriber: new Redis({
    port: 6379,
    host: process.env.NATIVE === "1" ? "127.0.0.1" : "redis",
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
    host: process.env.NATIVE === "1" ? "127.0.0.1" : "redis",
    username: "default",
    password: "pass",
  }),
});

// schema and resolvers
const schema = makeExecutableSchema({
  typeDefs: gql`
    type Query {
      hello: String
    }
    type Subscription {
      onApiaryUpdated: ApiaryEvent
    }

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
      onApiaryUpdated: {
        subscribe: withFilter(
            (_,__,ctx) => {
              console.log(`subscribing to ${ctx.uid}.apiary`)
              return redisPubSub.asyncIterator(`${ctx.uid}.apiary`);
            },
            (payload, variables) => {
              return true;
            }
          ),
        resolve: (rawPayload, _, ctx, info) => {
          return rawPayload;
        },
      },
    },
  },
});

const app = express();
app.use("/graphql", graphqlHTTP({ schema }));
app.use("/", express.static("public"));
app.get(`/health`, (_, res) => {
  return res.status(200).send("ok");
});

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
        // console.log("Connect", ctx);
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
        // console.log("Subscribe", { ctx, msg });
        // if (!(await isTokenValid(ctx.connectionParams?.token)))
        // return ctx.extra.socket.close(CloseCode.Forbidden, 'Forbidden');
      },
      onNext: (ctx, msg, args, result) => {
        //console.debug("Next", { ctx, msg, args, result });
      },
      onError: (ctx, msg, errors) => {
        console.error("Error", { ctx, msg, errors });
      },
      onComplete: (ctx, msg) => {
        // console.log("Complete", { ctx, msg });
      },
    },
    wsServer
  );
});
