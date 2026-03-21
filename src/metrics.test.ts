import {
	dataStoreOperationDurationSeconds,
	dataStoreSlowOperationsTotal,
	eventsDeliveredPayloadBytesTotal,
	eventsDeliveredTotal,
	httpRequestsTotal,
	recordDataStoreOperation,
	recordDeliveredEvent,
	recordHttpRequest,
	recordSubscriptionStart,
	recordWebsocketConnection,
	subscriptionStartsTotal,
	websocketConnectionsTotal,
} from "./metrics";

describe("metrics", () => {
	beforeEach(() => {
		httpRequestsTotal.reset();
		websocketConnectionsTotal.reset();
		subscriptionStartsTotal.reset();
		eventsDeliveredTotal.reset();
		eventsDeliveredPayloadBytesTotal.reset();
		dataStoreOperationDurationSeconds.reset();
		dataStoreSlowOperationsTotal.reset();
	});

	it("records delivered events with event and user labels", async () => {
		recordDeliveredEvent({
			eventName: "onFrameVarroaDetected",
			userId: "user-1",
			payload: { data: { onFrameVarroaDetected: { varroaCount: 3 } } },
		});

		const delivered = await eventsDeliveredTotal.get();
		expect(delivered.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						event_name: "onFrameVarroaDetected",
						user_id: "user-1",
					},
					value: 1,
				}),
			])
		);
	});

	it("records payload bytes for delivered events", async () => {
		recordDeliveredEvent({
			eventName: "onApiaryUpdated",
			userId: "user-2",
			payload: { data: { onApiaryUpdated: { id: "a1" } } },
		});

		const payloadBytes = await eventsDeliveredPayloadBytesTotal.get();
		expect(payloadBytes.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						event_name: "onApiaryUpdated",
					},
				}),
			])
		);
		const matching = payloadBytes.values.find(
			(value) => value.labels.event_name === "onApiaryUpdated"
		);
		expect(matching?.value).toBeGreaterThan(0);
	});

	it("normalizes missing labels to unknown", async () => {
		recordSubscriptionStart({ eventName: "", userId: "" });
		recordWebsocketConnection({ status: "rejected", reason: "" });
		recordHttpRequest({
			method: "get",
			route: "",
			statusCode: 200,
			durationSeconds: 0.01,
		});

		const subscriptions = await subscriptionStartsTotal.get();
		const websocketConnections = await websocketConnectionsTotal.get();
		const httpRequests = await httpRequestsTotal.get();

		expect(subscriptions.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						event_name: "unknown",
						user_id: "unknown",
					},
					value: 1,
				}),
			])
		);

		expect(websocketConnections.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						status: "rejected",
						reason: "unknown",
					},
					value: 1,
				}),
			])
		);

		expect(httpRequests.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						method: "GET",
						route: "unknown",
						status_code: "200",
					},
					value: 1,
				}),
			])
		);
	});

	it("records slow data store operations without query parameters", async () => {
		recordDataStoreOperation({
			datastore: "redis",
			client: "usage_publisher",
			operation: "publish",
			status: "success",
			durationSeconds: 0.08,
		});

		const duration = await dataStoreOperationDurationSeconds.get();
		const slow = await dataStoreSlowOperationsTotal.get();

		expect(duration.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						datastore: "redis",
						client: "usage_publisher",
						operation: "publish",
						status: "success",
					},
				}),
			])
		);

		expect(slow.values).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					labels: {
						datastore: "redis",
						client: "usage_publisher",
						operation: "publish",
						status: "success",
					},
					value: 1,
				}),
			])
		);
	});
});
