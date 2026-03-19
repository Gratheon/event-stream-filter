export const subscriptionTypeDefs = `
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
  onFrameVarroaDetected(frameSideId: String): VarroaDetectedEvent
  onBoxVarroaDetected(boxId: String): BoxVarroaDetectedEvent
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
  droneBroodPercent: Int
  cappedBroodPercent: Int
  eggsPercent: Int
  nectarPercent: Int
  pollenPercent: Int
  honeyPercent: Int
}

type QueenCupsDetectedEvent{
  delta: JSON
  isQueenCupsDetectionComplete: Boolean
}

type QueenDetectedEvent{
  delta: JSON
  isQueenDetectionComplete: Boolean
}

type VarroaDetectedEvent {
  delta: JSON
  isVarroaDetectionComplete: Boolean
  varroaCount: Int
}

type BoxVarroaDetectedEvent {
  fileId: String
  boxId: String
  varroaCount: Int
  detections: JSON
  isComplete: Boolean
}

type ApiaryEvent {
  id: String
  name: String
}
`;
