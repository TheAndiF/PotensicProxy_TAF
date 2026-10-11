import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from '../../../vendor/vue.js';
import VideoPlayer from './VideoPlayer.js';
import MapView from './MapView.js';
import TelemetryBar from './TelemetryBar.js';
import VirtualJoystick from './VirtualJoystick.js';
import GimbalControl from './GimbalControl.js';
import LandingAssistPanel from './LandingAssistPanel.js';
import FlightActions from './FlightActions.js';
import CameraMediaPanel from './CameraMediaPanel.js';
import TelemetryDetails from './TelemetryDetails.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { PrecisionStartService } from '../../services/PrecisionStartService.js';
import { useCockpitViewSettings } from '../../composables/useCockpitViewSettings.js';
const hiddenTarget = '#hidden-view-slot';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'CockpitView',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const { mainView, pipVisible, pipPosition, swapViews } = useCockpitViewSettings();
        const teleportsReady = ref(false);
        const viewMenuOpen = ref(false);
        const cameraOpen = ref(localStorage.getItem('potensic-camera-panel-open') !== 'false');
        watch(cameraOpen, value => localStorage.setItem('potensic-camera-panel-open', String(value)));
        const telemetryOpen = ref(localStorage.getItem('potensic-telemetry-panel-open') === 'true');
        watch(telemetryOpen, value => localStorage.setItem('potensic-telemetry-panel-open', String(value)));
        const secondaryTarget = computed(() => pipPosition.value === 'controls' ? '#pip-controls-slot' : '#pip-overlay-slot');
        const videoTarget = computed(() => mainView.value === 'video' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget));
        const mapTarget = computed(() => mainView.value === 'map' ? '#main-stage-slot' : (pipVisible.value ? secondaryTarget.value : hiddenTarget));
        const secondaryLabel = computed(() => mainView.value === 'video' ? 'Map' : 'Liveview');
        onMounted(async () => { await nextTick(); teleportsReady.value = true; });
        async function notifyViewResize() { await nextTick(); requestAnimationFrame(() => window.dispatchEvent(new CustomEvent('cockpit-view-resized'))); }
        watch([mainView, pipVisible, pipPosition], notifyViewResize, { flush: 'post' });
        const leftStickModel = computed({
            get: () => ({ x: store.userJoysticks.yaw, y: store.userJoysticks.throttle }),
            set: v => { store.userJoysticks.yaw = v.x; store.userJoysticks.throttle = v.y; },
        });
        const rightStickModel = computed({
            get: () => ({ x: store.userJoysticks.roll, y: store.userJoysticks.pitch }),
            set: v => { store.userJoysticks.roll = v.x; store.userJoysticks.pitch = v.y; },
        });
        let leftControlActive = false;
        let rightControlActive = false;
        let landingControlActive = false;
        let axisTimer = null;
        let lastSend = 0;
        function sendAxesNow() {
            lastSend = Date.now();
            DroneControlService.sendJoysticks();
        }
        function ensureAxisLoop() {
            if (axisTimer)
                return;
            sendAxesNow();
            // PotensicPro DataManager.startSend4Axis() transmits every 80 ms.
            axisTimer = setInterval(sendAxesNow, 80);
        }
        function maybeStopAxisLoop() {
            if (leftControlActive || rightControlActive || landingControlActive || store.gimbalControl.active)
                return;
            if (axisTimer) {
                clearInterval(axisTimer);
                axisTimer = null;
            }
            // Send a neutral frame immediately after both sticks have been released.
            sendAxesNow();
        }
        function startLeftControl() { PrecisionStartService.notifyManualControl('linker Steuerknüppel'); leftControlActive = true; ensureAxisLoop(); }
        function stopLeftControl() { leftControlActive = false; maybeStopAxisLoop(); }
        function startRightControl() { PrecisionStartService.notifyManualControl('rechter Steuerknüppel'); rightControlActive = true; ensureAxisLoop(); }
        function stopRightControl() { rightControlActive = false; maybeStopAxisLoop(); }
        function startLandingControl() { PrecisionStartService.notifyManualControl('Landehilfe/Feinsteuerung'); landingControlActive = true; ensureAxisLoop(); }
        function stopLandingControl() { landingControlActive = false; maybeStopAxisLoop(); }
        function onLandingControlChange() { if (Date.now() - lastSend >= 80)
            sendAxesNow(); }
        function onJoystickChange() { if (Date.now() - lastSend >= 80)
            sendAxesNow(); }
        function onRightStickChange(v) {
            store.userJoysticks.roll = v.x;
            store.userJoysticks.pitch = v.y;
            if (Date.now() - lastSend >= 80)
                sendAxesNow();
        }
        watch(() => store.gimbalControl.active, active => {
            if (active)
                ensureAxisLoop();
            else
                maybeStopAxisLoop();
        });
        onBeforeUnmount(() => {
            DroneControlService.stopDirectGimbal('cockpit left');
            if (axisTimer) {
                sendAxesNow();
                clearInterval(axisTimer);
                axisTimer = null;
            }
        });
        const __returned__ = { store, mainView, pipVisible, pipPosition, swapViews, teleportsReady, viewMenuOpen, cameraOpen, telemetryOpen, secondaryTarget, hiddenTarget, videoTarget, mapTarget, secondaryLabel, notifyViewResize, leftStickModel, rightStickModel, get leftControlActive() { return leftControlActive; }, set leftControlActive(v) { leftControlActive = v; }, get rightControlActive() { return rightControlActive; }, set rightControlActive(v) { rightControlActive = v; }, get landingControlActive() { return landingControlActive; }, set landingControlActive(v) { landingControlActive = v; }, get axisTimer() { return axisTimer; }, set axisTimer(v) { axisTimer = v; }, get lastSend() { return lastSend; }, set lastSend(v) { lastSend = v; }, sendAxesNow, ensureAxisLoop, maybeStopAxisLoop, startLeftControl, stopLeftControl, startRightControl, stopRightControl, startLandingControl, stopLandingControl, onLandingControlChange, onJoystickChange, onRightStickChange, VideoPlayer, MapView, TelemetryBar, VirtualJoystick, GimbalControl, LandingAssistPanel, FlightActions, CameraMediaPanel, TelemetryDetails };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, vShow as _vShow, withDirectives as _withDirectives, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createVNode as _createVNode, Teleport as _Teleport, createBlock as _createBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "cockpit-layout" };
const _hoisted_2 = { class: "left-section" };
const _hoisted_3 = { class: "flight-stage" };
const _hoisted_4 = ["title"];
const _hoisted_5 = {
    key: 0,
    class: "view-toolbar"
};
const _hoisted_6 = { class: "right-panel" };
const _hoisted_7 = { class: "joysticks-container" };
const _hoisted_8 = { class: "camera-section ui-card" };
const _hoisted_9 = ["aria-expanded"];
const _hoisted_10 = {
    key: 0,
    class: "camera-section-body"
};
const _hoisted_11 = { class: "telemetry-section ui-card" };
const _hoisted_12 = ["aria-expanded"];
const _hoisted_13 = {
    key: 0,
    class: "telemetry-section-body"
};
const _hoisted_14 = { class: "controls-pip-section" };
const _hoisted_15 = { class: "panel-title" };
const _hoisted_16 = {
    key: 0,
    class: "small-view-label"
};
const _hoisted_17 = {
    key: 0,
    class: "small-view-label"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
                _cache[10] || (_cache[10] = _createElementVNode("div", {
                    id: "main-stage-slot",
                    class: "main-stage-slot"
                }, null, -1 /* CACHED */)),
                _cache[11] || (_cache[11] = _createElementVNode("div", {
                    id: "hidden-view-slot",
                    class: "hidden-view-slot",
                    "aria-hidden": "true"
                }, null, -1 /* CACHED */)),
                _withDirectives(_createElementVNode("div", {
                    id: "pip-overlay-slot",
                    class: "pip-slot pip-overlay-slot",
                    title: "Swap Liveview and map",
                    onClick: _cache[0] || (_cache[0] = (...args) => ($setup.swapViews && $setup.swapViews(...args)))
                }, null, 512 /* NEED_PATCH */), [
                    [_vShow, $setup.pipVisible && $setup.pipPosition === 'overlay']
                ]),
                _createElementVNode("div", {
                    class: _normalizeClass(["view-drawer", { open: $setup.viewMenuOpen }])
                }, [
                    _createElementVNode("button", {
                        class: "view-drawer-toggle",
                        type: "button",
                        title: $setup.viewMenuOpen ? 'Hide view controls' : 'Show view controls',
                        onClick: _cache[1] || (_cache[1] = $event => ($setup.viewMenuOpen = !$setup.viewMenuOpen))
                    }, _toDisplayString($setup.viewMenuOpen ? '›' : '‹'), 9 /* TEXT, PROPS */, _hoisted_4),
                    ($setup.viewMenuOpen)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_5, [
                            _createElementVNode("button", {
                                class: _normalizeClass({ active: $setup.mainView === 'video' }),
                                onClick: _cache[2] || (_cache[2] = $event => ($setup.mainView = 'video'))
                            }, "LIVE", 2 /* CLASS */),
                            _createElementVNode("button", {
                                class: _normalizeClass({ active: $setup.mainView === 'map' }),
                                onClick: _cache[3] || (_cache[3] = $event => ($setup.mainView = 'map'))
                            }, "MAP", 2 /* CLASS */),
                            _createElementVNode("button", {
                                class: _normalizeClass({ active: $setup.pipVisible }),
                                onClick: _cache[4] || (_cache[4] = $event => ($setup.pipVisible = !$setup.pipVisible))
                            }, "PIP", 2 /* CLASS */)
                        ]))
                        : _createCommentVNode("v-if", true)
                ], 2 /* CLASS */),
                _createVNode($setup["TelemetryBar"], { class: "stage-status-overlay" })
            ])
        ]),
        _createElementVNode("div", _hoisted_6, [
            _cache[14] || (_cache[14] = _createElementVNode("div", { class: "panel-title" }, "🕹️ Joystick Control", -1 /* CACHED */)),
            _createElementVNode("div", _hoisted_7, [
                _createVNode($setup["VirtualJoystick"], {
                    label: "Throttle / Yaw",
                    "value-labels": ['Throttle', 'Yaw'],
                    modelValue: $setup.leftStickModel,
                    "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.leftStickModel) = $event)),
                    "rc-echo": { x: $setup.store.rcHardwareJoysticks.yaw, y: $setup.store.rcHardwareJoysticks.throttle },
                    onChange: $setup.onJoystickChange,
                    onControlStart: $setup.startLeftControl,
                    onControlEnd: $setup.stopLeftControl
                }, null, 8 /* PROPS */, ["modelValue", "rc-echo"]),
                _createVNode($setup["VirtualJoystick"], {
                    label: "Pitch / Roll",
                    "value-labels": ['Pitch', 'Roll'],
                    modelValue: $setup.rightStickModel,
                    "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => (($setup.rightStickModel) = $event)),
                    "rc-echo": { x: $setup.store.rcHardwareJoysticks.roll, y: $setup.store.rcHardwareJoysticks.pitch },
                    onChange: $setup.onRightStickChange,
                    onControlStart: $setup.startRightControl,
                    onControlEnd: $setup.stopRightControl
                }, null, 8 /* PROPS */, ["modelValue", "rc-echo"])
            ]),
            _createVNode($setup["GimbalControl"]),
            _createVNode($setup["LandingAssistPanel"], {
                onControlStart: $setup.startLandingControl,
                onControlEnd: $setup.stopLandingControl,
                onChange: $setup.onLandingControlChange
            }),
            _createVNode($setup["FlightActions"]),
            _createElementVNode("section", _hoisted_8, [
                _createElementVNode("button", {
                    class: "camera-section-header",
                    type: "button",
                    onClick: _cache[7] || (_cache[7] = $event => ($setup.cameraOpen = !$setup.cameraOpen)),
                    "aria-expanded": $setup.cameraOpen
                }, [
                    _cache[12] || (_cache[12] = _createElementVNode("span", null, "📷 Camera", -1 /* CACHED */)),
                    _createElementVNode("span", null, _toDisplayString($setup.cameraOpen ? '▾' : '▸'), 1 /* TEXT */)
                ], 8 /* PROPS */, _hoisted_9),
                ($setup.cameraOpen)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_10, [
                        _createVNode($setup["CameraMediaPanel"], { "show-title": false })
                    ]))
                    : _createCommentVNode("v-if", true)
            ]),
            _createElementVNode("section", _hoisted_11, [
                _createElementVNode("button", {
                    class: "telemetry-section-header",
                    type: "button",
                    onClick: _cache[8] || (_cache[8] = $event => ($setup.telemetryOpen = !$setup.telemetryOpen)),
                    "aria-expanded": $setup.telemetryOpen
                }, [
                    _cache[13] || (_cache[13] = _createElementVNode("span", null, "📡 Telemetrie", -1 /* CACHED */)),
                    _createElementVNode("span", null, _toDisplayString($setup.telemetryOpen ? '▾' : '▸'), 1 /* TEXT */)
                ], 8 /* PROPS */, _hoisted_12),
                ($setup.telemetryOpen)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_13, [
                        _createVNode($setup["TelemetryDetails"])
                    ]))
                    : _createCommentVNode("v-if", true)
            ]),
            _withDirectives(_createElementVNode("div", _hoisted_14, [
                _createElementVNode("div", _hoisted_15, _toDisplayString($setup.secondaryLabel) + " preview", 1 /* TEXT */),
                _createElementVNode("div", {
                    id: "pip-controls-slot",
                    class: "pip-slot pip-controls-slot",
                    title: "Swap Liveview and map",
                    onClick: _cache[9] || (_cache[9] = (...args) => ($setup.swapViews && $setup.swapViews(...args)))
                })
            ], 512 /* NEED_PATCH */), [
                [_vShow, $setup.pipVisible && $setup.pipPosition === 'controls']
            ])
        ]),
        ($setup.teleportsReady)
            ? (_openBlock(), _createBlock(_Teleport, {
                key: 0,
                to: $setup.videoTarget
            }, [
                _createElementVNode("div", {
                    class: _normalizeClass(['teleported-view', { 'small-view': $setup.mainView !== 'video' }])
                }, [
                    _createVNode($setup["VideoPlayer"], {
                        compact: $setup.mainView !== 'video'
                    }, null, 8 /* PROPS */, ["compact"]),
                    ($setup.mainView !== 'video')
                        ? (_openBlock(), _createElementBlock("span", _hoisted_16, "VIDEO"))
                        : _createCommentVNode("v-if", true)
                ], 2 /* CLASS */)
            ], 8 /* PROPS */, ["to"]))
            : _createCommentVNode("v-if", true),
        ($setup.teleportsReady)
            ? (_openBlock(), _createBlock(_Teleport, {
                key: 1,
                to: $setup.mapTarget
            }, [
                _createElementVNode("div", {
                    class: _normalizeClass(['teleported-view', { 'small-view': $setup.mainView !== 'map', 'small-map-view': $setup.mainView !== 'map' }])
                }, [
                    _createVNode($setup["MapView"], {
                        "show-data-mode": $setup.mainView === 'map',
                        compact: $setup.mainView !== 'map'
                    }, null, 8 /* PROPS */, ["show-data-mode", "compact"]),
                    ($setup.mainView !== 'map')
                        ? (_openBlock(), _createElementBlock("span", _hoisted_17, "MAP"))
                        : _createCommentVNode("v-if", true)
                ], 2 /* CLASS */)
            ], 8 /* PROPS */, ["to"]))
            : _createCommentVNode("v-if", true)
    ]));
}
__sfc__.__scopeId = "data-v-0d64152c";
__sfc__.render = render;
export default __sfc__;
