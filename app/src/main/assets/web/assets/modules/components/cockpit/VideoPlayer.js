import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { createCommentVNode as _createCommentVNode, vShow as _vShow, createElementVNode as _createElementVNode, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock, unref as _unref, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, renderList as _renderList, Fragment as _Fragment, createTextVNode as _createTextVNode, normalizeStyle as _normalizeStyle, vModelSelect as _vModelSelect } from '../../../vendor/vue.js';
const _hoisted_1 = { class: "video-viewport" };
const _hoisted_2 = ["src"];
const _hoisted_3 = {
    key: 1,
    class: "video-placeholder"
};
const _hoisted_4 = { class: "placeholder-title" };
const _hoisted_5 = { class: "placeholder-desc" };
const _hoisted_6 = { class: "diag-checklist" };
const _hoisted_7 = { class: "diag-item" };
const _hoisted_8 = { class: "diag-label" };
const _hoisted_9 = { class: "diag-item" };
const _hoisted_10 = { class: "diag-label" };
const _hoisted_11 = { class: "diag-item" };
const _hoisted_12 = { class: "diag-label" };
const _hoisted_13 = { class: "diag-item" };
const _hoisted_14 = { class: "diag-label" };
const _hoisted_15 = {
    key: 0,
    class: "diag-item"
};
const _hoisted_16 = { class: "diag-label" };
const _hoisted_17 = { class: "diag-muted fe-traffic-list" };
const _hoisted_18 = {
    key: 1,
    class: "diag-item"
};
const _hoisted_19 = { class: "diag-label" };
const _hoisted_20 = { class: "diag-item" };
const _hoisted_21 = { class: "diag-label" };
const _hoisted_22 = {
    key: 2,
    class: "diag-item"
};
const _hoisted_23 = { class: "diag-label" };
const _hoisted_24 = { class: "placeholder-actions" };
const _hoisted_25 = {
    key: 2,
    class: "landing-crosshair",
    "aria-hidden": "true"
};
const _hoisted_26 = {
    key: 3,
    class: "pport-model-overlay",
    "aria-label": "PLand Mustermodelle, nur Anzeige"
};
const _hoisted_27 = ["src"];
const _hoisted_28 = ["src"];
const _hoisted_29 = { class: "pport-marker-status" };
const _hoisted_30 = {
    key: 4,
    class: "video-osd"
};
const _hoisted_31 = { class: "osd-left" };
const _hoisted_32 = { class: "osd-tag" };
const _hoisted_33 = {
    key: 0,
    class: "osd-tag"
};
const _hoisted_34 = {
    key: 1,
    class: "osd-tag"
};
const _hoisted_35 = {
    key: 2,
    class: "osd-tag highlight-tag"
};
const _hoisted_36 = ["title"];
const _hoisted_37 = {
    key: 0,
    class: "drawer-actions"
};
const _hoisted_38 = {
    class: "osd-action-btn",
    for: "pland-model-mode"
};
const _hoisted_39 = ["title"];
import { ref, reactive, onMounted, onUnmounted, computed, watch } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { VideoExtractor } from '../../protocol/VideoExtractor.js';
import { WebCodecsPlayer } from '../../video/WebCodecsPlayer.js';
import { useI18n } from '../../i18n/index.js';
import { useLandingAssistSettings } from '../../composables/useLandingAssistSettings.js';
import { usePrecisionStartStore } from '../../stores/usePrecisionStartStore.js';
const idealMarkerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 560"><rect x="80" y="80" width="400" height="400" fill="white"/><rect x="94" y="94" width="372" height="372" fill="none" stroke="#111" stroke-width="24"/><path d="M396 396H466V466H396Z" fill="#111"/><rect x="185" y="185" width="190" height="190" fill="none" stroke="#222" stroke-width="10"/><path d="M280 222V338M222 280H338" stroke="#222" stroke-width="12"/></svg>`;
export default /*@__PURE__*/ _defineComponent({
    __name: 'VideoPlayer',
    props: {
        compact: { type: Boolean, required: false, default: false }
    },
    setup(__props) {
        const props = __props;
        const compact = computed(() => props.compact);
        const controlsOpen = ref(false);
        const store = useDroneStore();
        const { t } = useI18n();
        const { crosshairVisible } = useLandingAssistSettings();
        const markerDisplayMode = ref('off');
        const plandStart = usePrecisionStartStore();
        watch(() => plandStart.state.plandPreviewActive, active => { markerDisplayMode.value = active ? 'measured' : 'off'; });
        const markerOverlayUrl = ref('');
        // Vector reference: relative normalized geometry, without a claimed physical dimension.
        // It is schematic until dimensions have been separately measured/confirmed.
        const pportIdealSvg = ref('');
        const idealMarkerUrl = computed(() => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pportIdealSvg.value || idealMarkerSvg));
        const markerModelId = ref('');
        const markerOverlayStatus = ref('Kein Modell geladen');
        const cameraForModel = useCameraStore();
        const markerZoomRole = computed(() => (cameraForModel.zoomActual ?? cameraForModel.zoomTarget) > 1.01 ? 'MAX' : 'MIN');
        const markerScale = ref(null);
        const markerWeighting = ref(null);
        const markerExpectedPx = computed(() => {
            const h = Number(store.telemetry.altitude);
            const group = markerScale.value?.groups?.[markerZoomRole.value];
            if (cameraForModel.zoomActual == null || !Number.isFinite(h) || h <= 0 || !group?.heightRangeM ||
                h < group.heightRangeM[0] || h > group.heightRangeM[1])
                return 0;
            const k = Number(group.kPixelMeters);
            return Number.isFinite(k) && k > 0 ? k / h : 0;
        });
        // Scale is measured in source-image pixels (1280px width).
        // Hide projection until live frame dimensions are known; never extrapolate outside fitted height range.
        const markerFrameWidth = computed(() => Number(canvasRef.value?.width || decoderStats.width || 0));
        const markerDisplayPx = computed(() => {
            if (!markerFrameWidth.value || !markerExpectedPx.value)
                return 0;
            const containerWidth = containerRef.value?.clientWidth || 0;
            if (!containerWidth)
                return 0;
            return Math.min(containerWidth, markerExpectedPx.value * containerWidth / 1280);
        });
        const markerScaleAvailable = computed(() => markerDisplayPx.value > 0);
        const markerPreviewPx = computed(() => markerScaleAvailable.value ? markerDisplayPx.value : 160);
        const markerOpticalPercent = computed(() => {
            // A candidate model MUST NEVER receive verified optical weight.
            if (markerOverlayStatus.value !== 'VERIFIED')
                return 0;
            const p = markerExpectedPx.value;
            const p0 = Number(markerWeighting.value?.p0Px);
            return p > 0 && p0 > 0 ? Math.round(100 * p * p / (p * p + p0 * p0)) : 0;
        });
        async function loadMarkerOverlay() {
            try {
                const r = await fetch('/api/pport/models/latest', { cache: 'no-store' });
                if (!r.ok)
                    throw new Error('HTTP ' + r.status);
                const data = await r.json();
                if (!data.available) {
                    markerOverlayStatus.value = 'Kein PPort-Modell';
                    return;
                }
                markerModelId.value = data.id;
                pportIdealSvg.value = typeof data.idealSvg === 'string' && data.idealSvg.startsWith('<svg ') ? data.idealSvg : '';
                markerScale.value = data.scale;
                markerWeighting.value = data.weighting;
                markerOverlayStatus.value = data.model?.status || 'UNVERIFIED';
                markerOverlayUrl.value = 'data:image/png;base64,' + data.patternBase64;
            }
            catch (e) {
                markerOverlayStatus.value = 'Ladefehler: ' + String(e);
            }
        }
        const containerRef = ref(null);
        const canvasRef = ref(null);
        // Rendering Modes: 'webcodecs' (Direct H.265/H.264) | 'snapshot' (HTTP poll) | 'mjpeg' (HTTP MJPEG)
        const mode = ref('webcodecs');
        const hasFrame = ref(false);
        const resolution = ref('');
        const fps = ref(0);
        const retryCounter = ref(0);
        const webCodecsSupported = ref(WebCodecsPlayer.isSupported());
        const h265Supported = ref(false);
        const h264Supported = ref(false);
        const currentDroneProfile = ref('ATOM');
        const currentVideoTransport = ref('atom_h264_fe06');
        const atomFramesParsed = ref(0);
        // Video Extraction & Decoding State
        const videoExtractor = VideoExtractor.getInstance();
        let webCodecsPlayer = null;
        let unsubscribeExtractor = null;
        let backendStatsTimer = null;
        let isDestroyed = false;
        const feTraffic = ref([]);
        const parserStats = reactive({
            usbChunksFed: 0,
            fePacketsParsed: 0,
            feStreamBufferBytes: 0,
            videoStreamBufferBytes: 0,
            w42MagicHits: 0,
            w42HeadersParsed: 0,
            w42InvalidHeaders: 0,
            w42IncompleteChunks: 0,
            streamBytesDropped: 0,
            detectedCodec: 'unknown'
        });
        const videoStats = reactive({
            packetsFed: 0,
            videoChunksParsed: 0,
            framesExtracted: 0,
            iFrames: 0,
            pFrames: 0,
            detectedCodec: 'unknown'
        });
        const decoderStats = reactive({
            fps: 0,
            framesDecoded: 0,
            droppedFrames: 0,
            width: 0,
            height: 0,
            codec: 'Initializing...',
            codecType: 'none',
            latencyMs: 0
        });
        const codecSupportOk = computed(() => h265Supported.value || h264Supported.value);
        const codecSupportText = computed(() => {
            if (!webCodecsSupported.value)
                return '✗ Browser does not support WebCodecs';
            const items = [];
            if (h265Supported.value)
                items.push('✓ H.265');
            else
                items.push('✗ H.265 (extension required)');
            if (h264Supported.value)
                items.push('✓ H.264');
            else
                items.push('✗ H.264');
            return items.join(' | ');
        });
        // MJPEG stream URL
        const mjpegUrl = computed(() => {
            const host = store.normalizedHost;
            const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
            return `${httpProto}//${host}/api/video/mjpeg?t=${retryCounter.value}`;
        });
        function onMjpegLoad() {
            hasFrame.value = true;
        }
        function onMjpegError() {
            setTimeout(() => {
                if (!isDestroyed && mode.value === 'mjpeg') {
                    retryCounter.value = Date.now();
                }
            }, 3000);
        }
        function toggleNextMode() {
            if (mode.value === 'webcodecs') {
                mode.value = 'snapshot';
                startSnapshotLoop();
                store.addLog('INFO', 'Switched to HTTP single-frame polling snapshot mode');
            }
            else if (mode.value === 'snapshot') {
                mode.value = 'mjpeg';
                stopSnapshotLoop();
                retryCounter.value = Date.now();
                store.addLog('INFO', 'Switched to MJPEG direct-stream mode');
            }
            else {
                mode.value = 'webcodecs';
                stopSnapshotLoop();
                initWebCodecs();
                store.addLog('INFO', 'Switched to WebCodecs hardware-accelerated mode (USB passthrough)');
            }
        }
        function activateSelectedLiveView() {
            const preferH265 = videoExtractor.getDroneModel() === 'ATOM_2';
            store.addLog('INFO', `Activating LiveView for ${videoExtractor.getDroneModel()}...`);
            DroneControlService.activateLiveView(preferH265);
        }
        function requestIdr() {
            store.addLog('INFO', 'Manual video keyframe request (IDR / 0xD9)');
            DroneControlService.requestIdr();
        }
        function formatRate(bytesPerSecond) {
            if (bytesPerSecond >= 1024 * 1024)
                return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
            if (bytesPerSecond >= 1024)
                return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
            return `${bytesPerSecond} B/s`;
        }
        async function refreshBackendVideoStats() {
            try {
                const host = store.normalizedHost;
                const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
                const res = await fetch(`${httpProto}//${host}/api/video/stats`, { signal: AbortSignal.timeout(1500) });
                if (!res.ok)
                    return;
                const stats = await res.json();
                if (typeof stats.framesExtracted === 'number')
                    videoStats.framesExtracted = stats.framesExtracted;
                if (typeof stats.iFrames === 'number')
                    videoStats.iFrames = stats.iFrames;
                if (typeof stats.pFrames === 'number')
                    videoStats.pFrames = stats.pFrames;
                if (typeof stats.detectedCodec === 'string')
                    videoStats.detectedCodec = stats.detectedCodec;
                if (typeof stats.droneProfile === 'string')
                    currentDroneProfile.value = stats.droneProfile;
                if (typeof stats.videoTransport === 'string')
                    currentVideoTransport.value = stats.videoTransport;
                if (typeof stats.atomFramesParsed === 'number')
                    atomFramesParsed.value = stats.atomFramesParsed;
                if (stats.parser && typeof stats.parser === 'object')
                    Object.assign(parserStats, stats.parser);
                const traffic = Array.isArray(stats.feTraffic) ? stats.feTraffic : [];
                feTraffic.value = traffic
                    .filter(item => item.packets > 0)
                    .sort((a, b) => b.bytesPerSecond - a.bytesPerSecond || b.bytes - a.bytes)
                    .slice(0, 8);
            }
            catch (_) {
                // Diagnostics are best-effort and must never disturb video/control paths.
            }
        }
        function toggleFullscreen() {
            if (!containerRef.value)
                return;
            if (!document.fullscreenElement) {
                const target = containerRef.value.closest('.flight-stage');
                (target || containerRef.value).requestFullscreen?.().catch(() => { });
            }
            else {
                document.exitFullscreen?.().catch(() => { });
            }
        }
        // === WebCodecs Integration (USB FE 0x06 -> Direct H.265/H.264 Hardware Decoding) ===
        async function initWebCodecs() {
            if (!WebCodecsPlayer.isSupported()) {
                console.warn('[VideoPlayer] WebCodecs not supported, falling back to snapshot mode');
                mode.value = 'snapshot';
                startSnapshotLoop();
                return;
            }
            // Probe codec capability
            const probe = await WebCodecsPlayer.probeCodecs(1920, 1080);
            h265Supported.value = probe.h265;
            h264Supported.value = probe.h264;
            if (!webCodecsPlayer) {
                webCodecsPlayer = new WebCodecsPlayer();
            }
            webCodecsPlayer.setCanvas(canvasRef.value);
            // Follow the central drone protocol selection. ATOM capture is H.264 1280x720;
            // ATOM 2 keeps the existing H.265-first behavior.
            const atom = videoExtractor.getDroneModel() === 'ATOM';
            const preferH265 = !atom && probe.h265;
            await webCodecsPlayer.init(atom ? 1280 : 1920, atom ? 720 : 1080, preferH265);
            webCodecsPlayer.onStats((stats) => {
                Object.assign(decoderStats, stats);
                fps.value = stats.fps;
                if (stats.framesDecoded > 0) {
                    hasFrame.value = true;
                }
                if (stats.width > 0 && stats.height > 0) {
                    resolution.value = `${stats.width}x${stats.height}`;
                }
            });
            // Hook into VideoExtractor stream
            if (unsubscribeExtractor)
                unsubscribeExtractor();
            unsubscribeExtractor = videoExtractor.onFrame((frame) => {
                videoStats.packetsFed = videoExtractor.packetsFed;
                videoStats.videoChunksParsed = videoExtractor.videoChunksParsed;
                videoStats.framesExtracted = videoExtractor.framesExtracted;
                videoStats.iFrames = videoExtractor.iFrames;
                videoStats.pFrames = videoExtractor.pFrames;
                videoStats.detectedCodec = videoExtractor.detectedCodec;
                if (mode.value === 'webcodecs') {
                    webCodecsPlayer?.feedFrame(frame);
                }
            });
        }
        // === Snapshot Loop Fallback ===
        let isSnapshotLoopActive = false;
        async function startSnapshotLoop() {
            if (isSnapshotLoopActive)
                return;
            isSnapshotLoopActive = true;
            while (isSnapshotLoopActive && !isDestroyed && mode.value === 'snapshot') {
                if (store.activeTab !== 'cockpit') {
                    await new Promise(r => setTimeout(r, 600));
                    continue;
                }
                try {
                    const host = store.normalizedHost;
                    const httpProto = window.location.protocol === 'https:' ? 'https:' : 'http:';
                    const res = await fetch(`${httpProto}//${host}/api/video/snapshot?t=${Date.now()}`, {
                        signal: AbortSignal.timeout(2000)
                    });
                    if (res.ok) {
                        const blob = await res.blob();
                        if (blob.size > 500) {
                            const bitmap = await createImageBitmap(blob);
                            const canvas = canvasRef.value;
                            if (canvas) {
                                if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
                                    canvas.width = bitmap.width;
                                    canvas.height = bitmap.height;
                                    resolution.value = `${bitmap.width}x${bitmap.height}`;
                                }
                                const ctx = canvas.getContext('2d');
                                if (ctx)
                                    ctx.drawImage(bitmap, 0, 0);
                            }
                            bitmap.close();
                            hasFrame.value = true;
                        }
                        await new Promise(r => setTimeout(r, 33));
                    }
                    else {
                        await new Promise(r => setTimeout(r, 800));
                    }
                }
                catch (_) {
                    await new Promise(r => setTimeout(r, 1200));
                }
            }
            isSnapshotLoopActive = false;
        }
        function stopSnapshotLoop() {
            isSnapshotLoopActive = false;
        }
        function onDroneProfileChanged() {
            hasFrame.value = false;
            videoStats.framesExtracted = 0;
            videoStats.iFrames = 0;
            videoStats.pFrames = 0;
            if (mode.value === 'webcodecs')
                initWebCodecs();
        }
        onMounted(async () => {
            // PPort is loaded automatically; no flight commands or corrections are issued.
            await loadMarkerOverlay();
            window.addEventListener('drone-profile-changed', onDroneProfileChanged);
            // 1. Initialize WebCodecs
            await initWebCodecs();
            // 2. LiveView activation and recovery are owned by the Android backend.
            //    Avoid duplicate browser-side activation/IDR loops that can repeatedly reset
            //    the camera encoder while FE 0x06 is already flowing. The buttons remain
            //    available for explicit manual H.265/H.264 tests.
            // 3. Backend FE/w42 diagnostics. This is intentionally independent from WebCodecs.
            await refreshBackendVideoStats();
            backendStatsTimer = setInterval(refreshBackendVideoStats, 1000);
        });
        onUnmounted(() => {
            window.removeEventListener('drone-profile-changed', onDroneProfileChanged);
            isDestroyed = true;
            stopSnapshotLoop();
            if (unsubscribeExtractor)
                unsubscribeExtractor();
            if (webCodecsPlayer)
                webCodecsPlayer.destroy();
            if (backendStatsTimer)
                clearInterval(backendStatsTimer);
        });
        return (_ctx, _cache) => {
            return (_openBlock(), _createElementBlock("div", {
                class: "video-container",
                ref_key: "containerRef",
                ref: containerRef
            }, [
                _createElementVNode("div", _hoisted_1, [
                    _createCommentVNode(" High Performance WebCodecs / Canvas Video Feed "),
                    _withDirectives(_createElementVNode("canvas", {
                        ref_key: "canvasRef",
                        ref: canvasRef,
                        class: "video-feed"
                    }, null, 512 /* NEED_PATCH */), [
                        [_vShow, (mode.value === 'webcodecs' || mode.value === 'snapshot') && hasFrame.value]
                    ]),
                    _createCommentVNode(" Fallback MJPEG Stream Mode "),
                    (mode.value === 'mjpeg')
                        ? (_openBlock(), _createElementBlock("img", {
                            key: 0,
                            src: mjpegUrl.value,
                            onLoad: onMjpegLoad,
                            onError: onMjpegError,
                            class: "video-feed",
                            alt: "Live FPV"
                        }, null, 40 /* PROPS, NEED_HYDRATION */, _hoisted_2))
                        : _createCommentVNode("v-if", true),
                    _createCommentVNode(" Placeholder / Waiting Screen with Diagnostics "),
                    (!hasFrame.value)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
                            _cache[2] || (_cache[2] = _createElementVNode("div", { class: "placeholder-icon" }, "🚁", -1 /* CACHED */)),
                            _createElementVNode("div", _hoisted_4, _toDisplayString(_unref(t)('video.waitingTitle')), 1 /* TEXT */),
                            _createElementVNode("div", _hoisted_5, _toDisplayString(_unref(t)('video.waitingDesc')), 1 /* TEXT */),
                            _createCommentVNode(" Real-time Diagnostics Checklist "),
                            _createElementVNode("div", _hoisted_6, [
                                _createElementVNode("div", _hoisted_7, [
                                    _createElementVNode("span", _hoisted_8, _toDisplayString(_unref(t)('video.usbPassthrough')), 1 /* TEXT */),
                                    _createElementVNode("span", {
                                        class: _normalizeClass(_unref(store).connection.wsConnected ? 'diag-ok' : 'diag-warn')
                                    }, _toDisplayString(_unref(store).connection.wsConnected ? '✓ Ready' : '✗ Not Connected'), 3 /* TEXT, CLASS */)
                                ]),
                                _createElementVNode("div", _hoisted_9, [
                                    _createElementVNode("span", _hoisted_10, _toDisplayString(_unref(t)('video.androidUsb')), 1 /* TEXT */),
                                    _createElementVNode("span", {
                                        class: _normalizeClass(_unref(store).connection.usbTransportOpen ? 'diag-ok' : 'diag-warn')
                                    }, _toDisplayString(_unref(store).connection.usbTransportOpen ? '✓ Open' : '✗ Closed'), 3 /* TEXT, CLASS */)
                                ]),
                                _createElementVNode("div", _hoisted_11, [
                                    _createElementVNode("span", _hoisted_12, _toDisplayString(_unref(t)('video.rxLink')), 1 /* TEXT */),
                                    _createElementVNode("span", {
                                        class: _normalizeClass(_unref(store).connection.usbConnected ? 'diag-ok' : 'diag-warn')
                                    }, _toDisplayString(_unref(store).connection.usbConnected ? '✓ Connected (RX confirmed)' : (_unref(store).connection.usbTransportOpen ? '… Waiting for RX' : '✗ Not Connected')), 3 /* TEXT, CLASS */)
                                ]),
                                _createElementVNode("div", _hoisted_13, [
                                    _createElementVNode("span", _hoisted_14, _toDisplayString(_unref(t)('video.videoExtraction')), 1 /* TEXT */),
                                    _createElementVNode("span", {
                                        class: _normalizeClass(videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted')
                                    }, _toDisplayString(videoStats.framesExtracted) + " frames (I: " + _toDisplayString(videoStats.iFrames) + " / P: " + _toDisplayString(videoStats.pFrames) + ") " + _toDisplayString(videoStats.detectedCodec !== 'unknown' ? `[${videoStats.detectedCodec.toUpperCase()}]` : ''), 3 /* TEXT, CLASS */)
                                ]),
                                (feTraffic.value.length > 0)
                                    ? (_openBlock(), _createElementBlock("div", _hoisted_15, [
                                        _createElementVNode("span", _hoisted_16, _toDisplayString(_unref(t)('video.feTraffic')), 1 /* TEXT */),
                                        _createElementVNode("span", _hoisted_17, [
                                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(feTraffic.value, (item) => {
                                                return (_openBlock(), _createElementBlock("span", {
                                                    key: item.feType,
                                                    class: _normalizeClass(["fe-traffic-chip", item.feType === 0x06 && item.bytesPerSecond > 0 ? 'diag-ok' : ''])
                                                }, _toDisplayString(item.feTypeHex) + ": " + _toDisplayString(formatRate(item.bytesPerSecond)) + " / " + _toDisplayString(item.packetsPerSecond) + " pkt/s ", 3 /* TEXT, CLASS */));
                                            }), 128 /* KEYED_FRAGMENT */))
                                        ])
                                    ]))
                                    : _createCommentVNode("v-if", true),
                                (parserStats.fePacketsParsed > 0)
                                    ? (_openBlock(), _createElementBlock("div", _hoisted_18, [
                                        _createElementVNode("span", _hoisted_19, _toDisplayString(_unref(t)('video.parser')), 1 /* TEXT */),
                                        _createElementVNode("span", {
                                            class: _normalizeClass(videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted')
                                        }, [
                                            _createTextVNode(_toDisplayString(currentDroneProfile.value) + " / " + _toDisplayString(currentVideoTransport.value) + " | FE " + _toDisplayString(parserStats.fePacketsParsed) + " ", 1 /* TEXT */),
                                            (currentVideoTransport.value === 'w42')
                                                ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                                    _createTextVNode(" | w42 valid " + _toDisplayString(parserStats.w42HeadersParsed) + " / invalid " + _toDisplayString(parserStats.w42InvalidHeaders), 1 /* TEXT */)
                                                ], 64 /* STABLE_FRAGMENT */))
                                                : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                                    _createTextVNode(" | ATOM frames " + _toDisplayString(atomFramesParsed.value), 1 /* TEXT */)
                                                ], 64 /* STABLE_FRAGMENT */)),
                                            _createTextVNode(" | pending " + _toDisplayString(parserStats.videoStreamBufferBytes) + " B " + _toDisplayString(parserStats.detectedCodec !== 'unknown' ? `| ${parserStats.detectedCodec.toUpperCase()}` : ''), 1 /* TEXT */)
                                        ], 2 /* CLASS */)
                                    ]))
                                    : _createCommentVNode("v-if", true),
                                _createElementVNode("div", _hoisted_20, [
                                    _createElementVNode("span", _hoisted_21, _toDisplayString(_unref(t)('video.webcodecs')), 1 /* TEXT */),
                                    _createElementVNode("span", {
                                        class: _normalizeClass(codecSupportOk.value ? 'diag-ok' : 'diag-warn')
                                    }, _toDisplayString(codecSupportText.value), 3 /* TEXT, CLASS */)
                                ]),
                                (decoderStats.framesDecoded > 0 || decoderStats.droppedFrames > 0)
                                    ? (_openBlock(), _createElementBlock("div", _hoisted_22, [
                                        _createElementVNode("span", _hoisted_23, _toDisplayString(_unref(t)('video.decoder')), 1 /* TEXT */),
                                        _createElementVNode("span", {
                                            class: _normalizeClass(decoderStats.framesDecoded > 0 ? 'diag-ok' : 'diag-warn')
                                        }, " Decoded " + _toDisplayString(decoderStats.framesDecoded) + " frames (dropped: " + _toDisplayString(decoderStats.droppedFrames) + ") ", 3 /* TEXT, CLASS */)
                                    ]))
                                    : _createCommentVNode("v-if", true)
                            ]),
                            _createElementVNode("div", _hoisted_24, [
                                _createElementVNode("button", {
                                    class: "taf-btn taf-btn--primary",
                                    onClick: activateSelectedLiveView
                                }, " ⚡ Activate Stream (" + _toDisplayString(currentDroneProfile.value) + ") ", 1 /* TEXT */),
                                _createElementVNode("button", {
                                    class: "taf-btn",
                                    onClick: requestIdr
                                }, " 🔄 Request Keyframe (IDR) "),
                                _createElementVNode("button", {
                                    class: "taf-btn",
                                    onClick: toggleNextMode
                                }, " 🔀 Switch Mode (Current: " + _toDisplayString(mode.value.toUpperCase()) + ") ", 1 /* TEXT */)
                            ])
                        ]))
                        : _createCommentVNode("v-if", true),
                    (!compact.value && _unref(crosshairVisible) && hasFrame.value)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_25, [...(_cache[3] || (_cache[3] = [
                                _createElementVNode("span", { class: "crosshair-line crosshair-h" }, null, -1 /* CACHED */),
                                _createElementVNode("span", { class: "crosshair-line crosshair-v" }, null, -1 /* CACHED */),
                                _createElementVNode("span", { class: "crosshair-center" }, null, -1 /* CACHED */)
                            ]))]))
                        : _createCommentVNode("v-if", true),
                    _createCommentVNode(" Model display is opt-in. Ideal is schematic, not a calibrated optical observation. "),
                    (!compact.value && markerDisplayMode.value !== 'off' && hasFrame.value)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_26, [
                            ((markerDisplayMode.value === 'measured' || markerDisplayMode.value === 'compare') && markerOverlayUrl.value)
                                ? (_openBlock(), _createElementBlock("img", {
                                    key: 0,
                                    src: markerOverlayUrl.value,
                                    class: "pport-marker-pattern",
                                    style: _normalizeStyle({ width: markerPreviewPx.value + 'px', height: markerPreviewPx.value + 'px', opacity: markerDisplayMode.value === 'compare' ? 0.37 : 0.44 }),
                                    alt: "PStart-Mustermodell (unverifiziert)"
                                }, null, 12 /* STYLE, PROPS */, _hoisted_27))
                                : _createCommentVNode("v-if", true),
                            (markerDisplayMode.value === 'ideal' || markerDisplayMode.value === 'compare')
                                ? (_openBlock(), _createElementBlock("img", {
                                    key: 1,
                                    src: idealMarkerUrl.value,
                                    class: "pport-marker-pattern",
                                    style: _normalizeStyle({ width: markerPreviewPx.value + 'px', height: markerPreviewPx.value + 'px', opacity: markerDisplayMode.value === 'compare' ? 0.32 : 0.44, outline: markerDisplayMode.value === 'compare' ? '2px dashed #4fe3c1' : 'none' }),
                                    alt: "Schematisches Idealmodell des Landemusters"
                                }, null, 12 /* STYLE, PROPS */, _hoisted_28))
                                : _createCommentVNode("v-if", true),
                            _createElementVNode("div", _hoisted_29, [
                                _createElementVNode("div", null, "PLand " + _toDisplayString(markerDisplayMode.value === 'ideal' ? 'Idealmodell (schematisch)' : markerDisplayMode.value === 'compare' ? 'PStart + Ideal (Vergleich)' : 'PStart-Modell') + " · " + _toDisplayString(markerOverlayStatus.value), 1 /* TEXT */),
                                _createElementVNode("div", null, "Modell " + _toDisplayString(markerModelId.value || '–') + " · " + _toDisplayString(markerScaleAvailable.value ? markerDisplayPx.value.toFixed(0) + ' px (Kalibrierbereich)' : 'Maßstab unbekannt – unmaßstäbliche Vorschau'), 1 /* TEXT */),
                                _createElementVNode("div", null, "Telemetriehöhe: " + _toDisplayString(Number(_unref(store).telemetry.altitude).toFixed(1)) + " m (Quelle nicht verifiziert)", 1 /* TEXT */),
                                _createElementVNode("div", null, "Optik: " + _toDisplayString(markerOpticalPercent.value) + " % · GPS: " + _toDisplayString(100 - markerOpticalPercent.value) + " % (nur Modellanzeige)", 1 /* TEXT */),
                                _cache[4] || (_cache[4] = _createElementVNode("div", null, "Nur Anzeige · keine Flugregelung", -1 /* CACHED */))
                            ])
                        ]))
                        : _createCommentVNode("v-if", true),
                    _createCommentVNode(" Transparent status overlay; controls live in the collapsible side drawer. "),
                    (!compact.value)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_30, [
                            _createElementVNode("div", _hoisted_31, [
                                _createElementVNode("span", {
                                    class: _normalizeClass(["osd-tag", hasFrame.value ? 'live' : 'waiting'])
                                }, _toDisplayString(hasFrame.value ? '● Live Video' : '○ Waiting for Stream'), 3 /* TEXT, CLASS */),
                                _createElementVNode("span", _hoisted_32, "Render: " + _toDisplayString(mode.value.toUpperCase()), 1 /* TEXT */),
                                (resolution.value)
                                    ? (_openBlock(), _createElementBlock("span", _hoisted_33, _toDisplayString(resolution.value), 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                (fps.value > 0)
                                    ? (_openBlock(), _createElementBlock("span", _hoisted_34, _toDisplayString(fps.value) + " FPS", 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true),
                                (hasFrame.value && mode.value === 'webcodecs')
                                    ? (_openBlock(), _createElementBlock("span", _hoisted_35, _toDisplayString((decoderStats.codecType || 'h265').toUpperCase()) + " HW Decode", 1 /* TEXT */))
                                    : _createCommentVNode("v-if", true)
                            ])
                        ]))
                        : _createCommentVNode("v-if", true),
                    (!compact.value)
                        ? (_openBlock(), _createElementBlock("div", {
                            key: 5,
                            class: _normalizeClass(["video-control-drawer", { open: controlsOpen.value }])
                        }, [
                            _createElementVNode("button", {
                                class: "drawer-toggle",
                                type: "button",
                                title: controlsOpen.value ? 'Hide LiveView controls' : 'Show LiveView controls',
                                onClick: _cache[0] || (_cache[0] = ($event) => (controlsOpen.value = !controlsOpen.value))
                            }, _toDisplayString(controlsOpen.value ? '›' : '‹'), 9 /* TEXT, PROPS */, _hoisted_36),
                            (controlsOpen.value)
                                ? (_openBlock(), _createElementBlock("div", _hoisted_37, [
                                    _createElementVNode("button", {
                                        class: "osd-action-btn success",
                                        onClick: activateSelectedLiveView
                                    }, "⚡ Stream"),
                                    _createElementVNode("button", {
                                        class: "osd-action-btn",
                                        onClick: requestIdr
                                    }, "🔄 I-Frame"),
                                    _createElementVNode("button", {
                                        class: "osd-action-btn",
                                        onClick: toggleNextMode
                                    }, "🔀 " + _toDisplayString(mode.value.toUpperCase()), 1 /* TEXT */),
                                    _createElementVNode("label", _hoisted_38, [
                                        _cache[6] || (_cache[6] = _createTextVNode("◫ Muster ", -1 /* CACHED */)),
                                        _withDirectives(_createElementVNode("select", {
                                            id: "pland-model-mode",
                                            "onUpdate:modelValue": _cache[1] || (_cache[1] = ($event) => ((markerDisplayMode).value = $event)),
                                            "aria-label": "Mustermodell-Anzeige"
                                        }, [...(_cache[5] || (_cache[5] = [
                                                _createElementVNode("option", { value: "off" }, "AUS", -1 /* CACHED */),
                                                _createElementVNode("option", { value: "measured" }, "PStart-Modell", -1 /* CACHED */),
                                                _createElementVNode("option", { value: "ideal" }, "Idealmodell", -1 /* CACHED */),
                                                _createElementVNode("option", { value: "compare" }, "Vergleich", -1 /* CACHED */)
                                            ]))], 512 /* NEED_PATCH */), [
                                            [_vModelSelect, markerDisplayMode.value]
                                        ])
                                    ]),
                                    _createElementVNode("button", {
                                        class: "osd-action-btn",
                                        onClick: toggleFullscreen,
                                        title: _unref(t)('video.fullscreenTitle')
                                    }, "⛶ " + _toDisplayString(_unref(t)('video.fullscreen')), 9 /* TEXT, PROPS */, _hoisted_39)
                                ]))
                                : _createCommentVNode("v-if", true)
                        ], 2 /* CLASS */))
                        : _createCommentVNode("v-if", true)
                ])
            ], 512 /* NEED_PATCH */));
        };
    }
});
