import { useDroneStore } from '../stores/useDroneStore.js';
export class AndroidMediaService {
    static baseUrl() {
        const host = useDroneStore().normalizedHost;
        const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
        return `${protocol}//${host}`;
    }
    static async saveLiveSnapshot(metadata) {
        const response = await fetch(`${this.baseUrl()}/api/media/snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: metadata ? JSON.stringify(metadata) : '{}'
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body?.error || `HTTP ${response.status}`);
        const saved = body;
        window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }));
        return saved;
    }
    static async savePrecisionSnapshot(metadata, fileName, source, sessionId) {
        const params = new URLSearchParams({ library: 'recognition', source, name: fileName, session: sessionId });
        const response = await fetch(`${this.baseUrl()}/api/media/snapshot?${params.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body?.error || `HTTP ${response.status}`);
        const saved = body;
        window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }));
        return saved;
    }
    static async finalizePrecisionSession(payload) {
        const response = await fetch(`${this.baseUrl()}/api/pstart/session/finalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body?.error || `HTTP ${response.status}`);
        return body;
    }
    static async saveCockpitSnapshot() {
        const response = await fetch(`${this.baseUrl()}/api/media/snapshot?library=camera&source=cockpit-snapshot`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body?.error || `HTTP ${response.status}`);
        const saved = body;
        window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }));
        return saved;
    }
    static async saveImageBytes(blob, fileName, source = 'camera-download', library = 'camera', metadata) {
        const params = new URLSearchParams({ name: fileName, source, library });
        if (metadata)
            params.set('metadata', JSON.stringify(metadata));
        const response = await fetch(`${this.baseUrl()}/api/media/import?${params.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': blob.type || 'application/octet-stream' },
            body: blob
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok)
            throw new Error(body?.error || `HTTP ${response.status}`);
        const saved = body;
        window.dispatchEvent(new CustomEvent('taf-android-media-saved', { detail: saved }));
        return saved;
    }
    static async listImages(library) {
        const params = library ? `?library=${encodeURIComponent(library)}` : '';
        const response = await fetch(`${this.baseUrl()}/api/media/local${params}`, { cache: 'no-store' });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }
    static imageUrl(id) {
        return `${this.baseUrl()}/api/media/local/${encodeURIComponent(id)}`;
    }
}
