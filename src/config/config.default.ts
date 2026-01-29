export default {
	// should match graphql-router privateKey
    privateKey: "",
    sentryDsn: "",
    logLevel: process.env.LOG_LEVEL || "info", // debug, info, warn, error
}