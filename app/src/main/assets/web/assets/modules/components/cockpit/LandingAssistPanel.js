import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, onBeforeUnmount, ref, watch } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { AndroidMediaService } from '../../services/AndroidMediaService.js';
import { useLandingAssistSettings } from '../../composables/useLandingAssistSettings.js';
import SelfCenteringAxisControl from './SelfCenteringAxisControl.js';
const NORMAL_JOYSTICK_LIMIT = 1000;
const MIN_FINE_PERCENT = 10;
const MAX_FINE_PERCENT = 25;
const SINGLE_STEP_VALUE = 10;
const SINGLE_STEP_DURATION_MS = 160;
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'LandingAssistPanel',
    emits: ["control-start", "control-end", "change"],
    setup(__props, { expose: __expose, emit: __emit }) {
        __expose();
        const emit = __emit;
        const store = useDroneStore();
        const telemetry = store.telemetry;
        const { crosshairVisible, panelOpen, returnHeight, fineControlPercent } = useLandingAssistSettings();
        const snapshotBusy = ref(false);
        const status = ref('');
        const activeAxes = new Set();
        const stepTimers = new Map();
        const axes = [
            { key: 'throttle', label: 'Throttle' },
            { key: 'yaw', label: 'Yaw' },
            { key: 'pitch', label: 'Pitch' },
            { key: 'roll', label: 'Roll' },
        ];
        const sanitizedRthHeight = computed(() => Math.max(20, Math.min(120, Math.round(Number(returnHeight.value) || 120))));
        const sanitizedFineControlPercent = computed(() => Math.max(MIN_FINE_PERCENT, Math.min(MAX_FINE_PERCENT, Math.round(Number(fineControlPercent.value) || 15))));
        const assistLimit = computed(() => Math.round(NORMAL_JOYSTICK_LIMIT * sanitizedFineControlPercent.value / 100));
        function normalizeFineControlPercent() {
            fineControlPercent.value = sanitizedFineControlPercent.value;
        }
        watch(assistLimit, limit => {
            for (const axis of axes) {
                const current = Number(store.userJoysticks[axis.key]) || 0;
                if (Math.abs(current) > limit) {
                    store.userJoysticks[axis.key] = Math.max(-limit, Math.min(limit, current));
                    emit('change');
                }
            }
        });
        function beginControl(axis) {
            const pendingStep = stepTimers.get(axis);
            if (pendingStep != null) {
                window.clearTimeout(pendingStep);
                stepTimers.delete(axis);
            }
            if (activeAxes.has(axis))
                return;
            const wasIdle = activeAxes.size === 0;
            activeAxes.add(axis);
            if (wasIdle)
                emit('control-start');
        }
        function setAxisValue(axis, rawValue) {
            const value = Math.max(-assistLimit.value, Math.min(assistLimit.value, Number(rawValue) || 0));
            store.userJoysticks[axis] = Math.round(value);
            emit('change');
        }
        function endControl(axis) {
            const wasActive = activeAxes.delete(axis);
            if (store.userJoysticks[axis] !== 0) {
                store.userJoysticks[axis] = 0;
                emit('change');
            }
            if (wasActive && activeAxes.size === 0)
                emit('control-end');
        }
        function pulseStep(axis, direction) {
            const previousTimer = stepTimers.get(axis);
            if (previousTimer != null)
                window.clearTimeout(previousTimer);
            const wasIdle = activeAxes.size === 0;
            activeAxes.add(axis);
            if (wasIdle)
                emit('control-start');
            const pulse = Math.min(assistLimit.value, SINGLE_STEP_VALUE) * direction;
            store.userJoysticks[axis] = pulse;
            emit('change');
            const timer = window.setTimeout(() => {
                stepTimers.delete(axis);
                endControl(axis);
            }, SINGLE_STEP_DURATION_MS);
            stepTimers.set(axis, timer);
        }
        onBeforeUnmount(() => {
            for (const timer of stepTimers.values())
                window.clearTimeout(timer);
            stepTimers.clear();
            for (const axis of axes)
                store.userJoysticks[axis.key] = 0;
            if (activeAxes.size) {
                activeAxes.clear();
                emit('change');
                emit('control-end');
            }
        });
        async function takeSnapshot() {
            if (snapshotBusy.value)
                return;
            snapshotBusy.value = true;
            status.value = 'Live-Foto wird gespeichert…';
            try {
                const saved = await AndroidMediaService.saveCockpitSnapshot();
                status.value = `Gespeichert: ${saved.relativePath}/${saved.name}`;
                store.addLog('INFO', `[Landing assist] cockpit snapshot saved: ${saved.relativePath}/${saved.name}`);
            }
            catch (error) {
                status.value = `Live-Foto fehlgeschlagen: ${error?.message || error}`;
                store.addLog('WARN', `[Landing assist] cockpit snapshot failed: ${error?.message || error}`);
            }
            finally {
                snapshotBusy.value = false;
            }
        }
        async function handleRth() {
            if (telemetry.returning) {
                DroneControlService.cancelRth();
                return;
            }
            if (!telemetry.settingsValid) {
                status.value = 'RTH nicht gestartet: Flug-Einstellungen (0x0003) sind noch nicht gültig.';
                return;
            }
            const target = sanitizedRthHeight.value;
            returnHeight.value = target;
            if (!window.confirm(`RTH mit ${target} m Rückkehrhöhe starten?`))
                return;
            status.value = `Setze RTH-Höhe auf ${target} m…`;
            DroneControlService.applyFlightSettings({
                limitHeight: telemetry.limitHeight || 0,
                limitDistance: telemetry.limitDistance || 0,
                returnHeight: target,
                beginnerMode: !!telemetry.beginnerMode,
                americaRockerMode: telemetry.americaRockerMode !== false,
                surroundRadius: telemetry.surroundRadius || 0,
                clockwise: telemetry.surroundClockwise !== false,
                surroundSpeed: telemetry.surroundSpeed || 0,
                speedMode: telemetry.settingSpeedMode == null || telemetry.settingSpeedMode < 0 ? 1 : telemetry.settingSpeedMode,
            });
            // Give the flight controller time to publish the synchronized 0x0003 settings.
            const deadline = Date.now() + 1800;
            while (Date.now() < deadline) {
                if (telemetry.settingsValid && telemetry.returnHeight === target)
                    break;
                await new Promise(resolve => window.setTimeout(resolve, 100));
            }
            if (telemetry.returnHeight !== target) {
                status.value = `RTH nicht gestartet: Rückkehrhöhe ${target} m wurde nicht bestätigt (aktuell ${telemetry.returnHeight || 0} m).`;
                store.addLog('WARN', `[Landing assist] RTH aborted: requested returnHeight=${target}, confirmed=${telemetry.returnHeight || 0}`);
                return;
            }
            status.value = `RTH gestartet, bestätigte Rückkehrhöhe: ${target} m.`;
            DroneControlService.rth();
        }
        const __returned__ = { emit, NORMAL_JOYSTICK_LIMIT, MIN_FINE_PERCENT, MAX_FINE_PERCENT, store, telemetry, crosshairVisible, panelOpen, returnHeight, fineControlPercent, snapshotBusy, status, activeAxes, stepTimers, SINGLE_STEP_VALUE, SINGLE_STEP_DURATION_MS, axes, sanitizedRthHeight, sanitizedFineControlPercent, assistLimit, normalizeFineControlPercent, beginControl, setAxisValue, endControl, pulseStep, takeSnapshot, handleRth, SelfCenteringAxisControl };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, vModelCheckbox as _vModelCheckbox, withDirectives as _withDirectives, vModelText as _vModelText, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, createVNode as _createVNode, createTextVNode as _createTextVNode, normalizeClass as _normalizeClass, createCommentVNode as _createCommentVNode } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "landing-assist ui-card" };
const _hoisted_2 = ["aria-expanded"];
const _hoisted_3 = {
    key: 0,
    class: "landing-assist-body"
};
const _hoisted_4 = { class: "crosshair-toggle" };
const _hoisted_5 = { class: "fineness-box" };
const _hoisted_6 = { class: "fineness-heading" };
const _hoisted_7 = { class: "fineness-value" };
const _hoisted_8 = { class: "fineness-scale" };
const _hoisted_9 = { class: "fine-controls-group" };
const _hoisted_10 = { class: "slider-grid" };
const _hoisted_11 = { class: "axis-label" };
const _hoisted_12 = ["aria-label", "onClick"];
const _hoisted_13 = ["aria-label", "onClick"];
const _hoisted_14 = { class: "axis-value" };
const _hoisted_15 = { class: "assist-actions" };
const _hoisted_16 = ["disabled"];
const _hoisted_17 = { class: "rth-box" };
const _hoisted_18 = { class: "rth-height-label" };
const _hoisted_19 = { class: "rth-input-wrap" };
const _hoisted_20 = ["disabled"];
const _hoisted_21 = {
    key: 0,
    class: "assist-status"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _createElementVNode("button", {
            class: "landing-assist-header",
            type: "button",
            onClick: _cache[0] || (_cache[0] = $event => ($setup.panelOpen = !$setup.panelOpen)),
            "aria-expanded": $setup.panelOpen
        }, [
            _cache[5] || (_cache[5] = _createElementVNode("span", null, "🛬 Landehilfe", -1 /* CACHED */)),
            _createElementVNode("span", null, _toDisplayString($setup.panelOpen ? '▾' : '▸'), 1 /* TEXT */)
        ], 8 /* PROPS */, _hoisted_2),
        ($setup.panelOpen)
            ? (_openBlock(), _createElementBlock("div", _hoisted_3, [
                _createElementVNode("label", _hoisted_4, [
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.crosshairVisible) = $event)),
                        type: "checkbox"
                    }, null, 512 /* NEED_PATCH */), [
                        [_vModelCheckbox, $setup.crosshairVisible]
                    ]),
                    _cache[6] || (_cache[6] = _createElementVNode("span", null, "Zielkreuz im Livebild", -1 /* CACHED */))
                ]),
                _createElementVNode("div", _hoisted_5, [
                    _createElementVNode("div", _hoisted_6, [
                        _cache[9] || (_cache[9] = _createElementVNode("span", null, "Feinheit", -1 /* CACHED */)),
                        _createElementVNode("label", _hoisted_7, [
                            _cache[7] || (_cache[7] = _createElementVNode("span", null, "Feinheit:", -1 /* CACHED */)),
                            _withDirectives(_createElementVNode("input", {
                                "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.fineControlPercent) = $event)),
                                type: "number",
                                min: $setup.MIN_FINE_PERCENT,
                                max: $setup.MAX_FINE_PERCENT,
                                step: "1",
                                onChange: $setup.normalizeFineControlPercent
                            }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                                [
                                    _vModelText,
                                    $setup.fineControlPercent,
                                    void 0,
                                    { number: true }
                                ]
                            ]),
                            _cache[8] || (_cache[8] = _createElementVNode("span", null, "%", -1 /* CACHED */))
                        ])
                    ]),
                    _withDirectives(_createElementVNode("input", {
                        "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.fineControlPercent) = $event)),
                        class: "fineness-slider",
                        type: "range",
                        min: $setup.MIN_FINE_PERCENT,
                        max: $setup.MAX_FINE_PERCENT,
                        step: "1",
                        onInput: $setup.normalizeFineControlPercent
                    }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                        [
                            _vModelText,
                            $setup.fineControlPercent,
                            void 0,
                            { number: true }
                        ]
                    ]),
                    _createElementVNode("div", _hoisted_8, [
                        _createElementVNode("span", null, _toDisplayString($setup.MIN_FINE_PERCENT) + " %"),
                        _createElementVNode("span", null, "Steuerbereich ±" + _toDisplayString($setup.assistLimit), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString($setup.MAX_FINE_PERCENT) + " %")
                    ])
                ]),
                _createElementVNode("div", _hoisted_9, [
                    _cache[10] || (_cache[10] = _createElementVNode("div", { class: "fine-controls-title" }, "Feinsteuerung", -1 /* CACHED */)),
                    _cache[11] || (_cache[11] = _createElementVNode("div", { class: "assist-note" }, "Throttle, Yaw, Pitch und Roll kehren beim Loslassen sofort in die Neutralstellung zurück.", -1 /* CACHED */)),
                    _createElementVNode("div", _hoisted_10, [
                        (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.axes, (axis) => {
                            return _createElementVNode("div", {
                                key: axis.key,
                                class: "axis-row"
                            }, [
                                _createElementVNode("span", _hoisted_11, _toDisplayString(axis.label), 1 /* TEXT */),
                                _createElementVNode("button", {
                                    class: "step-button",
                                    type: "button",
                                    "aria-label": `${axis.label} Einzelschritt negativ`,
                                    onClick: $event => ($setup.pulseStep(axis.key, -1))
                                }, "−", 8 /* PROPS */, _hoisted_12),
                                _createVNode($setup["SelfCenteringAxisControl"], {
                                    "model-value": $setup.store.userJoysticks[axis.key],
                                    limit: $setup.assistLimit,
                                    label: `${axis.label} Feinsteuerung`,
                                    onControlStart: $event => ($setup.beginControl(axis.key)),
                                    "onUpdate:modelValue": $event => ($setup.setAxisValue(axis.key, $event)),
                                    onControlEnd: $event => ($setup.endControl(axis.key))
                                }, null, 8 /* PROPS */, ["model-value", "limit", "label", "onControlStart", "onUpdate:modelValue", "onControlEnd"]),
                                _createElementVNode("button", {
                                    class: "step-button",
                                    type: "button",
                                    "aria-label": `${axis.label} Einzelschritt positiv`,
                                    onClick: $event => ($setup.pulseStep(axis.key, 1))
                                }, "+", 8 /* PROPS */, _hoisted_13),
                                _createElementVNode("span", _hoisted_14, _toDisplayString($setup.store.userJoysticks[axis.key]), 1 /* TEXT */)
                            ]);
                        }), 64 /* STABLE_FRAGMENT */))
                    ])
                ]),
                _createElementVNode("div", _hoisted_15, [
                    _createElementVNode("button", {
                        class: "taf-btn",
                        type: "button",
                        disabled: $setup.snapshotBusy,
                        onClick: $setup.takeSnapshot
                    }, _toDisplayString($setup.snapshotBusy ? '⏳ Speichern…' : '📸 Live-Foto'), 9 /* TEXT, PROPS */, _hoisted_16),
                    _createElementVNode("div", _hoisted_17, [
                        _createElementVNode("label", _hoisted_18, [
                            _cache[13] || (_cache[13] = _createElementVNode("span", null, "RTH-Höhe", -1 /* CACHED */)),
                            _createElementVNode("span", _hoisted_19, [
                                _withDirectives(_createElementVNode("input", {
                                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.returnHeight) = $event)),
                                    class: "rth-height-input",
                                    type: "number",
                                    min: "20",
                                    max: "120",
                                    step: "1"
                                }, null, 512 /* NEED_PATCH */), [
                                    [
                                        _vModelText,
                                        $setup.returnHeight,
                                        void 0,
                                        { number: true }
                                    ]
                                ]),
                                _cache[12] || (_cache[12] = _createTextVNode(" m", -1 /* CACHED */))
                            ])
                        ]),
                        _createElementVNode("button", {
                            class: _normalizeClass(["taf-btn", { 'taf-btn--danger': $setup.telemetry.returning }]),
                            type: "button",
                            disabled: !$setup.telemetry.settingsValid && !$setup.telemetry.returning,
                            onClick: $setup.handleRth
                        }, " 🏠 " + _toDisplayString($setup.telemetry.returning ? 'RTH abbrechen' : `RTH (${$setup.sanitizedRthHeight} m)`), 11 /* TEXT, CLASS, PROPS */, _hoisted_20)
                    ])
                ]),
                ($setup.status)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_21, _toDisplayString($setup.status), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true)
            ]))
            : _createCommentVNode("v-if", true)
    ]));
}
__sfc__.__scopeId = "data-v-3457ff32";
__sfc__.render = render;
export default __sfc__;
