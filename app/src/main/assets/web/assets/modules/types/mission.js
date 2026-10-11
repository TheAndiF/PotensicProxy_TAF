export const ATOM1_CAPABILITIES = {
    maxWaypointsPerRecord: 45,
    waypointAltitude: false,
    waypointYaw: false,
    waypointGimbal: false,
    waypointZoom: false,
    waypointCameraAction: false,
};
export function newWaypoint(latitude, longitude, sequence) {
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
    };
}
export function newMission() {
    const now = new Date().toISOString();
    return {
        version: 1,
        id: `mission-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: 'Neue Mission',
        aircraftProfile: 'ATOM_1',
        createdAt: now,
        updatedAt: now,
        waypoints: [],
        geometry: { kind: 'manual' }
    };
}
