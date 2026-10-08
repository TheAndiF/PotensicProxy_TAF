import { FRONTEND_VERSION } from '../version'
import { useCameraStore } from '../stores/useCameraStore'
import { useDroneStore } from '../stores/useDroneStore'

export type PStartImageRole = 'PSTART_DOCUMENTATION' | 'PSTART_REFERENCE'
export type PStartZoomRole = 'ZERO' | 'MAX'

export type PStartCaptureContext = {
  sessionId: string
  stepId: string
  referenceIndex: number
  targetHeight: number | null
  startVerticalDistance: number
  startLatitude: number
  startLongitude: number
  startHeading: number
  hoverHeight: number
  imageRole: PStartImageRole
  referenceEligible: boolean
  referenceReason?: string
  zoomRole: PStartZoomRole
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export class PrecisionStartMetadataService {
  static build(context: PStartCaptureContext): Record<string, unknown> {
    const drone = useDroneStore()
    const camera = useCameraStore()
    const now = Date.now()
    const relativeHeight = Number(drone.telemetry.verticalDistance || 0) - Number(context.startVerticalDistance || 0)
    const homeOffset = this.distanceMeters(context.startLatitude, context.startLongitude, Number(drone.telemetry.latitude || 0), Number(drone.telemetry.longitude || 0))

    return {
      schemaVersion: 1,
      source: 'PSTART',
      capture: {
        timestampUnixMs: now,
        timestampIso: new Date(now).toISOString(),
      },
      pstart: {
        schema: 'PotensicProxy/PStart',
        schemaVersion: '1.0',
        sessionId: context.sessionId,
        stepId: context.stepId,
        referenceIndex: context.referenceIndex,
        targetHeight: context.targetHeight,
        startVerticalDistance: context.startVerticalDistance,
        startLatitude: context.startLatitude,
        startLongitude: context.startLongitude,
        startHeading: context.startHeading,
        hoverHeight: context.hoverHeight,
        relativeHeight,
        homeOffset,
        imageRole: context.imageRole,
        referenceEligible: context.referenceEligible,
        referenceReason: context.referenceReason || '',
        zoomRole: context.zoomRole,
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
        sd: clone(camera.sd),
      },
      controls: {
        requested: clone(drone.userJoysticks),
        rcHardware: clone(drone.rcHardwareJoysticks),
        telemetryRc: {
          throttle: drone.telemetry.rcThrottle,
          yaw: drone.telemetry.rcYaw,
          pitch: drone.telemetry.rcPitch,
          roll: drone.telemetry.rcRoll,
        },
        gimbal: {
          pitch: drone.telemetry.gimbalPitch,
          roll: drone.telemetry.gimbalRoll,
          yaw: drone.telemetry.gimbalYaw,
          controlPitch: drone.telemetry.gimbalControlPitch,
          pitchSpeed: drone.telemetry.gimbalPitchSpeedActual,
          rollSpeed: drone.telemetry.gimbalRollSpeed,
          yawSpeed: drone.telemetry.gimbalYawSpeed,
        },
      },
      connection: clone(drone.connection),
      app: {
        version: FRONTEND_VERSION,
        metadataSchema: 1,
      },
    }
  }

  private static distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number | null {
    if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null
    if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) return null
    const rad = Math.PI / 180
    const p1 = lat1 * rad
    const p2 = lat2 * rad
    const dLat = (lat2 - lat1) * rad
    const dLon = (lon2 - lon1) * rad
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }
}
