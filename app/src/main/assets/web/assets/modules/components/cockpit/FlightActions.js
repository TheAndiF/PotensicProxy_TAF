import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { unref as _unref, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, createTextVNode as _createTextVNode, withModifiers as _withModifiers, withKeys as _withKeys } from '../../../vendor/vue.js';
const _hoisted_1 = { class: "actions-container" };
const _hoisted_2 = { class: "panel-title" };
const _hoisted_3 = { class: "btn-grid" };
const _hoisted_4 = ["disabled"];
const _hoisted_5 = ["disabled"];
const _hoisted_6 = ["disabled"];
const _hoisted_7 = ["disabled", "title"];
const _hoisted_8 = ["disabled"];
const _hoisted_9 = {
    key: 0,
    class: "pstart-status"
};
const _hoisted_10 = {
    class: "panel-title",
    style: { "margin-top": "10px" }
};
const _hoisted_11 = { class: "btn-grid" };
const _hoisted_12 = ["disabled", "title"];
const _hoisted_13 = ["disabled", "title"];
const _hoisted_14 = ["aria-label", "onKeydown"];
const _hoisted_15 = { class: "confirm-actions" };
import { ref, computed } from '../../../vendor/vue.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
import { usePrecisionStartStore } from '../../stores/usePrecisionStartStore.js';
import { PrecisionStartService } from '../../services/PrecisionStartService.js';
import { useI18n } from '../../i18n/index.js';
export default /*@__PURE__*/ _defineComponent({
    __name: 'FlightActions',
    setup(__props) {
        const { t } = useI18n();
        const store = useDroneStore();
        const camera = useCameraStore();
        const pstart = usePrecisionStartStore();
        const { telemetry } = store;
        const emergencyConfirmOpen = ref(false);
        const plandCanPreview = computed(() => pstart.state.phase === 'COMPLETE' && !pstart.state.active && !telemetry.landing && !telemetry.returning);
        const plandHint = computed(() => pstart.state.plandPreviewActive ? 'PLand-Modellanzeige ausschalten (kein Landebefehl)' : plandCanPreview.value ? 'PLand-Modellanzeige aktivieren, nur visuell' : 'Erst PStart erfolgreich abschließen; während Landung/RTH nicht verfügbar');
        function togglePLandPreview() {
            if (!pstart.state.plandPreviewActive && !plandCanPreview.value)
                return;
            pstart.state.plandPreviewActive = !pstart.state.plandPreviewActive;
            store.addLog('INFO', `[PLand] display-only preview ${pstart.state.plandPreviewActive ? 'activated' : 'deactivated'}; no flight commands`);
        }
        function confirmTakeoff() {
            if (window.confirm(t('actions.takeoffConfirm')))
                DroneControlService.takeoff();
        }
        function togglePStart() {
            void PrecisionStartService.toggle();
        }
        function landOrCancel() {
            if (telemetry.landing) {
                DroneControlService.cancelLand();
                return;
            }
            if (window.confirm(t('actions.landConfirm')))
                DroneControlService.land();
        }
        function rthOrCancel() {
            if (telemetry.returning) {
                DroneControlService.cancelRth();
                return;
            }
            if (window.confirm(t('actions.rthConfirm')))
                DroneControlService.rth();
        }
        function openEmergencyConfirm() {
            emergencyConfirmOpen.value = true;
        }
        function cancelEmergency() {
            if (!emergencyConfirmOpen.value)
                return;
            emergencyConfirmOpen.value = false;
            store.addLog('INFO', '[Emergency stop] confirmation dialog cancelled');
        }
        function confirmEmergency() {
            if (!emergencyConfirmOpen.value)
                return;
            emergencyConfirmOpen.value = false;
            if (pstart.state.active)
                PrecisionStartService.abort('Not-Aus durch Benutzer bestätigt', 'manual');
            store.addLog('WARN', '[Emergency stop] explicitly confirmed; executing existing emergency-stop path');
            DroneControlService.emergencyStop();
        }
        return (_ctx, _cache) => {
            return (_openBlock(), _createElementBlock("div", _hoisted_1, [
                _createElementVNode("div", _hoisted_2, "✈️ " + _toDisplayString(_unref(t)('actions.flight')), 1 /* TEXT */),
                _createElementVNode("div", _hoisted_3, [
                    _createElementVNode("button", {
                        class: "taf-btn taf-btn--success",
                        disabled: _unref(telemetry).flying || _unref(telemetry).takingOff || _unref(pstart).state.active,
                        onClick: confirmTakeoff
                    }, "🛫 " + _toDisplayString(_unref(t)('actions.takeoff')), 9 /* TEXT, PROPS */, _hoisted_4),
                    _createElementVNode("button", {
                        class: _normalizeClass(["taf-btn", { 'taf-btn--danger': _unref(telemetry).landing }]),
                        disabled: _unref(pstart).state.active || (!_unref(telemetry).flying && !_unref(telemetry).landing),
                        onClick: landOrCancel
                    }, "🛬 " + _toDisplayString(_unref(telemetry).landing ? _unref(t)('actions.cancelLand') : _unref(t)('actions.land')), 11 /* TEXT, CLASS, PROPS */, _hoisted_5),
                    _createElementVNode("button", {
                        class: _normalizeClass(["taf-btn pstart-button", { 'pstart-button--active': _unref(pstart).blinking }]),
                        disabled: !_unref(pstart).state.active && (_unref(telemetry).flying || _unref(telemetry).takingOff),
                        onClick: togglePStart
                    }, "🎯 " + _toDisplayString(_unref(t)('actions.pstart')), 11 /* TEXT, CLASS, PROPS */, _hoisted_6),
                    _createElementVNode("button", {
                        class: _normalizeClass(["taf-btn", { 'taf-btn--primary': _unref(pstart).state.plandPreviewActive }]),
                        disabled: !plandCanPreview.value && !_unref(pstart).state.plandPreviewActive,
                        title: plandHint.value,
                        onClick: togglePLandPreview
                    }, "🎯 " + _toDisplayString(_unref(pstart).state.plandPreviewActive ? 'PLand-Anzeige AUS' : 'PLand-Anzeige'), 11 /* TEXT, CLASS, PROPS */, _hoisted_7),
                    _createElementVNode("button", {
                        class: _normalizeClass(["taf-btn", { 'taf-btn--danger': _unref(telemetry).returning }]),
                        disabled: _unref(pstart).state.active || (!_unref(telemetry).flying && !_unref(telemetry).returning),
                        onClick: rthOrCancel
                    }, "🏠 " + _toDisplayString(_unref(telemetry).returning ? _unref(t)('actions.cancelRth') : _unref(t)('actions.rth')), 11 /* TEXT, CLASS, PROPS */, _hoisted_8),
                    _createElementVNode("button", {
                        class: "taf-btn taf-btn--danger",
                        onClick: openEmergencyConfirm
                    }, "⛔ " + _toDisplayString(_unref(t)('actions.emergency')), 1 /* TEXT */)
                ]),
                (_unref(pstart).state.phase === 'COMPLETE')
                    ? (_openBlock(), _createElementBlock("div", _hoisted_9, "PLand-Anzeige nach PStart verfügbar – nur Vorschau, keine automatische Landung."))
                    : _createCommentVNode("v-if", true),
                (_unref(pstart).state.status)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: _normalizeClass(["pstart-status", { 'pstart-status--error': _unref(pstart).state.phase === 'ABORTED' }])
                    }, [
                        _cache[4] || (_cache[4] = _createElementVNode("strong", null, "PStart:", -1 /* CACHED */)),
                        _createTextVNode(" " + _toDisplayString(_unref(pstart).state.status), 1 /* TEXT */)
                    ], 2 /* CLASS */))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("div", _hoisted_10, "📷 " + _toDisplayString(_unref(t)('actions.camera')), 1 /* TEXT */),
                _createElementVNode("div", _hoisted_11, [
                    _createElementVNode("button", {
                        class: "taf-btn",
                        disabled: !_unref(camera).initialization.ready || _unref(camera).capturePending,
                        title: _unref(camera).initialization.ready ? '' : _unref(camera).initialization.lastInitMessage,
                        onClick: _cache[0] || (_cache[0] = ($event) => (_unref(DroneControlService).takePhoto()))
                    }, "📸 " + _toDisplayString(_unref(camera).captureMode === 'PHOTO' ? _unref(t)('actions.photoShoot') : _unref(t)('actions.photoMode')), 9 /* TEXT, PROPS */, _hoisted_12),
                    _createElementVNode("button", {
                        class: _normalizeClass(["taf-btn", { 'taf-btn--danger': _unref(camera).recording }]),
                        disabled: !_unref(camera).initialization.ready || _unref(camera).recordingPending || _unref(camera).capturePending,
                        title: _unref(camera).initialization.ready ? '' : _unref(camera).initialization.lastInitMessage,
                        onClick: _cache[1] || (_cache[1] = ($event) => (_unref(DroneControlService).toggleRecord()))
                    }, "🎥 " + _toDisplayString(_unref(camera).recording ? _unref(t)('actions.recordStop') : _unref(t)('actions.recordStart')), 11 /* TEXT, CLASS, PROPS */, _hoisted_13),
                    _createElementVNode("button", {
                        class: "taf-btn taf-btn--primary",
                        onClick: _cache[2] || (_cache[2] = ($event) => (_unref(DroneControlService).requestIdr()))
                    }, "🔄 " + _toDisplayString(_unref(t)('actions.keyframe')), 1 /* TEXT */),
                    _createElementVNode("button", {
                        class: "taf-btn",
                        onClick: _cache[3] || (_cache[3] = ($event) => (_unref(DroneControlService).initLiveView()))
                    }, "📡 " + _toDisplayString(_unref(t)('actions.liveview')), 1 /* TEXT */)
                ]),
                (emergencyConfirmOpen.value)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 2,
                        class: "confirm-backdrop",
                        role: "presentation",
                        onClick: _withModifiers(cancelEmergency, ["self"])
                    }, [
                        _createElementVNode("div", {
                            class: "confirm-dialog",
                            role: "dialog",
                            "aria-modal": "true",
                            "aria-label": _unref(t)('actions.emergencyConfirmTitle'),
                            onKeydown: _withKeys(_withModifiers(cancelEmergency, ["prevent"]), ["esc"]),
                            tabindex: "-1"
                        }, [
                            _createElementVNode("h3", null, _toDisplayString(_unref(t)('actions.emergencyConfirmTitle')), 1 /* TEXT */),
                            _createElementVNode("p", null, _toDisplayString(_unref(t)('actions.emergencyConfirmText')), 1 /* TEXT */),
                            _createElementVNode("div", _hoisted_15, [
                                _createElementVNode("button", {
                                    class: "taf-btn taf-btn--primary",
                                    type: "button",
                                    onClick: cancelEmergency
                                }, _toDisplayString(_unref(t)('actions.cancel')), 1 /* TEXT */),
                                _createElementVNode("button", {
                                    class: "taf-btn taf-btn--danger",
                                    type: "button",
                                    onClick: confirmEmergency
                                }, _toDisplayString(_unref(t)('actions.emergencyExecute')), 1 /* TEXT */)
                            ])
                        ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_14)
                    ]))
                    : _createCommentVNode("v-if", true)
            ]));
        };
    }
});
