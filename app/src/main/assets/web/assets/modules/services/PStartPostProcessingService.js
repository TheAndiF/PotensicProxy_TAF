import { AndroidMediaService } from './AndroidMediaService';
export class PStartPostProcessingService {
    static busy = false;
    static logLines = [];
    static record(level, step, image, detail) {
        this.logLines.push(JSON.stringify({ at: new Date().toISOString(), level, step, image, detail }));
    }
    static exportLog() {
        this.download(`PStart_analysis_${Date.now()}_log.jsonl`, new Blob([this.logLines.join('\n') + '\n'], { type: 'application/x-ndjson' }));
    }
    static download(name, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
    /** XMP APP1 is appended to a *copy* by inserting a valid APP1 block after the SOI. */
    static annotatedJpeg(raw, image, runId) {
        const payload = JSON.stringify({ schemaVersion: 1, algorithmVersion: 'series-worktree-1', runId, imageId: image.imageId,
            sourceSha256: image.imageSha256, timestampDeltaMs: image.timestampDeltaMs, targetHeightM: image.targetHeightM, actualHeightM: image.actualHeightM,
            centerPx: image.centerPx, outerCornersPx: image.outerCornersPx, homography: image.homography,
            quality: image.quality, status: image.status, warnings: image.warnings, patternScore: image.patternScore, candidateAmbiguous: image.candidateAmbiguous, seriesRole: image.seriesRole, seriesReferenceImageId: image.seriesReferenceImageId, seriesQualityScore: image.seriesQualityScore });
        const escaped = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const xml = `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:taf="https://potensicproxy.local/ns/pstart-analysis/1.0/" taf:SchemaVersion="1"><taf:AnalysisJson>${escaped}</taf:AnalysisJson></rdf:Description></rdf:RDF></x:xmpmeta>`;
        const xmp = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xml);
        if (xmp.length > 65533)
            throw new Error('XMP analysis segment exceeds JPEG APP1 limit');
        const src = new Uint8Array(raw);
        if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8)
            throw new Error('Invalid JPEG start of image');
        const out = new Uint8Array(src.length + xmp.length + 4);
        out.set(src.subarray(0, 2));
        out[2] = 0xff;
        out[3] = 0xe1;
        const len = xmp.length + 2;
        out[4] = len >>> 8;
        out[5] = len & 255;
        out.set(xmp, 6);
        out.set(src.subarray(2), 6 + xmp.length);
        return new Blob([out], { type: 'image/jpeg' });
    }
    static async saveAndroid(sessionId, name, blob) {
        const params = new URLSearchParams({ session: sessionId, name });
        const host = window.location.origin;
        const response = await fetch(`${host}/api/pstart/analysis/artifact?${params}`, { method: 'POST', body: blob });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.verified)
            throw new Error(`Android artifact save: ${result.error || response.status}`);
    }
    // Uses the File System Access API only where the browser provides explicit write consent.
    static async analyzeWritableFolder() {
        const picker = window.showDirectoryPicker;
        if (typeof picker !== 'function')
            throw new Error('Dieser Browser unterstützt keine beschreibbare Ordnerauswahl. Bitte den Android-Sitzungsordner verwenden.');
        const dir = await picker.call(window, { mode: 'readwrite' });
        const items = [];
        for await (const [name, handle] of dir.entries()) {
            if (handle.kind === 'file' && /\.jpe?g$/i.test(name) && !/_analysis_/i.test(name))
                items.push({ name, load: () => handle.getFile() });
        }
        return this.run('offline-import', items.sort((a, b) => a.name.localeCompare(b.name)), async (name, blob) => {
            const file = await dir.getFileHandle(name, { create: true });
            const stream = await file.createWritable();
            await stream.write(blob);
            await stream.close();
        });
    }
    static async requestAndroidFolder() {
        const r = await fetch('/api/pstart/saf/select', {method:'POST'});
        if (!r.ok) throw new Error('Android SAF picker: ' + await r.text());
    }
    static async analyzeAndroidFolder() {
        const status = await (await fetch('/api/pstart/saf/status', {cache:'no-store'})).json();
        if (status.state !== 'READY') throw new Error('Bitte Ordner am Handy freigeben: '+status.state);
        const response = await fetch('/api/pstart/saf/files', {cache:'no-store'});
        if (!response.ok) throw new Error(await response.text());
        const names = (await response.json()).files.sort((a,b)=>a.localeCompare(b));
        const first = names.map(n=>n.match(/^PStart_(.+?)_(?:STEP0|REF_\d+|REF0[0-5])_/i)).find(Boolean);
        return this.run(first?.[1] || 'offline-saf', names.map(name=>({name, load:async()=>{
            const r=await fetch('/api/pstart/saf/image?'+new URLSearchParams({name}), {cache:'no-store'});
            if(!r.ok) throw new Error('SAF read '+name+': '+await r.text());
            return r.blob();
        }})),async(name,blob)=>{
            const r=await fetch('/api/pstart/saf/artifact?'+new URLSearchParams({name}),{method:'POST',body:blob});
            const result=await r.json();
            if(!r.ok || !result.verified) throw new Error('SAF write '+name+': '+(result.error||r.status));
        });
    }
    static subscribers = new Set();
    static progress = { state: 'WAITING', completed: 0, total: 0, message: '' };
    static subscribe(cb) { this.subscribers.add(cb); cb(this.progress); return () => { this.subscribers.delete(cb); }; }
    static emit(value) { this.progress = value; this.subscribers.forEach(cb => cb(value)); }
    /** Automatic mode reads only images belonging to the completed session. Never sends flight commands. */
    static async analyzeSavedSession(sessionId) {
        const images = await AndroidMediaService.listImages('recognition');
        const selected = images.filter(i => i.name.startsWith(`PStart_${sessionId}_`) && /\.jpe?g$/i.test(i.name) && !/_analysis_/i.test(i.name));
        return this.run(sessionId, selected.map(i => ({ name: i.name, load: async () => {
                const response = await fetch(AndroidMediaService.imageUrl(i.id), { cache: 'no-store' });
                if (!response.ok)
                    throw new Error(`JPEG HTTP ${response.status}`);
                return response.blob();
            } })), (name, blob) => this.saveAndroid(sessionId, name, blob));
    }
    /** The browser's directory selector works offline, with no filesystem permission outside the chosen files. */
    static async analyzeFolder(files) {
        const selected = Array.from(files).sort((a, b) => a.name.localeCompare(b.name)).filter(f => /\.jpe?g$/i.test(f.name) && !/_analysis_/i.test(f.name));
        const first = selected[0]?.name.match(/^PStart_(.+?)_(?:STEP0|REF_\d+|REF0[0-5])_/i);
        return this.run(first?.[1] || 'offline-import', selected.map(f => ({ name: f.webkitRelativePath || f.name, load: async () => f })));
    }
    static exportProfile(profile) {
        this.download(`PStart_${profile.sessionId}_reference_${Date.now()}.json`, new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' }));
    }
    static async run(sessionId, items, save) {
        if (this.busy)
            throw new Error('Eine Referenzauswertung läuft bereits.');
        this.busy = true;
        this.logLines = [];
        const runId = new Date().toISOString().replace(/[^0-9]/g, '');
        this.record('INFO', 'START', '', `session=${sessionId}; images=${items.length}; writeAccess=${!!save}`);
        if (!items.length)
            this.record('WARN', 'EMPTY_INPUT', '', 'No JPEG images found');
        const refs = [];
        const pendingCopies = [];
        try {
            this.emit({ state: 'READING_XMP', completed: 0, total: items.length, message: 'JPEG und XMP prüfen' });
            const seen = new Set();
            for (const item of items) {
                const warnings = [];
                const ref = { imageId: item.name, imagePath: item.name, imageSha256: null, targetHeightM: null, actualHeightM: null, zoomRole: 'UNKNOWN', captureTimestampMs: null, telemetryTimestampMs: null, timestampDeltaMs: null, centerPx: null, outerCornersPx: null, homography: null, markerWidthPx: null, quality: { sharpness: null, contrast: null, detectionConfidence: null }, status: 'unverified', warnings };
                refs.push(ref);
                try {
                    const blob = await item.load();
                    const bytes = await blob.arrayBuffer();
                    if (bytes.byteLength < 4 || new DataView(bytes).getUint16(0) !== 0xffd8)
                        throw new Error('Ungültiger JPEG-Header');
                    const digest = await crypto.subtle.digest('SHA-256', bytes);
                    ref.imageSha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
                    if (seen.has(ref.imageSha256)) {
                        warnings.push('Duplikat (SHA-256)');
                        this.record('WARN', 'DUPLICATE', item.name, ref.imageSha256);
                        continue;
                    }
                    seen.add(ref.imageSha256);
                    this.record('INFO', 'JPEG_CHECK', item.name, `bytes=${bytes.byteLength}; sha256=${ref.imageSha256}`);
                    const metadata = this.readXmp(bytes);
                    if (!metadata)
                        warnings.push('XMP PayloadJson fehlt oder ist nicht lesbar');
                    const p = metadata?.pstart || {};
                    const fileZoom = /_(min|max|zero)\.jpe?g$/i.exec(item.name)?.[1]?.toUpperCase();
                    ref.zoomRole = fileZoom === 'MIN' || fileZoom === 'ZERO' ? 'MIN' : fileZoom === 'MAX' ? 'MAX' : String(p.zoomRole || 'UNKNOWN').toUpperCase();
                    ref.targetHeightM = this.num(p.targetHeight);
                    ref.actualHeightM = this.num(p.relativeHeight);
                    ref.captureTimestampMs = this.num(metadata?.capture?.timestampUnixMs);
                    ref.telemetryTimestampMs = this.num(metadata?.telemetry?.timestampUnixMs ?? metadata?.telemetry?.timestamp);
                    if (ref.captureTimestampMs != null && ref.telemetryTimestampMs != null) {
                        ref.timestampDeltaMs = ref.captureTimestampMs - ref.telemetryTimestampMs;
                        if (Math.abs(ref.timestampDeltaMs) > 1000)
                            warnings.push(`Zeitversatz Kamera/Telemetrie ${ref.timestampDeltaMs} ms (>1000 ms)`);
                    }
                    if (ref.actualHeightM != null && ref.targetHeightM != null && Math.abs(ref.actualHeightM - ref.targetHeightM) > 1)
                        warnings.push(`Hoehenabweichung ${Math.round((ref.actualHeightM - ref.targetHeightM) * 100) / 100} m`);
                    if (p.sessionId && p.sessionId !== sessionId)
                        warnings.push('Abweichende Sitzungskennung im XMP');
                    if (p.referenceEligible === false)
                        warnings.push('Laut PStart nicht als Referenz geeignet');
                    if (ref.captureTimestampMs == null)
                        warnings.push('Aufnahmezeitstempel fehlt');
                    if (ref.targetHeightM == null)
                        warnings.push('Sollhöhe fehlt');
                    this.emit({ state: 'DETECTING_MARKER', completed: refs.length - 1, total: items.length, message: item.name });
                    // STEP0 is metadata-only; MAX captures are placeholders until true optical zoom is implemented.
                    const isStep0 = /_STEP0_/i.test(item.name) || ref.targetHeightM === 0;
                    const isPlaceholderZoom = ref.zoomRole === 'MAX';
                    if (isStep0 || isPlaceholderZoom) {
                        ref.status = 'unverified';
                        const reason = isStep0 ? 'STEP0: XMP only; optical analysis intentionally skipped' : 'MAX zoom placeholder: optical analysis intentionally skipped';
                        warnings.push(reason);
                        this.record('INFO', isStep0 ? 'METADATA_ONLY_STEP0' : 'ZOOM_PLACEHOLDER', item.name, reason);
                    } else {
                        const step0 = /(?:^|_)(?:STEP0|REF00)(?:_|\.)/i.test(item.name);
          const opticalReference = /(?:^|_)(?:REF_[0-4]|REF0[1-5])(?:_|\.)/i.test(item.name);
          const placeholderZoom = ref.zoomRole === 'MAX' || /_max\.jpe?g$/i.test(item.name);
          if (step0) { ref.warnings.push('STEP0: ausschließlich Metadaten; keine optische Analyse'); this.record('INFO', 'METADATA_ONLY', item.name, 'STEP0 skipped optical analysis'); }
          else if (placeholderZoom) { ref.warnings.push('MAX-Zoom-Platzhalter: aus optischer Auswertung ausgeschlossen'); this.record('INFO', 'ZOOM_PLACEHOLDER', item.name, 'MAX excluded pending verified optical zoom'); }
          else if (!opticalReference) { ref.warnings.push('Nicht erkannte Referenzrolle; keine optische Analyse'); this.record('WARN', 'UNKNOWN_ROLE', item.name, 'REF_0..REF_4 expected'); }
          else { await this.measure(blob, ref); };
                    }
                    if (ref.timestampDeltaMs != null)
                        this.record(Math.abs(ref.timestampDeltaMs) > 1000 ? 'WARN' : 'INFO', 'TIMESTAMP_DELTA', item.name, `${ref.timestampDeltaMs} ms`);
                    this.record('INFO', 'MEASURE', item.name, `status=${ref.status}; center=${JSON.stringify(ref.centerPx)}; warnings=${warnings.join(';')}`);
                    // Do not persist image-specific results until the complete series is ranked.
                    if (save)
                        pendingCopies.push({ name: item.name, bytes, ref });
                }
                catch (e) {
                    ref.status = 'error';
                    warnings.push(e instanceof Error ? e.message : String(e));
                    this.record('ERROR', 'IMAGE', item.name, String(e));
                }
                this.emit({ state: 'CHECKING_IMAGES', completed: refs.length, total: items.length, message: item.name });
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            // A single ascent is one dataset. Select its strongest eligible close image;
            // never transfer pixel positions between altitudes or zoom roles.
            const series = this.evaluateSeries(refs);
            this.record(series.anchorImageId ? 'INFO' : 'WARN', 'SERIES_ANCHOR', series.anchorImageId || '', JSON.stringify(series));
            if (save) {
                for (const copy of pendingCopies) {
                    try {
                        const safeName = copy.name.split('/').pop().replace(/\.jpe?g$/i, '');
                        const name = `${safeName}_analysis_${runId}.jpg`;
                        await save(name, this.annotatedJpeg(copy.bytes, copy.ref, runId));
                        this.record('INFO', 'SAVE_XMP_COPY', copy.name, name);
                    }
                    catch (e) {
                        copy.ref.warnings.push('Analysierte XMP-Kopie konnte nicht gespeichert werden');
                        this.record('ERROR', 'SAVE_XMP_COPY', copy.name, String(e));
                    }
                }
            }
            const valid = refs.filter(r => r.status === 'candidate' && /(?:^|_)(?:REF_[0-4]|REF0[1-5])(?:_|\.)/i.test(r.imagePath) && r.zoomRole !== 'MAX').length;
            const profile = { schemaVersion: '1.0', algorithmVersion: 'series-worktree-1', sessionId, analysisStatus: 'completed', marker: { modelId: 'cross-800-v1', widthMm: 800, heightMm: 800, blackLineWidthMm: 50, targetMm: [400, 400] }, camera: { calibrationId: null, gimbalTargetDeg: -90 }, references: refs, landingReadiness: { status: valid && series.anchorImageId ? 'LIMITED' : 'NOT_READY', reasons: ['Geometrie ohne verifizierte Rahmenpunkte und Kamera-Kalibrierung ist nicht für automatische PLanding-Steuerung freigegeben.', ...(valid ? [] : ['Kein plausibler Kreuzmittelpunkt gefunden.'])] }, generatedAt: new Date().toISOString(), seriesAnalysis: series };
            try {
                localStorage.setItem('taf.pstart.analysis.latest', JSON.stringify(profile));
            }
            catch { /* storage optional */ }
            this.record('INFO', 'COMPLETE', '', `${refs.length} images; ${valid} candidates; anchor=${series.anchorImageId || "none"}`);
            if (save) {
                for (const [name, data, mime] of [
                    [`PStart_analysis_${runId}_profile.json`, JSON.stringify(profile, null, 2), 'application/json'],
                    [`PStart_analysis_${runId}_log.jsonl`, this.logLines.join('\n') + '\n', 'application/x-ndjson'],
                ]) {
                    try {
                        await save(name, new Blob([data], { type: mime }));
                    }
                    catch (e) {
                        this.record('ERROR', 'SAVE_RESULT', name, String(e));
                        profile.analysisStatus = 'completed_with_save_errors';
                    }
                }
            }
            else {
                this.record('WARN', 'READ_ONLY_FOLDER', '', 'Browser file input has no directory write permission; export manually or use writable-folder mode');
            }
            this.emit({ state: profile.analysisStatus !== 'completed' || refs.some(r => r.warnings.length) ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED', completed: refs.length, total: items.length, message: `${valid} Kreuz-Kandidaten; keine Flugfreigabe`, profile });
            return profile;
        }
        catch (e) {
            this.record('ERROR', 'RUN', '', String(e));
            this.emit({ state: 'FAILED', completed: refs.length, total: items.length, message: String(e) });
            throw e;
        }
        finally {
            this.busy = false;
        }
    }
    /** Ranking is observational: a clear near-image is the reference for pattern identity,
     * not a claimed camera extrinsic transform or a replacement for per-image localization. */
    static evaluateSeries(refs) {
        const measured = refs.filter(r => /(?:^|_)(?:REF_[0-4]|REF0[1-5])(?:_|\.)/i.test(r.imagePath) && r.zoomRole !== 'MAX' && r.status === 'candidate' && r.centerPx && r.outerCornersPx?.length === 4 && r.targetHeightM != null && r.targetHeightM > 0);
        for (const ref of refs) {
            ref.seriesRole = 'unverified';
            ref.seriesReferenceImageId = null;
            const sharp = ref.quality.sharpness == null ? 0 : Math.min(1, ref.quality.sharpness / 40);
            const contrast = ref.quality.contrast ?? 0;
            const pattern = ref.patternScore ?? 0;
            ref.seriesQualityScore = ref.status === 'candidate' && ref.outerCornersPx?.length === 4
                ? Math.round(1000 * (0.70 * pattern + 0.15 * sharp + 0.15 * contrast - (ref.candidateAmbiguous ? 0.25 : 0))) / 1000
                : null;
        }
        const heights = measured.map(r => r.targetHeightM).sort((a, b) => a - b);
        const lowest = heights[0];
        const near = measured.filter(r => r.targetHeightM === lowest && !r.candidateAmbiguous);
        near.sort((a, b) => (b.seriesQualityScore ?? -1) - (a.seriesQualityScore ?? -1) || a.imageId.localeCompare(b.imageId));
        const anchor = near[0] || null;
        const warnings = [];
        if (!anchor)
            warnings.push('Keine eindeutige geometrische Nahreferenz; Serienzuordnung nicht bestaetigt');
        if (anchor) {
            anchor.seriesRole = 'anchor';
            anchor.seriesReferenceImageId = anchor.imageId;
            for (const ref of measured) {
                if (ref === anchor)
                    continue;
                ref.seriesReferenceImageId = anchor.imageId;
                // Appearance evidence is independent of positional geometry: no false corroboration.
                if (!ref.candidateAmbiguous && (ref.patternScore ?? 0) >= 0.52)
                    ref.seriesRole = 'corroborated';
                else
                    ref.warnings.push('Serienreferenz vorhanden, aber lokale Markererkennung mehrdeutig oder schwach');
            }
        }
        for (const ref of refs)
            this.record('INFO', 'SERIES_EVALUATION', ref.imageId, JSON.stringify({ role: ref.seriesRole, anchor: ref.seriesReferenceImageId, score: ref.seriesQualityScore, height: ref.targetHeightM, zoom: ref.zoomRole }));
        return { anchorImageId: anchor?.imageId ?? null, anchorHeightM: anchor?.targetHeightM ?? null,
            anchorPatternScore: anchor?.patternScore ?? null, evaluatedImages: refs.length, warnings };
    }
    static num(value) { if (value == null || value === '')
        return null; const n = Number(value); return Number.isFinite(n) ? n : null; }
    static readXmp(bytes) {
        const data = new Uint8Array(bytes);
        let at = 2;
        while (at + 4 < data.length) {
            if (data[at] !== 0xff)
                break;
            const marker = data[at + 1];
            if (marker === 0xda || marker === 0xd9)
                break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                at += 2;
                continue;
            }
            const length = (data[at + 2] << 8) + data[at + 3];
            if (length < 2 || at + 2 + length > data.length)
                break;
            if (marker === 0xe1) {
                const text = new TextDecoder().decode(data.subarray(at + 4, at + 2 + length));
                const match = /<(?:[\w.-]+:)?PayloadJson>([\s\S]*?)<\/(?:[\w.-]+:)?PayloadJson>/.exec(text);
                if (match) {
                    try {
                        return JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
                    }
                    catch {
                        return null;
                    }
                }
            }
            at += 2 + length;
        }
        return null;
    }
    /** Deliberately conservative: cross-line candidate only, not a verified fiducial pose. */
    static async measure(blob, ref) {
        // Prefer the Android-native OpenCV detector, including for offline imported JPEGs.
        // Fail closed when geometry is incomplete or Android backend is not reachable.
        try {
            const result = await fetch('/api/pstart/analysis/opencv', { method: 'POST', body: blob });
            if (!result.ok)
                throw new Error(`OpenCV HTTP ${result.status}`);
            const geometry = await result.json();
            this.record('INFO', 'OPENCV', ref.imageId, JSON.stringify({ status: geometry.status, engine: geometry.engine, patternScore: geometry.patternScore, candidateCount: geometry.candidateCount, candidateAmbiguous: geometry.candidateAmbiguous, warnings: geometry.warnings }));
            ref.patternScore = this.num(geometry.patternScore);
            ref.candidateAmbiguous = geometry.candidateAmbiguous === true;
            if (geometry.status === 'BOUNDARY_CANDIDATE' && Array.isArray(geometry.outerCornersPx) && Array.isArray(geometry.centerPx)) {
                ref.outerCornersPx = geometry.outerCornersPx;
                ref.homography = geometry.homographyImageToMarkerMm || null;
                ref.centerPx = geometry.centerPx;
                ref.status = 'candidate';
                if (geometry.candidateAmbiguous)
                    ref.warnings.push('Mehrdeutige geometrische Markerkandidaten');
                ref.quality.detectionConfidence = null; // uncalibrated until cross, width and orientation verified
                ref.warnings.push(...(geometry.warnings || []));
                return;
            }
            ref.warnings.push('OpenCV: no geometrically suitable quadrilateral found');
        }
        catch (error) {
            this.record('WARN', 'OPENCV_UNAVAILABLE', ref.imageId, String(error));
            ref.warnings.push('OpenCV backend unavailable; fallback is not a geometric verification');
        }
        await this.measureFallback(blob, ref);
    }
    static async measureFallback(blob, ref) {
        const bitmap = await createImageBitmap(blob);
        try {
            const factor = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
            const w = Math.max(1, Math.round(bitmap.width * factor)), h = Math.max(1, Math.round(bitmap.height * factor));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx)
                throw new Error('Canvas-Kontext fehlt');
            ctx.drawImage(bitmap, 0, 0, w, h);
            const pixels = ctx.getImageData(0, 0, w, h).data;
            const gray = new Uint8Array(w * h);
            let lo = 255, hi = 0, sharp = 0, count = 0;
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) {
                    const p = y * w + x, i = p * 4;
                    const v = Math.round(pixels[i] * .299 + pixels[i + 1] * .587 + pixels[i + 2] * .114);
                    gray[p] = v;
                    lo = Math.min(lo, v);
                    hi = Math.max(hi, v);
                    if (x > 0 && y > 0) {
                        sharp += Math.abs(v - gray[p - 1]) + Math.abs(v - gray[p - w]);
                        count += 2;
                    }
                }
            ref.quality.sharpness = count ? Math.round(100 * sharp / count) / 100 : null;
            ref.quality.contrast = (hi - lo) / 255;
            const threshold = lo + (hi - lo) * .4;
            const row = new Float64Array(h), col = new Float64Array(w);
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) {
                    if (gray[y * w + x] < threshold) {
                        row[y]++;
                        col[x]++;
                    }
                }
            // Select strongest central lines, then require strong contrast against nearby lines.
            const mx = (values, a, b) => { let best = a; for (let i = a + 1; i < b; i++)
                if (values[i] > values[best])
                    best = i; return best; };
            const cx = mx(col, Math.floor(w * .15), Math.ceil(w * .85)), cy = mx(row, Math.floor(h * .15), Math.ceil(h * .85));
            const baselineX = col[Math.max(0, cx - Math.floor(w * .12))], baselineY = row[Math.max(0, cy - Math.floor(h * .12))];
            const strength = Math.min((col[cx] - baselineX) / Math.max(1, h), (row[cy] - baselineY) / Math.max(1, w));
            ref.quality.detectionConfidence = Math.max(0, Math.min(0.5, strength)); // candidate confidence cap
            if (strength > .12 && hi - lo > 45) {
                ref.centerPx = [Math.round(cx / factor * 10) / 10, Math.round(cy / factor * 10) / 10];
                ref.status = 'candidate';
                ref.warnings.push('Kreuz-Kandidat; Rahmen, Perspektive und Orientierung nicht verifiziert');
            }
            else
                ref.warnings.push('Kein hinreichend eindeutiges Kreuz erkannt');
        }
        finally {
            bitmap.close();
        }
    }
}
