export type MissionAction = 'none' | 'hover' | 'rth' | 'land'
export type CameraAction = 'none' | 'photo' | 'start-record' | 'stop-record'

export interface MissionWaypoint {
  id: string
  sequence: number
  latitude: number
  longitude: number
  altitude: number
  speed: number
  yaw: number
  gimbalPitch: number
  zoom: number
  dwellTime: number
  action: MissionAction
  cameraAction: CameraAction
  label?: string
  notes?: string
}

export interface MissionGeometry {
  kind: 'manual' | 'line' | 'circle' | 'polygon' | 'grid' | 'spiral' | 'star'
  center?: { latitude: number; longitude: number }
  parameters?: Record<string, number | string | boolean>
}

export interface TAFMission {
  version: number
  id: string
  name: string
  aircraftProfile: 'ATOM_1' | string
  createdAt: string
  updatedAt: string
  home?: { latitude: number; longitude: number; altitude?: number }
  waypoints: MissionWaypoint[]
  geometry?: MissionGeometry
  metadata?: Record<string, unknown>
}

export interface MissionSummary {
  id: string
  name: string
  aircraftProfile: string
  waypointCount: number
  updatedAt: string
}

export interface MissionValidationIssue {
  level: 'error' | 'warning' | 'info'
  code: string
  message: string
}

export const ATOM1_CAPABILITIES = {
  maxWaypointsPerRecord: 45,
  waypointAltitude: false,
  waypointYaw: false,
  waypointGimbal: false,
  waypointZoom: false,
  waypointCameraAction: false,
} as const

export function newWaypoint(latitude: number, longitude: number, sequence: number): MissionWaypoint {
  return {
    id: `wp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sequence,
    latitude,
    longitude,
    altitude: 30,
    speed: 3,
    yaw: 0,
    gimbalPitch: 0,
    zoom: 1,
    dwellTime: 0,
    action: 'none',
    cameraAction: 'none'
  }
}

export function newMission(): TAFMission {
  const now = new Date().toISOString()
  return {
    version: 1,
    id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: 'Neue Mission',
    aircraftProfile: 'ATOM_1',
    createdAt: now,
    updatedAt: now,
    waypoints: [],
    geometry: { kind: 'manual' }
  }
}
