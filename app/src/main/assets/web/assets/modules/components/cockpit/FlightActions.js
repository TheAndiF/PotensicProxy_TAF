import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref } from '../../../vendor/vue.js';
import { DroneControlService } from '../../services/DroneControlService.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useCameraStore } from '../../stores/useCameraStore.js';
import { usePrecisionStartStore } from '../../stores/usePrecisionStartStore.js';
import { PrecisionStartService } from '../../services/PrecisionStartService.js';
import { useI18n } from '../../i18n/index.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'FlightActions',
    setup(__props, { expose: __expose }) {
        __expose();
        const { t } = useI18n();
        const store = useDroneStore();
        const camera = useCameraStore();
        const pstart = usePrecisionStartStore();
        const { telemetry } = store;
        const emergencyConfirmOpen = ref(false);
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
        const __returned__ = { t, store, camera, pstart, telemetry, emergencyConfirmOpen, confirmTakeoff, togglePStart, landOrCancel, rthOrCancel, openEmergencyConfirm, cancelEmergency, confirmEmergency, get DroneControlService() { return DroneControlService; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, withModifiers as _withModifiers, withKeys as _withKeys } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "actions-container" };
const _hoisted_2 = { class: "panel-title" };
const _hoisted_3 = { class: "btn-grid" };
const _hoisted_4 = ["disabled"];
const _hoisted_5 = ["disabled"];
const _hoisted_6 = ["disabled"];
const _hoisted_7 = {
    class: "taf-btn",
    disabled: "",
    title: "Precision Landing ist in dieser Version noch nicht implementiert"
};
const _hoisted_8 = ["disabled"];
const _hoisted_9 = {
    class: "panel-title",
    style: { "margin-top": "10px" }
};
const _hoisted_10 = { class: "btn-grid" };
const _hoisted_11 = ["disabled", "title"];
const _hoisted_12 = ["disabled", "title"];
const _hoisted_13 = ["aria-label", "onKeydown"];
const _hoisted_14 = { class: "confirm-actions" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, "✈️ " + _toDisplayString($setup.t('actions.flight')), 1 /* TEXT */),
        _createElementVNode("div", _hoisted_3, [
            _createElementVNode("button", {
                class: "taf-btn taf-btn--success",
                disabled: $setup.telemetry.flying || $setup.telemetry.takingOff || $setup.pstart.state.active,
                onClick: $setup.confirmTakeoff
            }, "🛫 " + _toDisplayString($setup.t('actions.takeoff')), 9 /* TEXT, PROPS */, _hoisted_4),
            _createElementVNode("button", {
                class: _normalizeClass(["taf-btn", { 'taf-btn--danger': $setup.telemetry.landing }]),
                disabled: $setup.pstart.state.active || (!$setup.telemetry.flying && !$setup.telemetry.landing),
                onClick: $setup.landOrCancel
            }, "🛬 " + _toDisplayString($setup.telemetry.landing ? $setup.t('actions.cancelLand') : $setup.t('actions.land')), 11 /* TEXT, CLASS, PROPS */, _hoisted_5),
            _createElementVNode("button", {
                class: _normalizeClass(["taf-btn pstart-button", { 'pstart-button--active': $setup.pstart.blinking }]),
                disabled: !$setup.pstart.state.active && ($setup.telemetry.flying || $setup.telemetry.takingOff),
                onClick: $setup.togglePStart
            }, "🎯 " + _toDisplayString($setup.t('actions.pstart')), 11 /* TEXT, CLASS, PROPS */, _hoisted_6),
            _createElementVNode("button", _hoisted_7, "🎯 " + _toDisplayString($setup.t('actions.planding')), 1 /* TEXT */),
            _createElementVNode("button", {
                class: _normalizeClass(["taf-btn", { 'taf-btn--danger': $setup.telemetry.returning }]),
                disabled: $setup.pstart.state.active || (!$setup.telemetry.flying && !$setup.telemetry.returning),
                onClick: $setup.rthOrCancel
            }, "🏠 " + _toDisplayString($setup.telemetry.returning ? $setup.t('actions.cancelRth') : $setup.t('actions.rth')), 11 /* TEXT, CLASS, PROPS */, _hoisted_8),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--danger",
                onClick: $setup.openEmergencyConfirm
            }, "⛔ " + _toDisplayString($setup.t('actions.emergency')), 1 /* TEXT */)
        ]),
        ($setup.pstart.state.status)
            ? (_openBlock(), _createElementBlock("div", {
                key: 0,
                class: _normalizeClass(["pstart-status", { 'pstart-status--error': $setup.pstart.state.phase === 'ABORTED' }])
            }, [
                _cache[4] || (_cache[4] = _createElementVNode("strong", null, "PStart:", -1 /* CACHED */)),
                _createTextVNode(" " + _toDisplayString($setup.pstart.state.status), 1 /* TEXT */)
            ], 2 /* CLASS */))
            : _createCommentVNode("v-if", true),
        _createElementVNode("div", _hoisted_9, "📷 " + _toDisplayString($setup.t('actions.camera')), 1 /* TEXT */),
        _createElementVNode("div", _hoisted_10, [
            _createElementVNode("button", {
                class: "taf-btn",
                disabled: !$setup.camera.initialization.ready || $setup.camera.capturePending,
                title: $setup.camera.initialization.ready ? '' : $setup.camera.initialization.lastInitMessage,
                onClick: _cache[0] || (_cache[0] = $event => ($setup.DroneControlService.takePhoto()))
            }, "📸 " + _toDisplayString($setup.camera.captureMode === 'PHOTO' ? $setup.t('actions.photoShoot') : $setup.t('actions.photoMode')), 9 /* TEXT, PROPS */, _hoisted_11),
            _createElementVNode("button", {
                class: _normalizeClass(["taf-btn", { 'taf-btn--danger': $setup.camera.recording }]),
                disabled: !$setup.camera.initialization.ready || $setup.camera.recordingPending || $setup.camera.capturePending,
                title: $setup.camera.initialization.ready ? '' : $setup.camera.initialization.lastInitMessage,
                onClick: _cache[1] || (_cache[1] = $event => ($setup.DroneControlService.toggleRecord()))
            }, "🎥 " + _toDisplayString($setup.camera.recording ? $setup.t('actions.recordStop') : $setup.t('actions.recordStart')), 11 /* TEXT, CLASS, PROPS */, _hoisted_12),
            _createElementVNode("button", {
                class: "taf-btn taf-btn--primary",
                onClick: _cache[2] || (_cache[2] = $event => ($setup.DroneControlService.requestIdr()))
            }, "🔄 " + _toDisplayString($setup.t('actions.keyframe')), 1 /* TEXT */),
            _createElementVNode("button", {
                class: "taf-btn",
                onClick: _cache[3] || (_cache[3] = $event => ($setup.DroneControlService.initLiveView()))
            }, "📡 " + _toDisplayString($setup.t('actions.liveview')), 1 /* TEXT */)
        ]),
        ($setup.emergencyConfirmOpen)
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "confirm-backdrop",
                role: "presentation",
                onClick: _withModifiers($setup.cancelEmergency, ["self"])
            }, [
                _createElementVNode("div", {
                    class: "confirm-dialog",
                    role: "dialog",
                    "aria-modal": "true",
                    "aria-label": $setup.t('actions.emergencyConfirmTitle'),
                    onKeydown: _withKeys(_withModifiers($setup.cancelEmergency, ["prevent"]), ["esc"]),
                    tabindex: "-1"
                }, [
                    _createElementVNode("h3", null, _toDisplayString($setup.t('actions.emergencyConfirmTitle')), 1 /* TEXT */),
                    _createElementVNode("p", null, _toDisplayString($setup.t('actions.emergencyConfirmText')), 1 /* TEXT */),
                    _createElementVNode("div", _hoisted_14, [
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--primary",
                            type: "button",
                            onClick: $setup.cancelEmergency
                        }, _toDisplayString($setup.t('actions.cancel')), 1 /* TEXT */),
                        _createElementVNode("button", {
                            class: "taf-btn taf-btn--danger",
                            type: "button",
                            onClick: $setup.confirmEmergency
                        }, _toDisplayString($setup.t('actions.emergencyExecute')), 1 /* TEXT */)
                    ])
                ], 40 /* PROPS, NEED_HYDRATION */, _hoisted_13)
            ]))
            : _createCommentVNode("v-if", true)
    ]));
}
__sfc__.__scopeId = "data-v-012259a9";
__sfc__.render = render;
export default __sfc__;
