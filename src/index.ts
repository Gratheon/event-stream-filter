// 🛸 server
import { execute, subscribe } from "graphql";
import express from "express";
import { graphqlHTTP } from "express-graphql";
import { useServer } from "graphql-ws/lib/use/ws";
import { WebSocketServer } from "ws"; // yarn add ws
// import { PubSub } from "graphql-subscriptions";
import { makeExecutableSchema } from "@graphql-tools/schema";
import gql from "gql-tag";

import "./shutdown";

// schema and resolvers
const schema = makeExecutableSchema({
  typeDefs: gql`
    type Query {
      hello: String
      currentNumber: Int
    }
    type Subscription {
      hi: String
      numberIncremented: Int
    }
  `,
  resolvers: {
    Query: {
      hello: () => "Hello World!",
      currentNumber() {
        return currentNumber;
      },
    },
    Subscription: {
      numberIncremented: {
        subscribe: () => ({
          [Symbol.asyncIterator]() {
            let value = 0;

            return {
              async next() {
                console.log('nexting');
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
        //pubsub.asyncIterator(["NUMBER_INCREMENTED"]),
      },

      // generators
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
    },
  },
});

// app server
const app = express();
app.use("/graphql", graphqlHTTP({ schema }));
app.use("/", express.static("public"));
app.get(`/health-graphql-subscriptions`, (_, res) => {
  return res.status(200).send("ok");
});

app.listen(8300, () => {
  // create and use the websocket server

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
        // console.log("Connect", ctx);

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
        console.debug("Next", { ctx, msg, args, result });
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

// In the background, increment a number every second and notify subscribers when
// it changes.
// const pubsub = new PubSub();
let currentNumber = 0;
function incrementNumber() {
  currentNumber++;
  // pubsub.publish("NUMBER_INCREMENTED", { numberIncremented: currentNumber });
  setTimeout(incrementNumber, 1000);
}
// Start incrementing
incrementNumber();
