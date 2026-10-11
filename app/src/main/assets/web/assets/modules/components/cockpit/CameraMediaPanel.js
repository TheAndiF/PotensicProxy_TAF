import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, ref, watch } from '../../../vendor/vue.js';
import { CameraMediaService } from '../../services/CameraMediaService.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'CameraMediaPanel',
    props: {
        showTitle: { type: Boolean, required: false, default: true }
    },
    setup(__props, { expose: __expose }) {
        __expose();
        const camera = useCameraStore();
        const videoOptions = [
            { index: 0, label: '4K 30 fps' },
            { index: 1, label: '2.7K 30 fps' },
            { index: 2, label: '2K 30 fps' },
            { index: 3, label: '1080p 60 fps' },
            { index: 4, label: '720p 120 fps' }
        ];
        const photoOptions = [
            { index: 0, label: '16 MP' },
            { index: 1, label: '12 MP' },
            { index: 2, label: '8 MP' }
        ];
        const evOptions = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
        const isoOptions = [100, 200, 400, 800, 1600, 3200, 6400];
        const shutterOptions = [25, 30, 50, 60, 100, 120, 200, 250, 500, 1000, 2000, 4000, 8000];
        const videoIndex = ref(camera.videoResolutionIndex ?? 0);
        const photoIndex = ref(camera.photoResolutionIndex ?? 0);
        const videoEv = ref(camera.videoEv ?? 0);
        const photoEv = ref(camera.photoEv ?? 0);
        watch(() => camera.videoResolutionIndex, v => { if (v != null)
            videoIndex.value = v; });
        watch(() => camera.photoResolutionIndex, v => { if (v != null)
            photoIndex.value = v; });
        watch(() => camera.videoEv, v => { if (v != null)
            videoEv.value = v; });
        watch(() => camera.photoEv, v => { if (v != null)
            photoEv.value = v; });
        const sdStateLabel = computed(() => {
            const s = camera.sd.state;
            if (s == null)
                return 'unknown';
            const labels = {
                0: 'no card', 1: 'ready', 2: 'unrecognized', 4: 'format required', 5: 'full', 6: 'low speed', 7: 'unrecognized', 8: 'speed unstable'
            };
            return labels[s] ?? `code ${s}`;
        });
        function signed(value) { return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1); }
        function sizeLabel(value) { return value == null ? '—' : `${value} MB`; }
        function applyVideoResolution() { CameraMediaService.setVideoResolution(videoIndex.value); }
        function applyPhotoResolution() { CameraMediaService.setPhotoResolution(photoIndex.value); }
        function applyManual() {
            const m = camera.manualMode;
            CameraMediaService.setManualMode(m.manual, m.shutterDen, m.iso, m.manualWb, m.wb);
        }
        function formatSd() {
            if (window.confirm('Format the drone camera SD card? All files on the card will be erased.')) {
                CameraMediaService.formatSd();
            }
        }
        const __returned__ = { camera, videoOptions, photoOptions, evOptions, isoOptions, shutterOptions, videoIndex, photoIndex, videoEv, photoEv, sdStateLabel, signed, sizeLabel, applyVideoResolution, applyPhotoResolution, applyManual, formatSd, get CameraMediaService() { return CameraMediaService; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createElementVNode as _createElementVNode, renderList as _renderList, Fragment as _Fragment, toDisplayString as _toDisplayString, vModelSelect as _vModelSelect, withDirectives as _withDirectives, vModelText as _vModelText, vModelCheckbox as _vModelCheckbox, createTextVNode as _createTextVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "camera-media-panel ui-card" };
const _hoisted_2 = {
    key: 0,
    class: "panel-title"
};
const _hoisted_3 = { class: "camera-grid" };
const _hoisted_4 = { class: "camera-field" };
const _hoisted_5 = ["value"];
const _hoisted_6 = { class: "camera-field" };
const _hoisted_7 = ["value"];
const _hoisted_8 = { class: "camera-field" };
const _hoisted_9 = ["value"];
const _hoisted_10 = { class: "camera-field" };
const _hoisted_11 = ["value"];
const _hoisted_12 = { class: "manual-section" };
const _hoisted_13 = { class: "camera-grid" };
const _hoisted_14 = { class: "camera-field" };
const _hoisted_15 = { class: "camera-field" };
const _hoisted_16 = ["value"];
const _hoisted_17 = { class: "camera-field" };
const _hoisted_18 = ["value"];
const _hoisted_19 = { class: "camera-field" };
const _hoisted_20 = { class: "toggle-row" };
const _hoisted_21 = { class: "button-row" };
const _hoisted_22 = { class: "sd-row" };
const _hoisted_23 = { class: "taf-status-field" };
const _hoisted_24 = { class: "taf-status-field" };
const _hoisted_25 = { class: "taf-status-field" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        ($props.showTitle)
            ? (_openBlock(), _createElementBlock("div", _hoisted_2, "📷 Camera"))
            : _createCommentVNode("v-if", true),
        _createElementVNode("div", _hoisted_3, [
            _createElementVNode("label", _hoisted_4, [
                _cache[19] || (_cache[19] = _createElementVNode("span", null, "Video resolution", -1 /* CACHED */)),
                _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.videoIndex) = $event)),
                    class: "taf-input",
                    onChange: $setup.applyVideoResolution
                }, [
                    (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.videoOptions, (item) => {
                        return _createElementVNode("option", {
                            key: item.index,
                            value: item.index
                        }, _toDisplayString(item.label), 9 /* TEXT, PROPS */, _hoisted_5);
                    }), 64 /* STABLE_FRAGMENT */))
                ], 544 /* NEED_HYDRATION, NEED_PATCH */), [
                    [
                        _vModelSelect,
                        $setup.videoIndex,
                        void 0,
                        { number: true }
                    ]
                ])
            ]),
            _createElementVNode("label", _hoisted_6, [
                _cache[20] || (_cache[20] = _createElementVNode("span", null, "Photo resolution", -1 /* CACHED */)),
                _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.photoIndex) = $event)),
                    class: "taf-input",
                    onChange: $setup.applyPhotoResolution
                }, [
                    (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.photoOptions, (item) => {
                        return _createElementVNode("option", {
                            key: item.index,
                            value: item.index
                        }, _toDisplayString(item.label), 9 /* TEXT, PROPS */, _hoisted_7);
                    }), 64 /* STABLE_FRAGMENT */))
                ], 544 /* NEED_HYDRATION, NEED_PATCH */), [
                    [
                        _vModelSelect,
                        $setup.photoIndex,
                        void 0,
                        { number: true }
                    ]
                ])
            ]),
            _createElementVNode("label", _hoisted_8, [
                _cache[21] || (_cache[21] = _createElementVNode("span", null, "Video EV", -1 /* CACHED */)),
                _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.videoEv) = $event)),
                    class: "taf-input",
                    onChange: _cache[3] || (_cache[3] = $event => ($setup.CameraMediaService.setVideoEv($setup.videoEv)))
                }, [
                    (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.evOptions, (ev) => {
                        return _createElementVNode("option", {
                            key: ev,
                            value: ev
                        }, _toDisplayString($setup.signed(ev)), 9 /* TEXT, PROPS */, _hoisted_9);
                    }), 64 /* STABLE_FRAGMENT */))
                ], 544 /* NEED_HYDRATION, NEED_PATCH */), [
                    [
                        _vModelSelect,
                        $setup.videoEv,
                        void 0,
                        { number: true }
                    ]
                ])
            ]),
            _createElementVNode("label", _hoisted_10, [
                _cache[22] || (_cache[22] = _createElementVNode("span", null, "Photo EV", -1 /* CACHED */)),
                _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.photoEv) = $event)),
                    class: "taf-input",
                    onChange: _cache[5] || (_cache[5] = $event => ($setup.CameraMediaService.setPhotoEv($setup.photoEv)))
                }, [
                    (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.evOptions, (ev) => {
                        return _createElementVNode("option", {
                            key: ev,
                            value: ev
                        }, _toDisplayString($setup.signed(ev)), 9 /* TEXT, PROPS */, _hoisted_11);
                    }), 64 /* STABLE_FRAGMENT */))
                ], 544 /* NEED_HYDRATION, NEED_PATCH */), [
                    [
                        _vModelSelect,
                        $setup.photoEv,
                        void 0,
                        { number: true }
                    ]
                ])
            ])
        ]),
        _createElementVNode("div", _hoisted_12, [
            _cache[32] || (_cache[32] = _createElementVNode("div", { class: "ui-subtitle" }, "Manual camera controls", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_13, [
                _createElementVNode("label", _hoisted_14, [
                    _cache[24] || (_cache[24] = _createElementVNode("span", null, "Exposure mode", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("select", {
                        "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => (($setup.camera.manualMode.manual) = $event)),
                        class: "taf-input"
                    }, [...(_cache[23] || (_cache[23] = [
                            _createElementVNode("option", { value: false }, "Auto", -1 /* CACHED */),
                            _createElementVNode("option", { value: true }, "Manual", -1 /* CACHED */)
                        ]))], 512 /* NEED_PATCH */), [
                        [_vModelSelect, $setup.camera.manualMode.manual]
                    ])
                ]),
                _createElementVNode("label", _hoisted_15, [
                    _cache[25] || (_cache[25] = _createElementVNode("span", null, "Shutter", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("select", {
                        "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => (($setup.camera.manualMode.shutterDen) = $event)),
                        class: "taf-input"
                    }, [
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.shutterOptions, (d) => {
                            return _createElementVNode("option", {
                                key: d,
                                value: d
                            }, "1/" + _toDisplayString(d), 9 /* TEXT, PROPS */, _hoisted_16);
                        }), 64 /* STABLE_FRAGMENT */))
                    ], 512 /* NEED_PATCH */), [
                        [
                            _vModelSelect,
                            $setup.camera.manualMode.shutterDen,
                            void 0,
                            { number: true }
                        ]
                    ])
                ]),
                _createElementVNode("label", _hoisted_17, [
                    _cache[26] || (_cache[26] = _createElementVNode("span", null, "ISO", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("select", {
                        "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => (($setup.camera.manualMode.iso) = $event)),
                        class: "taf-input"
                    }, [
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.isoOptions, (v) => {
                            return _createElementVNode("option", {
                                key: v,
                                value: v
                            }, _toDisplayString(v), 9 /* TEXT, PROPS */, _hoisted_18);
                        }), 64 /* STABLE_FRAGMENT */))
                    ], 512 /* NEED_PATCH */), [
                        [
                            _vModelSelect,
                            $setup.camera.manualMode.iso,
                            void 0,
                            { number: true }
                        ]
                    ])
                ]),
                _createElementVNode("label", _hoisted_19, [
                    _cache[27] || (_cache[27] = _createElementVNode("span", null, "White balance (K)", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[9] || (_cache[9] = $event => (($setup.camera.manualMode.wb) = $event)),
                        type: "number",
                        min: "2000",
                        max: "10000",
                        step: "100",
                        class: "taf-input"
                    }, null, 512 /* NEED_PATCH */), [
                        [
                            _vModelText,
                            $setup.camera.manualMode.wb,
                            void 0,
                            { number: true }
                        ]
                    ])
                ])
            ]),
            _createElementVNode("div", _hoisted_20, [
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => (($setup.camera.manualMode.manualWb) = $event)),
                        type: "checkbox"
                    }, null, 512 /* NEED_PATCH */), [
                        [_vModelCheckbox, $setup.camera.manualMode.manualWb]
                    ]),
                    _cache[28] || (_cache[28] = _createTextVNode(" Manual WB", -1 /* CACHED */))
                ]),
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => (($setup.camera.manualMode.raw) = $event)),
                        type: "checkbox",
                        onChange: _cache[12] || (_cache[12] = $event => ($setup.CameraMediaService.setRaw($setup.camera.manualMode.raw)))
                    }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                        [_vModelCheckbox, $setup.camera.manualMode.raw]
                    ]),
                    _cache[29] || (_cache[29] = _createTextVNode(" RAW", -1 /* CACHED */))
                ]),
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => (($setup.camera.manualMode.photoOsd) = $event)),
                        type: "checkbox",
                        onChange: _cache[14] || (_cache[14] = $event => ($setup.CameraMediaService.setPhotoOsd($setup.camera.manualMode.photoOsd)))
                    }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                        [_vModelCheckbox, $setup.camera.manualMode.photoOsd]
                    ]),
                    _cache[30] || (_cache[30] = _createTextVNode(" Photo OSD", -1 /* CACHED */))
                ]),
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => (($setup.camera.manualMode.photoGps) = $event)),
                        type: "checkbox",
                        onChange: _cache[16] || (_cache[16] = $event => ($setup.CameraMediaService.setPhotoGps($setup.camera.manualMode.photoGps)))
                    }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                        [_vModelCheckbox, $setup.camera.manualMode.photoGps]
                    ]),
                    _cache[31] || (_cache[31] = _createTextVNode(" Photo GPS", -1 /* CACHED */))
                ])
            ]),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--compact",
                onClick: $setup.applyManual
            }, "Apply manual exposure / WB")
        ]),
        _createElementVNode("div", _hoisted_21, [
            _createElementVNode("button", {
                class: "taf-btn taf-btn--compact",
                onClick: _cache[17] || (_cache[17] = $event => ($setup.CameraMediaService.refreshSettings()))
            }, "↻ Read camera"),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--compact",
                onClick: _cache[18] || (_cache[18] = $event => ($setup.CameraMediaService.getSdStatus()))
            }, "💾 SD status"),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--compact taf-btn--danger",
                onClick: $setup.formatSd
            }, "Format SD")
        ]),
        _createElementVNode("div", _hoisted_22, [
            _createElementVNode("span", _hoisted_23, "SD: " + _toDisplayString($setup.sdStateLabel), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_24, "Free: " + _toDisplayString($setup.sizeLabel($setup.camera.sd.freeMb)), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_25, "Total: " + _toDisplayString($setup.sizeLabel($setup.camera.sd.totalMb)), 1 /* TEXT */)
        ]),
        _cache[33] || (_cache[33] = _createElementVNode("div", { class: "protocol-note" }, "PotensicPro USB camera path: FE 0x15 → FF FD → message 0x0020.", -1 /* CACHED */))
    ]));
}
__sfc__.__scopeId = "data-v-86e0e1b1";
__sfc__.render = render;
export default __sfc__;
