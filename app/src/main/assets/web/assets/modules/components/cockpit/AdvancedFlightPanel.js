import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, reactive, ref, watch } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'AdvancedFlightPanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const t = store.telemetry;
        const limits = reactive({ height: 0, distance: 0, rth: 0, beginner: false, american: true, speedMode: 1 });
        const waypoints = ref('');
        const waypointStatus = ref('');
        watch(() => [t.settingsValid, t.limitHeight, t.limitDistance, t.returnHeight, t.beginnerMode, t.americaRockerMode, t.settingSpeedMode], () => {
            if (!t.settingsValid)
                return;
            limits.height = t.limitHeight || 0;
            limits.distance = t.limitDistance || 0;
            limits.rth = t.returnHeight || 0;
            limits.beginner = !!t.beginnerMode;
            limits.american = t.americaRockerMode !== false;
            limits.speedMode = t.settingSpeedMode == null || t.settingSpeedMode < 0 ? 1 : t.settingSpeedMode;
        }, { immediate: true });
        const flightState = computed(() => t.returning ? 'RTH' : t.landing ? 'landing' : t.takingOff ? 'takeoff' : t.flying ? 'flying' : t.unlocked ? 'armed' : 'ground');
        function coord(lat, lng) { return lat && lng ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '—'; }
        function applyLimits() {
            DroneControlService.applyFlightSettings({
                limitHeight: limits.height, limitDistance: limits.distance, returnHeight: limits.rth,
                beginnerMode: limits.beginner, americaRockerMode: limits.american,
                surroundRadius: t.surroundRadius || 0, clockwise: t.surroundClockwise !== false,
                surroundSpeed: t.surroundSpeed || 0, speedMode: limits.speedMode
            });
        }
        function uploadWaypoints() {
            try {
                const points = waypoints.value.split(/\r?\n/).map(v => v.trim()).filter(Boolean).map(line => {
                    const [a, b] = line.split(',').map(Number);
                    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180)
                        throw new Error(`Invalid waypoint: ${line}`);
                    return { lat: a, lng: b };
                });
                if (!points.length)
                    throw new Error('No waypoints entered');
                DroneControlService.uploadMultiPoint(points);
                waypointStatus.value = `${points.length} waypoint(s) sent`;
            }
            catch (e) {
                waypointStatus.value = e?.message || String(e);
            }
        }
        const __returned__ = { store, t, limits, waypoints, waypointStatus, flightState, coord, applyLimits, uploadWaypoints, get DroneControlService() { return DroneControlService; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, vModelText as _vModelText, withDirectives as _withDirectives, vModelSelect as _vModelSelect, vModelCheckbox as _vModelCheckbox, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "advanced-panel ui-card" };
const _hoisted_2 = { class: "status-grid" };
const _hoisted_3 = { class: "taf-status-field" };
const _hoisted_4 = { class: "taf-status-field" };
const _hoisted_5 = { class: "taf-status-field" };
const _hoisted_6 = { class: "section" };
const _hoisted_7 = { class: "form-grid" };
const _hoisted_8 = { class: "toggle-row" };
const _hoisted_9 = ["disabled"];
const _hoisted_10 = {
    key: 0,
    class: "note"
};
const _hoisted_11 = { class: "section" };
const _hoisted_12 = { class: "button-row" };
const _hoisted_13 = { class: "button-row" };
const _hoisted_14 = { class: "note" };
const _hoisted_15 = { class: "section" };
const _hoisted_16 = { class: "button-row" };
const _hoisted_17 = { class: "button-row" };
const _hoisted_18 = ["disabled"];
const _hoisted_19 = { class: "section" };
const _hoisted_20 = { class: "position-row" };
const _hoisted_21 = { class: "position-row" };
const _hoisted_22 = { class: "position-row" };
const _hoisted_23 = { class: "button-row" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _cache[34] || (_cache[34] = _createElementVNode("div", { class: "panel-title" }, "⚙️ Flight / Calibration / Smart Modes", -1 /* CACHED */)),
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("span", _hoisted_3, "Flight: " + _toDisplayString($setup.flightState), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_4, "GPS: " + _toDisplayString($setup.t.receiveGps ? 'OK' : '—'), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_5, "RC: " + _toDisplayString($setup.t.remoterConnected ? 'linked' : '—'), 1 /* TEXT */),
            _createElementVNode("span", {
                class: _normalizeClass(["taf-status-field", { warning: $setup.t.flightInNoFlyZone || $setup.t.locatedNoFlyZone }])
            }, "No-fly: " + _toDisplayString($setup.t.flightInNoFlyZone || $setup.t.locatedNoFlyZone ? 'INSIDE' : $setup.t.nearNoFlyZone ? 'near' : 'clear'), 3 /* TEXT, CLASS */)
        ]),
        _createElementVNode("div", _hoisted_6, [
            _cache[28] || (_cache[28] = _createElementVNode("div", { class: "ui-subtitle" }, "Flight limits & RTH", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_7, [
                _createElementVNode("label", null, [
                    _cache[21] || (_cache[21] = _createElementVNode("span", null, "Max height (m)", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.limits.height) = $event)),
                        type: "number",
                        min: "0",
                        class: "taf-input"
                    }, null, 512 /* NEED_PATCH */), [
                        [
                            _vModelText,
                            $setup.limits.height,
                            void 0,
                            { number: true }
                        ]
                    ])
                ]),
                _createElementVNode("label", null, [
                    _cache[22] || (_cache[22] = _createElementVNode("span", null, "Max distance (m)", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.limits.distance) = $event)),
                        type: "number",
                        min: "0",
                        class: "taf-input"
                    }, null, 512 /* NEED_PATCH */), [
                        [
                            _vModelText,
                            $setup.limits.distance,
                            void 0,
                            { number: true }
                        ]
                    ])
                ]),
                _createElementVNode("label", null, [
                    _cache[23] || (_cache[23] = _createElementVNode("span", null, "RTH height (m)", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.limits.rth) = $event)),
                        type: "number",
                        min: "0",
                        class: "taf-input"
                    }, null, 512 /* NEED_PATCH */), [
                        [
                            _vModelText,
                            $setup.limits.rth,
                            void 0,
                            { number: true }
                        ]
                    ])
                ]),
                _createElementVNode("label", null, [
                    _cache[25] || (_cache[25] = _createElementVNode("span", null, "Speed mode", -1 /* CACHED */)),
                    _withDirectives(_createElementVNode("select", {
                        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.limits.speedMode) = $event)),
                        class: "taf-input"
                    }, [...(_cache[24] || (_cache[24] = [
                            _createElementVNode("option", { value: 0 }, "Video", -1 /* CACHED */),
                            _createElementVNode("option", { value: 1 }, "Normal", -1 /* CACHED */),
                            _createElementVNode("option", { value: 2 }, "Sport", -1 /* CACHED */)
                        ]))], 512 /* NEED_PATCH */), [
                        [
                            _vModelSelect,
                            $setup.limits.speedMode,
                            void 0,
                            { number: true }
                        ]
                    ])
                ])
            ]),
            _createElementVNode("div", _hoisted_8, [
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.limits.beginner) = $event)),
                        type: "checkbox"
                    }, null, 512 /* NEED_PATCH */), [
                        [_vModelCheckbox, $setup.limits.beginner]
                    ]),
                    _cache[26] || (_cache[26] = _createTextVNode(" Beginner mode", -1 /* CACHED */))
                ]),
                _createElementVNode("label", null, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.limits.american) = $event)),
                        type: "checkbox"
                    }, null, 512 /* NEED_PATCH */), [
                        [_vModelCheckbox, $setup.limits.american]
                    ]),
                    _cache[27] || (_cache[27] = _createTextVNode(" American stick mode", -1 /* CACHED */))
                ])
            ]),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--compact",
                disabled: !$setup.t.settingsValid,
                onClick: $setup.applyLimits
            }, "Apply confirmed 0x0003 settings", 8 /* PROPS */, _hoisted_9),
            (!$setup.t.settingsValid)
                ? (_openBlock(), _createElementBlock("div", _hoisted_10, "Waiting for flight-setting telemetry (0x0003) before editing."))
                : _createCommentVNode("v-if", true)
        ]),
        _createElementVNode("div", _hoisted_11, [
            _cache[29] || (_cache[29] = _createElementVNode("div", { class: "ui-subtitle" }, "Intelligent flight modes", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_12, [
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[6] || (_cache[6] = $event => ($setup.DroneControlService.setFollowMode()))
                }, "Follow"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[7] || (_cache[7] = $event => ($setup.DroneControlService.setCircleMode()))
                }, "Circle"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[8] || (_cache[8] = $event => ($setup.DroneControlService.setPointFlyMode()))
                }, "Point Fly"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact taf-btn--danger",
                    onClick: _cache[9] || (_cache[9] = $event => ($setup.DroneControlService.cancelAutoFly()))
                }, "Cancel auto")
            ]),
            _withDirectives(_createElementVNode("textarea", {
                "onUpdate:modelValue": _cache[10] || (_cache[10] = $event => (($setup.waypoints) = $event)),
                class: "taf-textarea",
                rows: "3",
                placeholder: "Waypoint per line: latitude,longitude"
            }, null, 512 /* NEED_PATCH */), [
                [_vModelText, $setup.waypoints]
            ]),
            _createElementVNode("div", _hoisted_13, [
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: $setup.uploadWaypoints
                }, "Upload route"),
                _createElementVNode("span", _hoisted_14, _toDisplayString($setup.waypointStatus), 1 /* TEXT */)
            ])
        ]),
        _createElementVNode("div", _hoisted_15, [
            _cache[30] || (_cache[30] = _createElementVNode("div", { class: "ui-subtitle" }, "Calibration", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_16, [
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[11] || (_cache[11] = $event => ($setup.DroneControlService.setImuCalibrationOfficial(true)))
                }, "IMU start"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[12] || (_cache[12] = $event => ($setup.DroneControlService.setImuCalibrationOfficial(false)))
                }, "IMU stop"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[13] || (_cache[13] = $event => ($setup.DroneControlService.setRemoteCalibration(true)))
                }, "RC start"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[14] || (_cache[14] = $event => ($setup.DroneControlService.setRemoteCalibration(false)))
                }, "RC stop")
            ]),
            _createElementVNode("div", _hoisted_17, [
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[15] || (_cache[15] = $event => ($setup.DroneControlService.setCompassCalibrationSession(true)))
                }, "Compass enter"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[16] || (_cache[16] = $event => ($setup.DroneControlService.setCompassCalibrationSession(false)))
                }, "Compass exit"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[17] || (_cache[17] = $event => ($setup.DroneControlService.requestGimbalSettings()))
                }, "Read gimbal"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    disabled: !$setup.t.gimbalSettingsValid,
                    onClick: _cache[18] || (_cache[18] = $event => ($setup.DroneControlService.calibrateGimbal()))
                }, "Gimbal calibrate", 8 /* PROPS */, _hoisted_18)
            ]),
            _cache[31] || (_cache[31] = _createElementVNode("div", { class: "note" }, "Compass session entry/exit is protocol-confirmed. PotensicPro computes the magnetometer calibration result in native JNI code; TAF does not invent that native solver.", -1 /* CACHED */))
        ]),
        _createElementVNode("div", _hoisted_19, [
            _cache[32] || (_cache[32] = _createElementVNode("div", { class: "ui-subtitle" }, "Find My Drone / geofence status", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_20, "Drone: " + _toDisplayString($setup.coord($setup.t.latitude, $setup.t.longitude)), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_21, "Home: " + _toDisplayString($setup.t.homeSynced ? $setup.coord($setup.t.homeLatitude || 0, $setup.t.homeLongitude || 0) : 'not synced'), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_22, "Zone: height limit " + _toDisplayString($setup.t.noFlyHeightLimit || 0) + ", distance " + _toDisplayString($setup.t.noFlyDistance || 0), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_23, [
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[19] || (_cache[19] = $event => ($setup.DroneControlService.setFindDroneBeep(true)))
                }, "🔊 Beep on"),
                _createElementVNode("button", {
                    class: "taf-btn taf-btn--compact",
                    onClick: _cache[20] || (_cache[20] = $event => ($setup.DroneControlService.setFindDroneBeep(false)))
                }, "🔇 Beep off")
            ]),
            _cache[33] || (_cache[33] = _createElementVNode("div", { class: "note" }, "Aircraft no-fly-state is decoded from Potensic 0x0002. PotensicPro's map-zone geometry comes from separate app/server data; no unverified zone-download protocol is added.", -1 /* CACHED */))
        ])
    ]));
}
__sfc__.__scopeId = "data-v-a4c92156";
__sfc__.render = render;
export default __sfc__;
