import { useDroneStore } from '../stores/useDroneStore.js';
import { FRONTEND_VERSION } from '../version.js';
export const MAP_CONFIG_CHANGED_EVENT = 'potensic-map-config-changed';
function baseUrl() {
    // Map APIs belong to the same Android/Ktor backend that served the WebUI.
    // Do not follow the configurable drone/relay target here: that setting may
    // legitimately point to another host and would make map requests fail with
    // NetworkError/CORS errors even though the local WebUI is still loaded.
    // Keep the Vite development workflow usable by forwarding map calls to the
    // configured target while running the frontend dev server.
    if (window.location.port === '5173') {
        const store = useDroneStore();
        const proto = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${proto}//${store.normalizedHost}`;
    }
    return window.location.origin;
}
async function errorText(r) {
    try {
        const body = await r.json();
        return body?.error || `HTTP ${r.status}`;
    }
    catch {
        return `HTTP ${r.status}`;
    }
}
function broadcastConfig(config) {
    window.dispatchEvent(new CustomEvent(MAP_CONFIG_CHANGED_EVENT, { detail: config }));
}
async function regionAction(id, action) {
    const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}/${action}`, { method: 'POST' });
    if (!r.ok)
        throw new Error(await errorText(r));
    return r.json();
}
export const MapService = {
    async getVersion() {
        const r = await fetch(`${baseUrl()}/api/version`);
        if (!r.ok)
            throw new Error(await errorText(r));
        const backendVersion = await r.json();
        // Frontend version comes from the actually running web bundle, not a backend copy.
        return { ...backendVersion, webUiVersion: FRONTEND_VERSION };
    },
    async getConfig() {
        const r = await fetch(`${baseUrl()}/api/map/config`);
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async saveConfig(config) {
        const r = await fetch(`${baseUrl()}/api/map/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!r.ok)
            throw new Error(await errorText(r));
        const saved = await r.json();
        broadcastConfig(saved);
        return saved;
    },
    async testConfig(config) {
        const r = await fetch(`${baseUrl()}/api/map/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    tileUrl(z, x, y, revision) {
        const suffix = revision === undefined ? '' : `?rev=${encodeURIComponent(String(revision))}`;
        return `${baseUrl()}/api/map/tiles/${z}/${x}/${y}${suffix}`;
    },
    async temporaryCache() {
        const r = await fetch(`${baseUrl()}/api/map/cache/temporary`);
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async clearTemporaryCache() {
        const r = await fetch(`${baseUrl()}/api/map/cache/temporary`, { method: 'DELETE' });
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async regions() {
        const r = await fetch(`${baseUrl()}/api/map/regions`);
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async downloadRegion(region) {
        const r = await fetch(`${baseUrl()}/api/map/regions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(region)
        });
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async updateRegion(id) {
        return regionAction(id, 'update');
    },
    async reloadRegion(id) {
        return regionAction(id, 'reload');
    },
    async clearRegionTiles(id) {
        const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}/tiles`, { method: 'DELETE' });
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async region(id) {
        const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}`);
        if (!r.ok)
            throw new Error(await errorText(r));
        return r.json();
    },
    async deleteRegion(id) {
        const r = await fetch(`${baseUrl()}/api/map/regions/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!r.ok && r.status !== 204)
            throw new Error(await errorText(r));
    }
};
