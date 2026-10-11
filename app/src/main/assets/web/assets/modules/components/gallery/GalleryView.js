import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, onBeforeUnmount, onMounted, ref } from '../../../vendor/vue.js';
import { CameraMediaService } from '../../services/CameraMediaService.js';
import { AndroidMediaService } from '../../services/AndroidMediaService.js';
import { RecognitionCaptureService } from '../../services/RecognitionCaptureService.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'GalleryView',
    setup(__props, { expose: __expose }) {
        __expose();
        const camera = useCameraStore();
        const drone = useDroneStore();
        const galleryTab = ref('camera');
        const filter = ref('all');
        const recoFilter = ref('all');
        const recognitionImages = ref([]);
        const recoError = ref('');
        const recoBusy = ref(false);
        const recoStatus = ref('');
        const filteredMedia = computed(() => {
            if (filter.value === 'photo')
                return camera.photos;
            if (filter.value === 'video')
                return camera.videos;
            return camera.media;
        });
        const filteredRecognitionImages = computed(() => recognitionImages.value.filter(item => {
            if (recoFilter.value === 'live')
                return item.source === 'live-reco' || item.metadata?.source === 'LIVE_RECO';
            if (recoFilter.value === 'drone')
                return item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO';
            return true;
        }));
        const liveRecoCount = computed(() => recognitionImages.value.filter(item => item.source === 'live-reco' || item.metadata?.source === 'LIVE_RECO').length);
        const droneRecoCount = computed(() => recognitionImages.value.filter(item => item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO').length);
        async function download(fileName) {
            try {
                await CameraMediaService.downloadFile(fileName, { library: 'camera', source: 'drone-camera' });
            }
            catch (e) {
                drone.addLog('ERROR', `Camera download failed: ${e?.message || e}`);
            }
        }
        async function openRecognition() {
            galleryTab.value = 'recognition';
            await loadRecognitionImages();
        }
        async function loadRecognitionImages() {
            try {
                recognitionImages.value = await AndroidMediaService.listImages('recognition');
                recoError.value = '';
            }
            catch (e) {
                recoError.value = `Could not read Recognition image index: ${e?.message || e}`;
            }
        }
        async function captureLiveReco() {
            recoBusy.value = true;
            recoStatus.value = 'Capturing LiveView frame…';
            recoError.value = '';
            try {
                await RecognitionCaptureService.captureLiveReco();
                recoStatus.value = 'Live Reco saved and verified';
                await loadRecognitionImages();
            }
            catch (e) {
                recoError.value = e?.message || String(e);
                drone.addLog('ERROR', `Live Reco failed: ${recoError.value}`);
            }
            finally {
                recoBusy.value = false;
            }
        }
        async function captureDroneReco() {
            recoBusy.value = true;
            recoStatus.value = 'Taking full-resolution camera photo…';
            recoError.value = '';
            try {
                await RecognitionCaptureService.captureDroneReco();
                recoStatus.value = 'Drone Reco transferred, verified and source delete acknowledged';
                await loadRecognitionImages();
            }
            catch (e) {
                recoError.value = e?.message || String(e);
                drone.addLog('ERROR', `Drone Reco failed: ${recoError.value}`);
            }
            finally {
                recoBusy.value = false;
            }
        }
        function sourceLabel(item) {
            return item.source === 'drone-reco' || item.metadata?.source === 'DRONE_RECO' ? 'DRONE' : 'LIVE';
        }
        function metadataSummary(item) {
            const metadata = item.metadata;
            const telemetry = metadata?.telemetry;
            if (!telemetry)
                return '';
            const parts = [];
            if (telemetry.gpsLocationValid && Number.isFinite(telemetry.latitude) && Number.isFinite(telemetry.longitude)) {
                parts.push(`${Number(telemetry.latitude).toFixed(6)}, ${Number(telemetry.longitude).toFixed(6)}`);
            }
            if (Number.isFinite(telemetry.verticalDistance))
                parts.push(`H ${Number(telemetry.verticalDistance).toFixed(1)} m`);
            if (Number.isFinite(telemetry.gimbalPitch))
                parts.push(`Gimbal ${Number(telemetry.gimbalPitch).toFixed(1)}°`);
            return parts.join(' · ');
        }
        function prettyMetadata(item) {
            return JSON.stringify({ image: item.image, sha256: item.sha256, verified: item.verified, ...item.metadata }, null, 2);
        }
        function formatSize(bytes) {
            if (!Number.isFinite(bytes))
                return '—';
            if (bytes < 1024 * 1024)
                return `${Math.max(1, Math.round(bytes / 1024))} KB`;
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        }
        function formatDate(value) { return value ? new Date(value).toLocaleString() : '—'; }
        function formatRemoteTimestamp(file) {
            return file.timestamp ? `${new Date(file.timestamp).toLocaleString()}${file.timestampSource === 'camera' ? ' · Kamera' : ' · Dateiname'}` : 'Zeitstempel nicht verfügbar';
        }
        function onAndroidMediaSaved(event) {
            const saved = event.detail;
            if (saved?.library === 'recognition')
                void loadRecognitionImages();
        }
        onMounted(() => window.addEventListener('taf-android-media-saved', onAndroidMediaSaved));
        onBeforeUnmount(() => window.removeEventListener('taf-android-media-saved', onAndroidMediaSaved));
        function deleteFile(fileName) {
            if (window.confirm(`Delete camera file "${fileName}"?`))
                CameraMediaService.deleteFile(fileName);
        }
        const __returned__ = { camera, drone, galleryTab, filter, recoFilter, recognitionImages, recoError, recoBusy, recoStatus, filteredMedia, filteredRecognitionImages, liveRecoCount, droneRecoCount, download, openRecognition, loadRecognitionImages, captureLiveReco, captureDroneReco, sourceLabel, metadataSummary, prettyMetadata, formatSize, formatDate, formatRemoteTimestamp, onAndroidMediaSaved, deleteFile, get CameraMediaService() { return CameraMediaService; }, get AndroidMediaService() { return AndroidMediaService; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, renderList as _renderList, Fragment as _Fragment } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "gallery-page" };
const _hoisted_2 = { class: "gallery-header" };
const _hoisted_3 = {
    class: "gallery-tabs",
    role: "tablist",
    "aria-label": "Gallery type"
};
const _hoisted_4 = { class: "gallery-toolbar ui-card" };
const _hoisted_5 = { class: "filter-group" };
const _hoisted_6 = { class: "gallery-actions" };
const _hoisted_7 = { class: "gallery-toolbar ui-card" };
const _hoisted_8 = { class: "gallery-status" };
const _hoisted_9 = { class: "taf-status-field" };
const _hoisted_10 = {
    key: 0,
    class: "taf-status-field"
};
const _hoisted_11 = {
    key: 0,
    class: "download-error ui-card"
};
const _hoisted_12 = { class: "gallery-content ui-card" };
const _hoisted_13 = {
    key: 0,
    class: "gallery-empty"
};
const _hoisted_14 = {
    key: 1,
    class: "gallery-empty"
};
const _hoisted_15 = {
    key: 2,
    class: "media-grid"
};
const _hoisted_16 = { class: "media-meta" };
const _hoisted_17 = ["title"];
const _hoisted_18 = { class: "media-type" };
const _hoisted_19 = { class: "media-time" };
const _hoisted_20 = { class: "media-actions" };
const _hoisted_21 = ["disabled", "onClick"];
const _hoisted_22 = ["disabled", "onClick"];
const _hoisted_23 = {
    key: 1,
    class: "download-error ui-card"
};
const _hoisted_24 = { class: "recognition-controls ui-card" };
const _hoisted_25 = { class: "reco-actions" };
const _hoisted_26 = ["disabled"];
const _hoisted_27 = ["disabled"];
const _hoisted_28 = ["disabled"];
const _hoisted_29 = { class: "gallery-toolbar ui-card" };
const _hoisted_30 = { class: "filter-group" };
const _hoisted_31 = { class: "gallery-status" };
const _hoisted_32 = {
    key: 0,
    class: "taf-status-field"
};
const _hoisted_33 = {
    key: 0,
    class: "download-error ui-card"
};
const _hoisted_34 = { class: "android-media ui-card" };
const _hoisted_35 = {
    key: 0,
    class: "gallery-empty"
};
const _hoisted_36 = {
    key: 1,
    class: "android-grid"
};
const _hoisted_37 = { class: "reco-preview-wrap" };
const _hoisted_38 = ["src", "alt"];
const _hoisted_39 = {
    key: 1,
    class: "android-raw-preview"
};
const _hoisted_40 = {
    key: 2,
    class: "verified-badge"
};
const _hoisted_41 = { class: "android-card-meta" };
const _hoisted_42 = ["title"];
const _hoisted_43 = { key: 0 };
const _hoisted_44 = {
    key: 1,
    class: "metadata-details"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _cache[10] || (_cache[10] = _createElementVNode("div", null, [
                _createElementVNode("h2", null, "🖼️ Gallery"),
                _createElementVNode("p", null, "Normal camera media and the separate Recognition image library.")
            ], -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_3, [
                _createElementVNode("button", {
                    class: _normalizeClass(['filter-btn', { active: $setup.galleryTab === 'camera' }]),
                    onClick: _cache[0] || (_cache[0] = $event => ($setup.galleryTab = 'camera'))
                }, "Camera", 2 /* CLASS */),
                _createElementVNode("button", {
                    class: _normalizeClass(['filter-btn', { active: $setup.galleryTab === 'recognition' }]),
                    onClick: $setup.openRecognition
                }, "Recognition", 2 /* CLASS */)
            ])
        ]),
        ($setup.galleryTab === 'camera')
            ? (_openBlock(), _createElementBlock(_Fragment, { key: 0 }, [
                _createElementVNode("div", _hoisted_4, [
                    _createElementVNode("div", _hoisted_5, [
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.filter === 'all' }]),
                            onClick: _cache[1] || (_cache[1] = $event => ($setup.filter = 'all'))
                        }, [
                            _cache[11] || (_cache[11] = _createTextVNode("All ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.camera.media.length), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.filter === 'photo' }]),
                            onClick: _cache[2] || (_cache[2] = $event => ($setup.filter = 'photo'))
                        }, [
                            _cache[12] || (_cache[12] = _createTextVNode("Photos ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.camera.photos.length), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.filter === 'video' }]),
                            onClick: _cache[3] || (_cache[3] = $event => ($setup.filter = 'video'))
                        }, [
                            _cache[13] || (_cache[13] = _createTextVNode("Videos ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.camera.videos.length), 1 /* TEXT */)
                        ], 2 /* CLASS */)
                    ]),
                    _createElementVNode("div", _hoisted_6, [
                        (!$setup.camera.galleryEntered)
                            ? (_openBlock(), _createElementBlock("button", {
                                key: 0,
                                class: "taf-btn",
                                onClick: _cache[4] || (_cache[4] = $event => ($setup.CameraMediaService.enterGallery()))
                            }, "Open gallery"))
                            : (_openBlock(), _createElementBlock("button", {
                                key: 1,
                                class: "taf-btn",
                                onClick: _cache[5] || (_cache[5] = $event => ($setup.CameraMediaService.refreshGallery()))
                            }, "↻ Refresh")),
                        ($setup.camera.galleryEntered)
                            ? (_openBlock(), _createElementBlock("button", {
                                key: 2,
                                class: "taf-btn",
                                onClick: _cache[6] || (_cache[6] = $event => ($setup.CameraMediaService.quitGallery()))
                            }, "Close"))
                            : _createCommentVNode("v-if", true)
                    ])
                ]),
                _createElementVNode("div", _hoisted_7, [
                    _createElementVNode("div", _hoisted_8, [
                        _createElementVNode("span", _hoisted_9, "Gallery: " + _toDisplayString($setup.camera.galleryState), 1 /* TEXT */),
                        ($setup.camera.download.active)
                            ? (_openBlock(), _createElementBlock("span", _hoisted_10, "Downloading " + _toDisplayString($setup.camera.download.fileName) + " · " + _toDisplayString($setup.camera.download.progress) + "%", 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                    ]),
                    _cache[14] || (_cache[14] = _createElementVNode("small", { class: "path-note" }, "Photos → Pictures/PotensicProxy/Camera/ · Videos → Movies/PotensicProxy/Camera/", -1 /* CACHED */))
                ]),
                ($setup.camera.galleryError)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_11, [
                        _cache[15] || (_cache[15] = _createElementVNode("strong", null, "Gallery error:", -1 /* CACHED */)),
                        _createTextVNode(" " + _toDisplayString($setup.camera.galleryError), 1 /* TEXT */)
                    ]))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("div", _hoisted_12, [
                    ($setup.camera.galleryLoading && ['OPENING', 'LOADING_COUNT', 'LOADING_LIST'].includes($setup.camera.galleryState))
                        ? (_openBlock(), _createElementBlock("div", _hoisted_13, [
                            _cache[16] || (_cache[16] = _createTextVNode("Reading media list… ", -1 /* CACHED */)),
                            _createElementVNode("small", null, _toDisplayString($setup.camera.galleryState), 1 /* TEXT */)
                        ]))
                        : ($setup.filteredMedia.length === 0)
                            ? (_openBlock(), _createElementBlock("div", _hoisted_14, _toDisplayString($setup.camera.galleryEntered ? 'No camera media loaded.' : 'Open the camera gallery to load photos and videos.'), 1 /* TEXT */))
                            : (_openBlock(), _createElementBlock("div", _hoisted_15, [
                                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.filteredMedia, (file) => {
                                    return (_openBlock(), _createElementBlock("article", {
                                        key: file.type + ':' + file.name,
                                        class: "media-card"
                                    }, [
                                        _createElementVNode("div", {
                                            class: _normalizeClass(["media-preview", file.type])
                                        }, [
                                            _createElementVNode("span", null, _toDisplayString(file.type === 'photo' ? '🖼️' : '🎞️'), 1 /* TEXT */),
                                            _createElementVNode("small", null, _toDisplayString(file.type === 'photo' ? 'PHOTO' : 'VIDEO'), 1 /* TEXT */)
                                        ], 2 /* CLASS */),
                                        _createElementVNode("div", _hoisted_16, [
                                            _createElementVNode("div", {
                                                class: "media-name",
                                                title: file.name
                                            }, _toDisplayString(file.name), 9 /* TEXT, PROPS */, _hoisted_17),
                                            _createElementVNode("div", _hoisted_18, _toDisplayString(file.type === 'photo' ? 'Photo' : 'Video'), 1 /* TEXT */),
                                            _createElementVNode("div", _hoisted_19, "🕒 " + _toDisplayString($setup.formatRemoteTimestamp(file)), 1 /* TEXT */)
                                        ]),
                                        _createElementVNode("div", _hoisted_20, [
                                            _createElementVNode("button", {
                                                class: "taf-btn taf-btn--compact",
                                                disabled: $setup.camera.download.active,
                                                onClick: $event => ($setup.download(file.name))
                                            }, _toDisplayString(file.type === 'photo' ? '↓ Save on Android' : '↓ Download'), 9 /* TEXT, PROPS */, _hoisted_21),
                                            _createElementVNode("button", {
                                                class: "taf-btn taf-btn--compact taf-btn--danger",
                                                disabled: $setup.camera.download.active,
                                                onClick: $event => ($setup.deleteFile(file.name))
                                            }, "Delete", 8 /* PROPS */, _hoisted_22)
                                        ])
                                    ]));
                                }), 128 /* KEYED_FRAGMENT */))
                            ]))
                ]),
                ($setup.camera.download.error)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_23, [
                        _cache[17] || (_cache[17] = _createElementVNode("strong", null, "Download failed:", -1 /* CACHED */)),
                        _createTextVNode(" " + _toDisplayString($setup.camera.download.error), 1 /* TEXT */)
                    ]))
                    : _createCommentVNode("v-if", true),
                _cache[18] || (_cache[18] = _createElementVNode("div", { class: "protocol-note" }, "Normal Camera path remains unchanged: camera/SD media is managed here. Saving a photo creates an Android copy in Pictures/PotensicProxy/Camera/ and does not automatically delete the drone source.", -1 /* CACHED */))
            ], 64 /* STABLE_FRAGMENT */))
            : (_openBlock(), _createElementBlock(_Fragment, { key: 1 }, [
                _createElementVNode("div", _hoisted_24, [
                    _cache[19] || (_cache[19] = _createElementVNode("div", null, [
                        _createElementVNode("div", { class: "ui-subtitle" }, "Recognition capture sources"),
                        _createElementVNode("small", null, "Both modes use the same Recognition library and metadata schema; only the image source differs.")
                    ], -1 /* CACHED */)),
                    _createElementVNode("div", _hoisted_25, [
                        _createElementVNode("button", {
                            class: "taf-btn",
                            disabled: $setup.recoBusy || $setup.camera.download.active,
                            onClick: $setup.captureLiveReco
                        }, "⚡ Live Reco", 8 /* PROPS */, _hoisted_26),
                        _createElementVNode("button", {
                            class: "taf-btn",
                            disabled: $setup.recoBusy || $setup.camera.download.active,
                            onClick: $setup.captureDroneReco
                        }, "📷 Drone Reco", 8 /* PROPS */, _hoisted_27),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            disabled: $setup.recoBusy,
                            onClick: $setup.loadRecognitionImages
                        }, "↻ Refresh", 8 /* PROPS */, _hoisted_28)
                    ])
                ]),
                _cache[26] || (_cache[26] = _createElementVNode("div", { class: "mode-explainer" }, [
                    _createElementVNode("div", { class: "mode-card ui-card" }, [
                        _createElementVNode("strong", null, "Live Reco"),
                        _createElementVNode("span", null, "Decoded LiveView frame → immediate Android save → Recognition pipeline."),
                        _createElementVNode("small", null, "No temporary photo exists on the drone.")
                    ]),
                    _createElementVNode("div", { class: "mode-card ui-card" }, [
                        _createElementVNode("strong", null, "Drone Reco"),
                        _createElementVNode("span", null, "Full camera photo → transfer → Android verification → drone delete acknowledgement."),
                        _createElementVNode("small", null, "If transfer or verification fails, the source remains on the drone.")
                    ])
                ], -1 /* CACHED */)),
                _createElementVNode("div", _hoisted_29, [
                    _createElementVNode("div", _hoisted_30, [
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.recoFilter === 'all' }]),
                            onClick: _cache[7] || (_cache[7] = $event => ($setup.recoFilter = 'all'))
                        }, [
                            _cache[20] || (_cache[20] = _createTextVNode("All ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.recognitionImages.length), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.recoFilter === 'live' }]),
                            onClick: _cache[8] || (_cache[8] = $event => ($setup.recoFilter = 'live'))
                        }, [
                            _cache[21] || (_cache[21] = _createTextVNode("Live ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.liveRecoCount), 1 /* TEXT */)
                        ], 2 /* CLASS */),
                        _createElementVNode("button", {
                            class: _normalizeClass(['filter-btn', { active: $setup.recoFilter === 'drone' }]),
                            onClick: _cache[9] || (_cache[9] = $event => ($setup.recoFilter = 'drone'))
                        }, [
                            _cache[22] || (_cache[22] = _createTextVNode("Drone ", -1 /* CACHED */)),
                            _createElementVNode("span", null, _toDisplayString($setup.droneRecoCount), 1 /* TEXT */)
                        ], 2 /* CLASS */)
                    ]),
                    _createElementVNode("div", _hoisted_31, [
                        _cache[23] || (_cache[23] = _createElementVNode("span", { class: "taf-status-field" }, "Pictures/PotensicProxy/Recognition/", -1 /* CACHED */)),
                        ($setup.recoBusy)
                            ? (_openBlock(), _createElementBlock("span", _hoisted_32, _toDisplayString($setup.recoStatus), 1 /* TEXT */))
                            : _createCommentVNode("v-if", true)
                    ])
                ]),
                ($setup.recoError)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_33, [
                        _cache[24] || (_cache[24] = _createElementVNode("strong", null, "Recognition capture:", -1 /* CACHED */)),
                        _createTextVNode(" " + _toDisplayString($setup.recoError), 1 /* TEXT */)
                    ]))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("div", _hoisted_34, [
                    ($setup.recognitionImages.length === 0)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_35, "No Recognition images saved yet."))
                        : (_openBlock(), _createElementBlock("div", _hoisted_36, [
                            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.filteredRecognitionImages, (item) => {
                                return (_openBlock(), _createElementBlock("article", {
                                    key: item.id,
                                    class: "android-card"
                                }, [
                                    _createElementVNode("div", _hoisted_37, [
                                        (item.mimeType !== 'image/x-adobe-dng')
                                            ? (_openBlock(), _createElementBlock("img", {
                                                key: 0,
                                                src: $setup.AndroidMediaService.imageUrl(item.id),
                                                alt: item.name
                                            }, null, 8 /* PROPS */, _hoisted_38))
                                            : (_openBlock(), _createElementBlock("div", _hoisted_39, "RAW / DNG")),
                                        _createElementVNode("span", {
                                            class: _normalizeClass(['source-badge', item.source === 'drone-reco' ? 'drone' : 'live'])
                                        }, _toDisplayString($setup.sourceLabel(item)), 3 /* TEXT, CLASS */),
                                        (item.verified)
                                            ? (_openBlock(), _createElementBlock("span", _hoisted_40, "✓ verified"))
                                            : _createCommentVNode("v-if", true)
                                    ]),
                                    _createElementVNode("div", _hoisted_41, [
                                        _createElementVNode("strong", {
                                            title: item.name
                                        }, _toDisplayString(item.name), 9 /* TEXT, PROPS */, _hoisted_42),
                                        _createElementVNode("small", null, _toDisplayString($setup.formatSize(item.size)) + " · " + _toDisplayString($setup.formatDate(item.captureTime || item.createdAt)), 1 /* TEXT */),
                                        ($setup.metadataSummary(item))
                                            ? (_openBlock(), _createElementBlock("small", _hoisted_43, _toDisplayString($setup.metadataSummary(item)), 1 /* TEXT */))
                                            : _createCommentVNode("v-if", true),
                                        (item.metadata)
                                            ? (_openBlock(), _createElementBlock("details", _hoisted_44, [
                                                _cache[25] || (_cache[25] = _createElementVNode("summary", null, "Metadata", -1 /* CACHED */)),
                                                _createElementVNode("pre", null, _toDisplayString($setup.prettyMetadata(item)), 1 /* TEXT */)
                                            ]))
                                            : _createCommentVNode("v-if", true)
                                    ])
                                ]));
                            }), 128 /* KEYED_FRAGMENT */))
                        ]))
                ]),
                _cache[27] || (_cache[27] = _createElementVNode("div", { class: "protocol-note" }, "Recognition entries store source, timestamp, available telemetry, GPS/height, attitude, gimbal, controls, camera state, connection state, SHA-256 and MediaStore verification status. Recognition model results can later be appended to the same metadata schema.", -1 /* CACHED */))
            ], 64 /* STABLE_FRAGMENT */))
    ]));
}
__sfc__.__scopeId = "data-v-8649638a";
__sfc__.render = render;
export default __sfc__;
