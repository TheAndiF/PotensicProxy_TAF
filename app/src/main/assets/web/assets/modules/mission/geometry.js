import { ATOM1_CAPABILITIES, newWaypoint } from '../types/mission.js';
const R = 6371008.8;
const rad = (d) => d * Math.PI / 180;
const deg = (r) => r * 180 / Math.PI;
export function distanceMeters(a, b) {
    const dLat = rad(b.latitude - a.latitude);
    const dLon = rad(b.longitude - a.longitude);
    const p1 = rad(a.latitude), p2 = rad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function pathLengthMeters(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++)
        total += distanceMeters(points[i - 1], points[i]);
    return total;
}
export function destination(center, bearing, distance) {
    const a = distance / R, b = rad(bearing), lat1 = rad(center.latitude), lon1 = rad(center.longitude);
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(a) + Math.cos(lat1) * Math.sin(a) * Math.cos(b));
    const lon2 = lon1 + Math.atan2(Math.sin(b) * Math.sin(a) * Math.cos(lat1), Math.cos(a) - Math.sin(lat1) * Math.sin(lat2));
    return { latitude: deg(lat2), longitude: ((((deg(lon2) + 180) % 360) + 360) % 360) - 180 };
}
function withDefaults(points, template) {
    return points.map((p, i) => {
        const wp = newWaypoint(p.latitude, p.longitude, i + 1);
        if (template) {
            wp.altitude = template.altitude;
            wp.speed = template.speed;
            wp.yaw = template.yaw;
            wp.gimbalPitch = template.gimbalPitch;
            wp.zoom = template.zoom;
        }
        return wp;
    });
}
export function circle(center, radiusM, count, template) {
    const n = Math.max(3, Math.min(44, Math.round(count)));
    const pts = Array.from({ length: n }, (_, i) => destination(center, i * 360 / n, radiusM));
    pts.push({ ...pts[0] });
    return withDefaults(pts, template);
}
export function polygon(center, radiusM, sides, rotation = 0, template) {
    const n = Math.max(3, Math.min(44, Math.round(sides)));
    const pts = Array.from({ length: n }, (_, i) => destination(center, rotation + i * 360 / n, radiusM));
    pts.push({ ...pts[0] });
    return withDefaults(pts, template);
}
export function spiral(center, startRadiusM, endRadiusM, turns, count, template) {
    const n = Math.max(4, Math.min(200, Math.round(count)));
    const pts = Array.from({ length: n }, (_, i) => {
        const t = n === 1 ? 0 : i / (n - 1);
        return destination(center, 360 * turns * t, startRadiusM + (endRadiusM - startRadiusM) * t);
    });
    return withDefaults(pts, template);
}
export function grid(center, widthM, heightM, passSpacingM, heading = 0, template) {
    const across = heading + 90;
    const intervals = Math.max(1, Math.min(20, Math.ceil(widthM / Math.max(1, passSpacingM))));
    const actual = widthM / intervals;
    const left = destination(center, across + 180, widthM / 2);
    const corner = destination(left, heading + 180, heightM / 2);
    const pts = [];
    for (let i = 0; i <= intervals; i++) {
        const a = destination(corner, across, i * actual);
        const b = destination(a, heading, heightM);
        pts.push(...(i % 2 === 0 ? [a, b] : [b, a]));
    }
    return withDefaults(pts, template);
}
export function renumber(points) {
    points.forEach((p, i) => p.sequence = i + 1);
    return points;
}
export function validateMission(mission) {
    const issues = [];
    if (!mission.name.trim())
        issues.push({ level: 'warning', code: 'name', message: 'Die Mission hat keinen Namen.' });
    if (!mission.waypoints.length)
        return [{ level: 'error', code: 'empty', message: 'Die Mission enthält keine Wegpunkte.' }];
    mission.waypoints.forEach((wp, i) => {
        if (!Number.isFinite(wp.latitude) || wp.latitude < -90 || wp.latitude > 90 || !Number.isFinite(wp.longitude) || wp.longitude < -180 || wp.longitude > 180)
            issues.push({ level: 'error', code: `coord-${i}`, message: `Wegpunkt ${i + 1}: ungültige Koordinaten.` });
    });
    for (let i = 1; i < mission.waypoints.length; i++) {
        const d = distanceMeters(mission.waypoints[i - 1], mission.waypoints[i]);
        if (d < 1)
            issues.push({ level: 'warning', code: `spacing-${i}`, message: `Wegpunkte ${i} und ${i + 1} liegen weniger als 1 m auseinander.` });
        if (d > 500)
            issues.push({ level: 'warning', code: `long-${i}`, message: `Strecke ${i}→${i + 1} ist länger als 500 m.` });
    }
    if (mission.waypoints.length > ATOM1_CAPABILITIES.maxWaypointsPerRecord)
        issues.push({ level: 'info', code: 'chunk', message: `Die Mission wird beim ATOM-1-Export automatisch in Blöcke mit maximal ${ATOM1_CAPABILITIES.maxWaypointsPerRecord} Wegpunkten geteilt.` });
    if (mission.waypoints.some(w => w.altitude !== 0))
        issues.push({ level: 'info', code: 'alt', message: 'Höhe je Wegpunkt bleibt in TAF gespeichert; ATOM 1 setzt sie derzeit nicht pro Wegpunkt um.' });
    if (mission.waypoints.some(w => w.gimbalPitch !== 0))
        issues.push({ level: 'info', code: 'gimbal', message: 'Gimbalwerte bleiben in TAF gespeichert; ATOM 1 setzt sie derzeit nicht pro Wegpunkt um.' });
    if (mission.waypoints.some(w => w.zoom !== 1))
        issues.push({ level: 'info', code: 'zoom', message: 'Zoomwerte bleiben in TAF gespeichert; ATOM 1 setzt sie derzeit nicht pro Wegpunkt um.' });
    return issues;
}
