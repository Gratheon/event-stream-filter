# ⛲️ gratheon / event-stream-filter

A service that streams backend events to the frontend over websocket protocol using GraphQL notation and filtering based on graphql subscriptions.

## URLs

graphiql locally - http://localhost:8300

## Development

To run, use [just](https://github.com/casey/just) runner:

```sh
just start
```

## Architecture

```mermaid
flowchart LR
web-app("<a href='https://github.com/Gratheon/web-app'>web-app</a>") --> graphql-router
web-app --"subscribe to events"--> event-stream-filter("<a href='https://github.com/Gratheon/event-stream-filter'>event-stream-filter</a>") --> redis

graphql-router --> swarm-api("<a href='https://github.com/Gratheon/swarm-api'>swarm-api</a>") --uid.apiary.updated--> redis[("<a href='https://github.com/Gratheon/redis'>redis pub-sub</a>")]
```
