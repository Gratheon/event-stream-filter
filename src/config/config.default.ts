export default {
	// should match graphql-router privateKey
    privateKey: "",
    sentryDsn: "",
    logLevel: process.env.LOG_LEVEL || "info", // debug, info, warn, error
    schemaRegistryHost:
        process.env.SCHEMA_REGISTRY_HOST || "http://gql-schema-registry:3000",
    selfWsUrl:
        process.env.SELF_WS_URL || "ws://event-stream-filter:8350/graphql",
}
