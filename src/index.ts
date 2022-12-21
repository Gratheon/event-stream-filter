
import { execute, subscribe } from "graphql";
import express from "express";
import { graphqlHTTP } from "express-graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws";
import { makeExecutableSchema } from "@graphql-tools/schema";
import gql from "gql-tag";

import { PubSub } from "graphql-subscriptions";

import { withFilter } from 'graphql-subscriptions';
import { RedisPubSub } from 'graphql-redis-subscriptions';
import Redis from 'ioredis';

import "./shutdown";

const pubsub = new PubSub();

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
    retryStrategy: times => {
       return Math.min(times * 500, 5000)
    }
  }),
  publisher: new Redis({
    port: 6379,
    host: "127.0.0.1",
    username: "default",
    password: "pass"
  }),
});

// schema and resolvers
const schema = makeExecutableSchema({
  typeDefs: gql`
    type Query {
      hello: String
    }
    type Subscription {
      hi: String
      numberIncremented: Int
      timePubSub: String

      onApiaryAdded: ApiaryEvent
    }

    type ApiaryEvent{
      id: String
      name: String
    }
  `,
  resolvers: {
    Query: {
      hello: () => "Hello World!",
    },
    Subscription: {
      hi: {
        subscribe: async function* sayHi() {
          for (const hi of [
            "Hi",
            "Привет",
            "Bonjour",
            "Hola",
            "Ciao",
            "Zdravo",
          ]) {
            yield new Promise((resolve) => setTimeout(resolve, 2000));
            yield { hi };
          }
        },
      },

      numberIncremented: {
        subscribe: () => ({
          [Symbol.asyncIterator]() {
            let value = 0;

            return {
              async next() {
                return new Promise((resolve, reject) => {
                  setTimeout(() => {
                    value++;
                    resolve({
                      value: { numberIncremented: value },
                      done: value > 100,
                    });
                  }, 1000);
                });
              },
              async return() {
                // Code to clean up resources goes here
                // cleanUpResources();
                return { value: { numberIncremented: value }, done: true };
              },
              async throw(error) {
                // Code to handle errors goes here
                // handleError(error);
                return { value: { numberIncremented: value }, done: true };
              },
            };
          },
        }),
      },

      timePubSub: {
        subscribe: ()=> pubsub.asyncIterator("TIME"),
      },

      onApiaryAdded: {
        subscribe: withFilter(
          () => redisPubSub.asyncIterator('apiary'),
          (payload, variables) => {
            return true;
          },
        ),
        resolve: (rawPayload, _, ctx, info) => {
          return rawPayload;
        },
      }
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

      onConnect: (ctx) => {
        console.log("Connect", ctx);

        // if (!(await isTokenValid(ctx.connectionParams?.token)))
        // // returning false from the onConnect callback will close with `4403: Forbidden`;
        // // therefore, being synonymous to ctx.extra.socket.close(4403, 'Forbidden');
        // return false;
      },
      onSubscribe: (ctx, msg) => {
        console.log("Subscribe", { ctx, msg });
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
        console.log("Complete", { ctx, msg });
      },
    },
    wsServer
  );
});


//timePubSub
function publishTime() {
  pubsub.publish("TIME", { timePubSub: (new Date()).toISOString() });

  setTimeout(publishTime, 1000);
}
publishTime();