import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref, reactive, onMounted, onUnmounted, computed } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { VideoExtractor } from '../../protocol/VideoExtractor.js';
import { WebCodecsPlayer } from '../../video/WebCodecsPlayer.js';
import { useI18n } from '../../i18n/index.js';
import { useLandingAssistSettings } from '../../composables/useLandingAssistSettings.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'VideoPlayer',
    props: {
        compact: { type: Boolean, required: false, default: false }
    },
    setup(__props, { expose: __expose }) {
        __expose();
        const props = __props;
        const compact = computed(() => props.compact);
        const controlsOpen = ref(false);
        const store = useDroneStore();
        const { t } = useI18n();
        const { crosshairVisible } = useLandingAssistSettings();
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
        const __returned__ = { props, compact, controlsOpen, store, t, crosshairVisible, containerRef, canvasRef, mode, hasFrame, resolution, fps, retryCounter, webCodecsSupported, h265Supported, h264Supported, currentDroneProfile, currentVideoTransport, atomFramesParsed, videoExtractor, get webCodecsPlayer() { return webCodecsPlayer; }, set webCodecsPlayer(v) { webCodecsPlayer = v; }, get unsubscribeExtractor() { return unsubscribeExtractor; }, set unsubscribeExtractor(v) { unsubscribeExtractor = v; }, get backendStatsTimer() { return backendStatsTimer; }, set backendStatsTimer(v) { backendStatsTimer = v; }, get isDestroyed() { return isDestroyed; }, set isDestroyed(v) { isDestroyed = v; }, feTraffic, parserStats, videoStats, decoderStats, codecSupportOk, codecSupportText, mjpegUrl, onMjpegLoad, onMjpegError, toggleNextMode, activateSelectedLiveView, requestIdr, formatRate, refreshBackendVideoStats, toggleFullscreen, initWebCodecs, get isSnapshotLoopActive() { return isSnapshotLoopActive; }, set isSnapshotLoopActive(v) { isSnapshotLoopActive = v; }, startSnapshotLoop, stopSnapshotLoop, onDroneProfileChanged };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createCommentVNode as _createCommentVNode, vShow as _vShow, createElementVNode as _createElementVNode, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, renderList as _renderList, Fragment as _Fragment, createTextVNode as _createTextVNode } from "../../../vendor/vue.js";
const _hoisted_1 = {
    class: "video-container",
    ref: "containerRef"
};
const _hoisted_2 = { class: "video-viewport" };
const _hoisted_3 = {
    ref: "canvasRef",
    class: "video-feed"
};
const _hoisted_4 = ["src"];
const _hoisted_5 = {
    key: 1,
    class: "video-placeholder"
};
const _hoisted_6 = { class: "placeholder-title" };
const _hoisted_7 = { class: "placeholder-desc" };
const _hoisted_8 = { class: "diag-checklist" };
const _hoisted_9 = { class: "diag-item" };
const _hoisted_10 = { class: "diag-label" };
const _hoisted_11 = { class: "diag-item" };
const _hoisted_12 = { class: "diag-label" };
const _hoisted_13 = { class: "diag-item" };
const _hoisted_14 = { class: "diag-label" };
const _hoisted_15 = { class: "diag-item" };
const _hoisted_16 = { class: "diag-label" };
const _hoisted_17 = {
    key: 0,
    class: "diag-item"
};
const _hoisted_18 = { class: "diag-label" };
const _hoisted_19 = { class: "diag-muted fe-traffic-list" };
const _hoisted_20 = {
    key: 1,
    class: "diag-item"
};
const _hoisted_21 = { class: "diag-label" };
const _hoisted_22 = { class: "diag-item" };
const _hoisted_23 = { class: "diag-label" };
const _hoisted_24 = {
    key: 2,
    class: "diag-item"
};
const _hoisted_25 = { class: "diag-label" };
const _hoisted_26 = { class: "placeholder-actions" };
const _hoisted_27 = {
    key: 2,
    class: "landing-crosshair",
    "aria-hidden": "true"
};
const _hoisted_28 = {
    key: 3,
    class: "video-osd"
};
const _hoisted_29 = { class: "osd-left" };
const _hoisted_30 = { class: "osd-tag" };
const _hoisted_31 = {
    key: 0,
    class: "osd-tag"
};
const _hoisted_32 = {
    key: 1,
    class: "osd-tag"
};
const _hoisted_33 = {
    key: 2,
    class: "osd-tag highlight-tag"
};
const _hoisted_34 = ["title"];
const _hoisted_35 = {
    key: 0,
    class: "drawer-actions"
};
const _hoisted_36 = ["title"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createCommentVNode(" High Performance WebCodecs / Canvas Video Feed "),
            _withDirectives(_createElementVNode("canvas", _hoisted_3, null, 512 /* NEED_PATCH */), [
                [_vShow, ($setup.mode === 'webcodecs' || $setup.mode === 'snapshot') && $setup.hasFrame]
            ]),
            _createCommentVNode(" Fallback MJPEG Stream Mode "),
            ($setup.mode === 'mjpeg')
                ? (_openBlock(), _createElementBlock("img", {
                    key: 0,
                    src: $setup.mjpegUrl,
                    onLoad: $setup.onMjpegLoad,
                    onError: $setup.onMjpegError,
                    class: "video-feed",
                    alt: "Live FPV"
                }, null, 40 /* PROPS, NEED_HYDRATION */, _hoisted_4))
                : _createCommentVNode("v-if", true),
            _createCommentVNode(" Placeholder / Waiting Screen with Diagnostics "),
            (!$setup.hasFrame)
                ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
                    _cache[1] || (_cache[1] = _createElementVNode("div", { class: "placeholder-icon" }, "🚁", -1 /* CACHED */)),
                    _createElementVNode("div", _hoisted_6, _toDisplayString($setup.t('video.waitingTitle')), 1 /* TEXT */),
                    _createElementVNode("div", _hoisted_7, _toDisplayString($setup.t('video.waitingDesc')), 1 /* TEXT */),
                    _createCommentVNode(" Real-time Diagnostics Checklist "),
                    _createElementVNode("div", _hoisted_8, [
                        _createElementVNode("div", _hoisted_9, [
                            _createElementVNode("span", _hoisted_10, _toDisplayString($setup.t('video.usbPassthrough')), 1 /* TEXT */),
                            _createElementVNode("span", {
                                class: _normalizeClass($setup.store.connection.wsConnected ? 'diag-ok' : 'diag-warn')
                            }, _toDisplayString($setup.store.connection.wsConnected ? '✓ Ready' : '✗ Not Connected'), 3 /* TEXT, CLASS */)
                        ]),
                        _createElementVNode("div", _hoisted_11, [
                            _createElementVNode("span", _hoisted_12, _toDisplayString($setup.t('video.androidUsb')), 1 /* TEXT */),
                            _createElementVNode("span", {
                                class: _normalizeClass($setup.store.connection.usbTransportOpen ? 'diag-ok' : 'diag-warn')
                            }, _toDisplayString($setup.store.connection.usbTransportOpen ? '✓ Open' : '✗ Closed'), 3 /* TEXT, CLASS */)
                        ]),
                        _createElementVNode("div", _hoisted_13, [
                            _createElementVNode("span", _hoisted_14, _toDisplayString($setup.t('video.rxLink')), 1 /* TEXT */),
                            _createElementVNode("span", {
                                class: _normalizeClass($setup.store.connection.usbConnected ? 'diag-ok' : 'diag-warn')
                            }, _toDisplayString($setup.store.connection.usbConnected ? '✓ Connected (RX confirmed)' : ($setup.store.connection.usbTransportOpen ? '… Waiting for RX' : '✗ Not Connected')), 3 /* TEXT, CLASS */)
                        ]),
                        _createElementVNode("div", _hoisted_15, [
                            _createElementVNode("span", _hoisted_16, _toDisplayString($setup.t('video.videoExtraction')), 1 /* TEXT */),
                            _createElementVNode("span", {
                                class: _normalizeClass($setup.videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted')
                            }, _toDisplayString($setup.videoStats.framesExtracted) + " frames (I: " + _toDisplayString($setup.videoStats.iFrames) + " / P: " + _toDisplayString($setup.videoStats.pFrames) + ") " + _toDisplayString($setup.videoStats.detectedCodec !== 'unknown' ? `[${$setup.videoStats.detectedCodec.toUpperCase()}]` : ''), 3 /* TEXT, CLASS */)
                        ]),
                        ($setup.feTraffic.length > 0)
                            ? (_openBlock(), _createElementBlock("div", _hoisted_17, [
                                _createElementVNode("span", _hoisted_18, _toDisplayString($setup.t('video.feTraffic')), 1 /* TEXT */),
                                _createElementVNode("span", _hoisted_19, [
                                    (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.feTraffic, (item) => {
                                        return (_openBlock(), _createElementBlock("span", {
                                            key: item.feType,
                                            class: _normalizeClass(["fe-traffic-chip", item.feType === 0x06 && item.bytesPerSecond > 0 ? 'diag-ok' : ''])
                                        }, _toDisplayString(item.feTypeHex) + ": " + _toDisplayString($setup.formatRate(item.bytesPerSecond)) + " / " + _toDisplayString(item.packetsPerSecond) + " pkt/s ", 3 /* TEXT, CLASS */));
                                    }), 128 /* KEYED_FRAGMENT */))
                                ])
                            ]))
                            : _createCommentVNode("v-if", true),
                        ($setup.parserStats.fePacketsParsed > 0)
                            ? (_openBlock(), _createElementBlock("div", _hoisted_20, [
                                _createElementVNode("span", _hoisted_21, _toDisplayString($setup.t('video.parser')), 1 /* TEXT */),
                                _createElementVNode("span", {
                                    class: _normalizeClass($setup.videoStats.framesExtracted > 0 ? 'diag-ok' : 'diag-muted')
                                }, [
                                    _createTextVNode(_toDisplayString($setup.currentDroneProfile) + " / " + _toDisplayString($setup.currentVideoTransport) + " | FE " + _toDisplayString($setup.parserStats.fePacketsParsed) + " ", 1 /* TEXT */),
                                    ($setup.currentVideoTransport === 'w42')
                                        ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                                            _createTextVNode(" | w42 valid " + _toDisplayString($setup.parserStats.w42HeadersParsed) + " / invalid " + _toDisplayString($setup.parserStats.w42InvalidHeaders), 1 /* TEXT */)
                                        ], 64 /* STABLE_FRAGMENT */))
                                        : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                                            _createTextVNode(" | ATOM frames " + _toDisplayString($setup.atomFramesParsed), 1 /* TEXT */)
                                        ], 64 /* STABLE_FRAGMENT */)),
                                    _createTextVNode(" | pending " + _toDisplayString($setup.parserStats.videoStreamBufferBytes) + " B " + _toDisplayString($setup.parserStats.detectedCodec !== 'unknown' ? `| ${$setup.parserStats.detectedCodec.toUpperCase()}` : ''), 1 /* TEXT */)
                                ], 2 /* CLASS */)
                            ]))
                            : _createCommentVNode("v-if", true),
                        _createElementVNode("div", _hoisted_22, [
                            _createElementVNode("span", _hoisted_23, _toDisplayString($setup.t('video.webcodecs')), 1 /* TEXT */),
                            _createElementVNode("span", {
                                class: _normalizeClass($setup.codecSupportOk ? 'diag-ok' : 'diag-warn')
                            }, _toDisplayString($setup.codecSupportText), 3 /* TEXT, CLASS */)
                        ]),
                        ($setup.decoderStats.framesDecoded > 0 || $setup.decoderStats.droppedFrames > 0)
                            ? (_openBlock(), _createElementBlock("div", _hoisted_24, [
                                _createElementVNode("span", _hoisted_25, _toDisplayString($setup.t('video.decoder')), 1 /* TEXT */),
                                _createElementVNode("span", {
                                    class: _normalizeClass($setup.decoderStats.framesDecoded > 0 ? 'diag-ok' : 'diag-warn')
                                }, " Decoded " + _toDisplayString($setup.decoderStats.framesDecoded) + " frames (dropped: " + _toDisplayString($setup.decoderStats.droppedFrames) + ") ", 3 /* TEXT, CLASS */)
                            ]))
                            : _createCommentVNode("v-if", true)
                    ]),
                    _createElementVNode("div", _hoisted_26, [
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--primary",
                            onClick: $setup.activateSelectedLiveView
                        }, " ⚡ Activate Stream (" + _toDisplayString($setup.currentDroneProfile) + ") ", 1 /* TEXT */),
                        _createElementVNode("button", {
                            class: "taf-btn",
                            onClick: $setup.requestIdr
                        }, " 🔄 Request Keyframe (IDR) "),
                        _createElementVNode("button", {
                            class: "taf-btn",
                            onClick: $setup.toggleNextMode
                        }, " 🔀 Switch Mode (Current: " + _toDisplayString($setup.mode.toUpperCase()) + ") ", 1 /* TEXT */)
                    ])
                ]))
                : _createCommentVNode("v-if", true),
            (!$setup.compact && $setup.crosshairVisible && $setup.hasFrame)
                ? (_openBlock(), _createElementBlock("div", _hoisted_27, [...(_cache[2] || (_cache[2] = [
                        _createElementVNode("span", { class: "crosshair-line crosshair-h" }, null, -1 /* CACHED */),
                        _createElementVNode("span", { class: "crosshair-line crosshair-v" }, null, -1 /* CACHED */),
                        _createElementVNode("span", { class: "crosshair-center" }, null, -1 /* CACHED */)
                    ]))]))
                : _createCommentVNode("v-if", true),
            _createCommentVNode(" Transparent status overlay; controls live in the collapsible side drawer. "),
            (!$setup.compact)
                ? (_openBlock(), _createElementBlock("div", _hoisted_28, [
                    _createElementVNode("div", _hoisted_29, [
                        _createElementVNode("span", {
                            class: _normalizeClass(["osd-tag", $setup.hasFrame ? 'live' : 'waiting'])
                        }, _toDisplayString($setup.hasFrame ? '● Live Video' : '○ Waiting for Stream'), 3 /* TEXT, CLASS */),
                        _createElementVNode("span", _hoisted_30, "Render: " + _toDisplayString($setup.mode.toUpperCase()), 1 /* TEXT */),
                        ($setup.resolution)
                            ? (_openBlock(), _createElementBlock("span", _hoisted_31, _toDisplayString($setup.resolution), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                        ($setup.fps > 0)
                            ? (_openBlock(), _createElementBlock("span", _hoisted_32, _toDisplayString($setup.fps) + " FPS", 1 /* TEXT */))
                            : _createCommentVNode("v-if", true),
                        ($setup.hasFrame && $setup.mode === 'webcodecs')
                            ? (_openBlock(), _createElementBlock("span", _hoisted_33, _toDisplayString(($setup.decoderStats.codecType || 'h265').toUpperCase()) + " HW Decode", 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                    ])
                ]))
                : _createCommentVNode("v-if", true),
            (!$setup.compact)
                ? (_openBlock(), _createElementBlock("div", {
                    key: 4,
                    class: _normalizeClass(["video-control-drawer", { open: $setup.controlsOpen }])
                }, [
                    _createElementVNode("button", {
                        class: "drawer-toggle",
                        type: "button",
                        title: $setup.controlsOpen ? 'Hide LiveView controls' : 'Show LiveView controls',
                        onClick: _cache[0] || (_cache[0] = $event => ($setup.controlsOpen = !$setup.controlsOpen))
                    }, _toDisplayString($setup.controlsOpen ? '›' : '‹'), 9 /* TEXT, PROPS */, _hoisted_34),
                    ($setup.controlsOpen)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_35, [
                            _createElementVNode("button", {
                                class: "osd-action-btn success",
                                onClick: $setup.activateSelectedLiveView
                            }, "⚡ Stream"),
                            _createElementVNode("button", {
                                class: "osd-action-btn",
                                onClick: $setup.requestIdr
                            }, "🔄 I-Frame"),
                            _createElementVNode("button", {
                                class: "osd-action-btn",
                                onClick: $setup.toggleNextMode
                            }, "🔀 " + _toDisplayString($setup.mode.toUpperCase()), 1 /* TEXT */),
                            _createElementVNode("button", {
                                class: "osd-action-btn",
                                onClick: $setup.toggleFullscreen,
                                title: $setup.t('video.fullscreenTitle')
                            }, "⛶ " + _toDisplayString($setup.t('video.fullscreen')), 9 /* TEXT, PROPS */, _hoisted_36)
                        ]))
                        : _createCommentVNode("v-if", true)
                ], 2 /* CLASS */))
                : _createCommentVNode("v-if", true)
        ])
    ], 512 /* NEED_PATCH */));
}
__sfc__.__scopeId = "data-v-af27c373";
__sfc__.render = render;
export default __sfc__;
