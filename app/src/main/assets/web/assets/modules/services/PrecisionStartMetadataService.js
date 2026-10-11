import { FRONTEND_VERSION } from '../version.js';
import { useCameraStore } from '../stores/useCameraStore.js';
import { useDroneStore } from '../stores/useDroneStore.js';
const clone = (value) => JSON.parse(JSON.stringify(value));
export class PrecisionStartMetadataService {
    static build(context) {
        const drone = useDroneStore();
        const camera = useCameraStore();
        const now = Date.now();
        const relativeHeight = Number(drone.telemetry.verticalDistance || 0) - Number(context.startVerticalDistance || 0);
        const homeOffset = this.homeOffsetMeters(context.startLatitude, context.startLongitude, Number(drone.telemetry.latitude || 0), Number(drone.telemetry.longitude || 0));
        const horizontalSpeed = Math.abs(Number(drone.telemetry.horizontalSpeed || 0));
        const verticalSpeed = Math.abs(Number(drone.telemetry.verticalSpeed || 0));
        const positionWarning = homeOffset != null && homeOffset > context.positionWarningMeters;
        const motionWarning = horizontalSpeed > 1.0 || verticalSpeed > 0.35;
        const qualityStatus = positionWarning && motionWarning
            ? 'WARNING_POSITION_MOTION'
            : positionWarning
                ? 'WARNING_POSITION'
                : motionWarning ? 'WARNING_MOTION' : 'GOOD';
        const sessionMaster = context.stepId === 'STEP0' && context.zoomRole === 'ZERO';
        const sessionProtocolFile = `PStart_${context.sessionId}_session.jsonl`;
        const sessionMasterImage = `PStart_${context.sessionId}_STEP0_step0_zero.jpg`;
        return {
            schemaVersion: 2,
            source: 'PSTART',
            capture: {
                timestampUnixMs: now,
                timestampIso: new Date(now).toISOString(),
            },
            pstart: {
                schema: 'PotensicProxy/PStart',
                schemaVersion: '1.1',
                sessionId: context.sessionId,
                stepId: context.stepId,
                stageId: context.stepId,
                referenceIndex: context.referenceIndex,
                targetHeight: context.targetHeight,
                heightError: context.targetHeight == null ? null : relativeHeight - context.targetHeight,
                startVerticalDistance: context.startVerticalDistance,
                startLatitude: context.startLatitude,
                startLongitude: context.startLongitude,
                startHeading: context.startHeading,
                hoverHeight: context.hoverHeight,
                relativeHeight,
                homeOffset,
                positionWarningMeters: context.positionWarningMeters,
                positionAbortMeters: context.positionAbortMeters,
                positionQuality: homeOffset == null ? 'UNKNOWN' : homeOffset > context.positionWarningMeters ? 'WARNING_POSITION' : 'GOOD',
                qualityStatus,
                gpsQuality: drone.telemetry.receiveGps && drone.telemetry.gpsLocationValid && !drone.telemetry.gpsInterference ? 'VALID' : 'INVALID',
                imageRole: context.imageRole,
                referenceEligible: context.referenceEligible,
                referenceReason: context.referenceReason || '',
                zoomRole: context.zoomRole,
                pstartThrottleCommand: context.pstartThrottleCommand,
                sessionMaster,
                sessionMasterImage,
                sessionProtocolFile,
                sessionProtocolFormat: 'JSONL',
                sessionProtocolEmbeddedInMaster: 'APP15_CHUNKED_GZIP_ON_FINALIZE',
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
                pstart: {
                    throttleCommand: context.pstartThrottleCommand,
                    yawCommand: 0,
                    pitchCommand: 0,
                    rollCommand: 0,
                },
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
                metadataSchema: 2,
            },
        };
    }
    static homeOffsetMeters(lat1, lon1, lat2, lon2) {
        if (![lat1, lon1, lat2, lon2].every(Number.isFinite))
            return null;
        if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0))
            return null;
        const rad = Math.PI / 180;
        const p1 = lat1 * rad;
        const p2 = lat2 * rad;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
}
