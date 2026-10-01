import { useCameraStore } from '../stores/useCameraStore'
import { useDroneStore } from '../stores/useDroneStore'
import type { RecognitionMetadata, RecognitionSource } from './AndroidMediaService'

const APP_VERSION = '0.956'
const METADATA_SCHEMA = 1

export class RecognitionMetadataService {
  static build(source: RecognitionSource): RecognitionMetadata {
    const drone = useDroneStore()
    const camera = useCameraStore()
    const now = Date.now()
    const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

    return {
      schemaVersion: METADATA_SCHEMA,
      source,
      capture: {
        timestampUnixMs: now,
        timestampIso: new Date(now).toISOString()
      },
      telemetry: clone(drone.telemetry),
      camera: {
        videoResolutionIndex: camera.videoResolutionIndex,
        photoResolutionIndex: camera.photoResolutionIndex,
        videoEv: camera.videoEv,
        photoEv: camera.photoEv,
        zoomTarget: camera.zoomTarget,
        zoomActual: camera.zoomActual,
        zoomMax: camera.zoomMax,
        zoomMaxSource: camera.zoomMaxSource,
        manualMode: clone(camera.manualMode),
        sd: clone(camera.sd)
      },
      controls: {
        requested: clone(drone.userJoysticks),
        rcHardware: clone(drone.rcHardwareJoysticks),
        telemetryRc: {
          throttle: drone.telemetry.rcThrottle,
          yaw: drone.telemetry.rcYaw,
          pitch: drone.telemetry.rcPitch,
          roll: drone.telemetry.rcRoll
        },
        gimbal: {
          pitch: drone.telemetry.gimbalPitch,
          roll: drone.telemetry.gimbalRoll,
          yaw: drone.telemetry.gimbalYaw,
          controlPitch: drone.telemetry.gimbalControlPitch,
          pitchSpeed: drone.telemetry.gimbalPitchSpeedActual,
          rollSpeed: drone.telemetry.gimbalRollSpeed,
          yawSpeed: drone.telemetry.gimbalYawSpeed
        }
      },
      connection: clone(drone.connection),
      app: {
        version: APP_VERSION,
        metadataSchema: METADATA_SCHEMA
      },
      recognition: {
        processed: false,
        runs: []
      }
    }
  }
}
