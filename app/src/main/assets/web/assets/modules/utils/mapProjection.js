export function worldPoint(longitude, latitude, zoom) {
    const n = 256 * Math.pow(2, zoom);
    const safeLatitude = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const x = (longitude + 180) / 360 * n;
    const s = Math.sin(safeLatitude * Math.PI / 180);
    const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    return { x, y };
}
export function geoPoint(x, y, zoom) {
    const n = 256 * Math.pow(2, zoom);
    const longitude = x / n * 360 - 180;
    const a = Math.PI * (1 - 2 * y / n);
    const latitude = 180 / Math.PI * Math.atan(Math.sinh(a));
    return { latitude, longitude };
}
export function screenPoint(latitude, longitude, centerLatitude, centerLongitude, zoom, width, height) {
    const center = worldPoint(centerLongitude, centerLatitude, zoom);
    const point = worldPoint(longitude, latitude, zoom);
    return { x: point.x - center.x + width / 2, y: point.y - center.y + height / 2 };
}
