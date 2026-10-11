import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, onMounted, ref, watch } from '../../../vendor/vue.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
import { CameraMediaService } from '../../services/CameraMediaService.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { PrecisionStartService } from '../../services/PrecisionStartService.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
const MIN_ZOOM = 1;
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'GimbalControl',
    setup(__props, { expose: __expose }) {
        __expose();
        const camera = useCameraStore();
        const store = useDroneStore();
        const MAX_ZOOM = computed(() => Math.max(MIN_ZOOM, camera.zoomMax || 4));
        const pendingGimbalAngle = ref(null);
        const targetZoom = computed(() => camera.zoomTarget);
        const actualGimbal = computed(() => store.telemetry.gimbalStateValid ? (store.telemetry.gimbalPitch ?? null) : null);
        const actualZoom = computed(() => camera.zoomActual);
        const dialRef = ref(null);
        const zoomDialRef = ref(null);
        let dragging = false;
        let zoomDragging = false;
        const gimbalKnobStyle = computed(() => {
            const travel = 70;
            const command = Math.max(-1000, Math.min(1000, store.gimbalControl.command));
            const y = -(command / 1000) * (travel / 2);
            return { transform: `translate(-50%, calc(-50% + ${y}px))` };
        });
        const zoomKnobStyle = computed(() => {
            const normalized = (targetZoom.value - MIN_ZOOM) / Math.max(0.01, MAX_ZOOM.value - MIN_ZOOM);
            const travel = 70;
            const y = travel / 2 - normalized * travel;
            return { transform: `translate(-50%, calc(-50% + ${y}px))` };
        });
        const actualGimbalText = computed(() => actualGimbal.value == null ? '--' : `${actualGimbal.value.toFixed(0)}°`);
        const gimbalCommandText = computed(() => `${store.gimbalControl.command >= 0 ? '+' : ''}${Math.round(store.gimbalControl.command / 10)}%`);
        const actualZoomText = computed(() => actualZoom.value == null ? '--' : `${actualZoom.value.toFixed(2)}x`);
        const gimbalStatus = computed(() => pendingGimbalAngle.value != null ? 'Warte auf Gimbal-Einstellungen …' : store.gimbalControl.active ? (store.gimbalControl.command > 0 ? 'Fährt aufwärts' : store.gimbalControl.command < 0 ? 'Fährt abwärts' : 'Neutral') : actualGimbal.value == null ? 'Keine Rückmeldung' : 'Bereit');
        const zoomStatus = computed(() => camera.zoomPending ? 'Warte auf Kamera …' : actualZoom.value == null ? 'Keine Rückmeldung' : Math.abs(actualZoom.value - targetZoom.value) <= 0.02 ? 'Erreicht' : 'Abweichung');
        function setPresetAngle(value) {
            PrecisionStartService.notifyManualControl('manuelle Gimbal-Voreinstellung');
            store.gimbalControl.targetAngle = value;
            const sent = DroneControlService.setGimbalPitchPreset(value);
            pendingGimbalAngle.value = sent ? null : value;
        }
        let lastZoomSend = 0;
        let queuedZoomTimer = null;
        function setZoom(value, immediate = false) {
            if (!Number.isFinite(value))
                return;
            const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM.value, Math.round(value * 100) / 100));
            camera.zoomTarget = clamped;
            const now = Date.now();
            const due = immediate || now - lastZoomSend >= 33;
            if (due) {
                if (queuedZoomTimer) {
                    clearTimeout(queuedZoomTimer);
                    queuedZoomTimer = null;
                }
                lastZoomSend = now;
                CameraMediaService.setZoom(clamped);
            }
            else if (!queuedZoomTimer) {
                queuedZoomTimer = setTimeout(() => {
                    queuedZoomTimer = null;
                    lastZoomSend = Date.now();
                    CameraMediaService.setZoom(camera.zoomTarget);
                }, Math.max(1, 33 - (now - lastZoomSend)));
            }
        }
        function onZoomNumberChange(e) { PrecisionStartService.notifyManualControl('manuelle Zoom-Aenderung'); setZoom(Number(e.target.value), true); }
        function onPointerDown(e) {
            PrecisionStartService.notifyManualControl('manuelle Gimbal-Steuerung');
            dragging = true;
            pendingGimbalAngle.value = null;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateFromPointer(e);
        }
        function onPointerMove(e) { if (dragging)
            updateFromPointer(e); }
        function onPointerUp(e) {
            if (!dragging)
                return;
            dragging = false;
            try {
                ;
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            catch (_) { }
            DroneControlService.stopDirectGimbal('stick released');
        }
        function updateFromPointer(e) {
            if (!dialRef.value)
                return;
            const rect = dialRef.value.getBoundingClientRect();
            const centerY = rect.top + rect.height / 2;
            const maxTravel = Math.max(1, rect.height / 2 - 15);
            const dy = Math.max(-maxTravel, Math.min(maxTravel, e.clientY - centerY));
            const command = Math.round((-dy / maxTravel) * 1000);
            DroneControlService.setDirectGimbalCommand(command);
        }
        function onZoomPointerDown(e) {
            PrecisionStartService.notifyManualControl('manuelle Zoom-Steuerung');
            zoomDragging = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateZoomFromPointer(e);
        }
        function onZoomPointerMove(e) { if (zoomDragging)
            updateZoomFromPointer(e); }
        function onZoomPointerUp(e) {
            if (!zoomDragging)
                return;
            zoomDragging = false;
            try {
                ;
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            catch (_) { }
            setZoom(camera.zoomTarget, true);
        }
        function updateZoomFromPointer(e) {
            if (!zoomDialRef.value)
                return;
            const rect = zoomDialRef.value.getBoundingClientRect();
            const usable = Math.max(1, rect.height - 30);
            const y = Math.max(15, Math.min(rect.height - 15, e.clientY - rect.top));
            const ratio = (y - 15) / usable;
            setZoom(MAX_ZOOM.value - ratio * (MAX_ZOOM.value - MIN_ZOOM));
        }
        watch(() => store.telemetry.gimbalSettingsValid, valid => {
            if (!valid)
                return;
            if (pendingGimbalAngle.value != null) {
                const angle = pendingGimbalAngle.value;
                if (DroneControlService.setGimbalPitchPreset(angle))
                    pendingGimbalAngle.value = null;
                return;
            }
            if (store.gimbalControl.mode === 'direct')
                return;
            const ctrl = store.telemetry.gimbalPitchControl;
            if (ctrl === 1)
                store.gimbalControl.targetAngle = 0;
            else if (ctrl === 3)
                store.gimbalControl.targetAngle = -45;
            else if (ctrl === 2)
                store.gimbalControl.targetAngle = -90;
        });
        onMounted(() => {
            DroneControlService.requestGimbalSettings();
            CameraMediaService.getZoom();
        });
        const __returned__ = { MIN_ZOOM, camera, store, MAX_ZOOM, pendingGimbalAngle, targetZoom, actualGimbal, actualZoom, dialRef, zoomDialRef, get dragging() { return dragging; }, set dragging(v) { dragging = v; }, get zoomDragging() { return zoomDragging; }, set zoomDragging(v) { zoomDragging = v; }, gimbalKnobStyle, zoomKnobStyle, actualGimbalText, gimbalCommandText, actualZoomText, gimbalStatus, zoomStatus, setPresetAngle, get lastZoomSend() { return lastZoomSend; }, set lastZoomSend(v) { lastZoomSend = v; }, get queuedZoomTimer() { return queuedZoomTimer; }, set queuedZoomTimer(v) { queuedZoomTimer = v; }, setZoom, onZoomNumberChange, onPointerDown, onPointerMove, onPointerUp, updateFromPointer, onZoomPointerDown, onZoomPointerMove, onZoomPointerUp, updateZoomFromPointer };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, normalizeStyle as _normalizeStyle, toDisplayString as _toDisplayString, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = {
    class: "camera-card",
    "aria-label": "Camera control preview"
};
const _hoisted_2 = { class: "camera-grid" };
const _hoisted_3 = { class: "control-column" };
const _hoisted_4 = { class: "control-body" };
const _hoisted_5 = { class: "presets" };
const _hoisted_6 = { class: "value-grid" };
const _hoisted_7 = { class: "feedback-state" };
const _hoisted_8 = { class: "control-column" };
const _hoisted_9 = { class: "control-body" };
const _hoisted_10 = { class: "limit-mark top" };
const _hoisted_11 = { class: "limit-mark bottom" };
const _hoisted_12 = { class: "presets" };
const _hoisted_13 = { class: "value-grid" };
const _hoisted_14 = ["max", "value"];
const _hoisted_15 = { class: "feedback-state" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _cache[21] || (_cache[21] = _createElementVNode("div", { class: "camera-header" }, [
            _createElementVNode("span", { class: "panel-title" }, "📷 Camera Control")
        ], -1 /* CACHED */)),
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
                _cache[14] || (_cache[14] = _createElementVNode("div", { class: "sub-title" }, "Gimbal", -1 /* CACHED */)),
                _createElementVNode("div", _hoisted_4, [
                    _createElementVNode("div", {
                        ref: "dialRef",
                        class: "vertical-dial",
                        onPointerdown: $setup.onPointerDown,
                        onPointermove: $setup.onPointerMove,
                        onPointerup: $setup.onPointerUp,
                        onPointercancel: $setup.onPointerUp
                    }, [
                        _cache[7] || (_cache[7] = _createElementVNode("div", { class: "axis-line" }, null, -1 /* CACHED */)),
                        _cache[8] || (_cache[8] = _createElementVNode("div", { class: "limit-mark top" }, "+100%", -1 /* CACHED */)),
                        _cache[9] || (_cache[9] = _createElementVNode("div", { class: "center-mark" }, "0", -1 /* CACHED */)),
                        _cache[10] || (_cache[10] = _createElementVNode("div", { class: "limit-mark bottom" }, "-100%", -1 /* CACHED */)),
                        _createElementVNode("div", {
                            class: "control-knob",
                            style: _normalizeStyle($setup.gimbalKnobStyle)
                        }, [...(_cache[6] || (_cache[6] = [
                                _createElementVNode("span", { class: "knob-dot" }, null, -1 /* CACHED */)
                            ]))], 4 /* STYLE */)
                    ], 544 /* NEED_HYDRATION, NEED_PATCH */),
                    _createElementVNode("div", _hoisted_5, [
                        _cache[11] || (_cache[11] = _createElementVNode("span", { class: "preset-label" }, "Preset", -1 /* CACHED */)),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[0] || (_cache[0] = $event => ($setup.setPresetAngle(0)))
                        }, "0°"),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[1] || (_cache[1] = $event => ($setup.setPresetAngle(-45)))
                        }, "-45°"),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[2] || (_cache[2] = $event => ($setup.setPresetAngle(-90)))
                        }, "-90°")
                    ])
                ]),
                _createElementVNode("div", _hoisted_6, [
                    _createElementVNode("div", null, [
                        _cache[12] || (_cache[12] = _createElementVNode("span", { class: "value-label" }, "Tempo", -1 /* CACHED */)),
                        _createElementVNode("strong", null, _toDisplayString($setup.gimbalCommandText), 1 /* TEXT */)
                    ]),
                    _createElementVNode("div", null, [
                        _cache[13] || (_cache[13] = _createElementVNode("span", { class: "value-label" }, "Ist", -1 /* CACHED */)),
                        _createElementVNode("strong", null, _toDisplayString($setup.actualGimbalText), 1 /* TEXT */)
                    ])
                ]),
                _createElementVNode("div", _hoisted_7, _toDisplayString($setup.gimbalStatus), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_8, [
                _cache[20] || (_cache[20] = _createElementVNode("div", { class: "sub-title" }, "Zoom", -1 /* CACHED */)),
                _createElementVNode("div", _hoisted_9, [
                    _createElementVNode("div", {
                        ref: "zoomDialRef",
                        class: "vertical-dial",
                        onPointerdown: $setup.onZoomPointerDown,
                        onPointermove: $setup.onZoomPointerMove,
                        onPointerup: $setup.onZoomPointerUp,
                        onPointercancel: $setup.onZoomPointerUp
                    }, [
                        _cache[16] || (_cache[16] = _createElementVNode("div", { class: "axis-line" }, null, -1 /* CACHED */)),
                        _createElementVNode("div", _hoisted_10, _toDisplayString($setup.MAX_ZOOM.toFixed(2)) + "x", 1 /* TEXT */),
                        _createElementVNode("div", _hoisted_11, _toDisplayString($setup.MIN_ZOOM.toFixed(2)) + "x", 1 /* TEXT */),
                        _createElementVNode("div", {
                            class: "control-knob",
                            style: _normalizeStyle($setup.zoomKnobStyle)
                        }, [...(_cache[15] || (_cache[15] = [
                                _createElementVNode("span", { class: "knob-dot" }, null, -1 /* CACHED */)
                            ]))], 4 /* STYLE */)
                    ], 544 /* NEED_HYDRATION, NEED_PATCH */),
                    _createElementVNode("div", _hoisted_12, [
                        _cache[17] || (_cache[17] = _createElementVNode("span", { class: "preset-label" }, "Preset", -1 /* CACHED */)),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[3] || (_cache[3] = $event => ($setup.setZoom(1)))
                        }, "1.0x"),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[4] || (_cache[4] = $event => ($setup.setZoom(1.5)))
                        }, "1.5x"),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--compact",
                            type: "button",
                            onClick: _cache[5] || (_cache[5] = $event => ($setup.setZoom(2)))
                        }, "2.0x")
                    ])
                ]),
                _createElementVNode("div", _hoisted_13, [
                    _createElementVNode("div", null, [
                        _cache[18] || (_cache[18] = _createElementVNode("span", { class: "value-label" }, "Soll", -1 /* CACHED */)),
                        _createElementVNode("input", {
                            class: "zoom-number",
                            type: "number",
                            min: $setup.MIN_ZOOM,
                            max: $setup.MAX_ZOOM,
                            step: "0.01",
                            value: $setup.targetZoom.toFixed(2),
                            onChange: $setup.onZoomNumberChange
                        }, null, 40 /* PROPS, NEED_HYDRATION */, _hoisted_14)
                    ]),
                    _createElementVNode("div", null, [
                        _cache[19] || (_cache[19] = _createElementVNode("span", { class: "value-label" }, "Ist", -1 /* CACHED */)),
                        _createElementVNode("strong", null, _toDisplayString($setup.actualZoomText), 1 /* TEXT */)
                    ])
                ]),
                _createElementVNode("div", _hoisted_15, _toDisplayString($setup.zoomStatus), 1 /* TEXT */)
            ])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-4d265f63";
__sfc__.render = render;
export default __sfc__;
