import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useI18n } from '../../i18n/index.js';
import { useTelemetryDisplaySettings } from '../../composables/useTelemetryDisplaySettings.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'TelemetryBar',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const { t } = useI18n();
        const { sanitizedFontSizePx } = useTelemetryDisplaySettings();
        function isBatteryPercent(value) {
            return value != null && Number.isFinite(value) && value >= 0 && value <= 100;
        }
        function percent(value) {
            return isBatteryPercent(value) ? `${Math.round(value)}%` : '--';
        }
        function batteryClass(value) {
            if (!isBatteryPercent(value))
                return 'battery-unknown';
            return value <= 20 ? 'battery-low' : 'battery-ok';
        }
        const heightText = computed(() => {
            const value = store.telemetry.verticalDistance;
            return value != null && Number.isFinite(value) ? `${value.toFixed(1)}m` : '--';
        });
        const controllerBattery = computed(() => {
            const pct = store.telemetry.remoterBatteryPercent;
            if (pct != null && Number.isFinite(pct) && pct > 0 && pct <= 100)
                return `${Math.round(pct)}%`;
            const voltage = store.telemetry.remoterVoltage;
            return voltage && voltage > 0 ? `${voltage.toFixed(1)}V` : '--';
        });
        const controllerBatteryClass = computed(() => {
            const pct = store.telemetry.remoterBatteryPercent;
            if (pct != null && Number.isFinite(pct) && pct > 0 && pct <= 100)
                return batteryClass(pct);
            return 'battery-unknown';
        });
        const __returned__ = { store, t, sanitizedFontSizePx, isBatteryPercent, percent, batteryClass, heightText, controllerBattery, controllerBatteryClass };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "hud-item power" };
const _hoisted_2 = { class: "lbl" };
const _hoisted_3 = { class: "hud-item power" };
const _hoisted_4 = { class: "lbl" };
const _hoisted_5 = { class: "hud-item power" };
const _hoisted_6 = { class: "lbl" };
const _hoisted_7 = { class: "hud-item" };
const _hoisted_8 = { class: "lbl" };
const _hoisted_9 = { class: "val" };
const _hoisted_10 = { class: "hud-item" };
const _hoisted_11 = { class: "lbl" };
const _hoisted_12 = { class: "val" };
const _hoisted_13 = { class: "hud-item" };
const _hoisted_14 = { class: "lbl" };
const _hoisted_15 = { class: "val" };
const _hoisted_16 = { class: "hud-item" };
const _hoisted_17 = { class: "lbl" };
const _hoisted_18 = { class: "val" };
const _hoisted_19 = { class: "hud-item" };
const _hoisted_20 = { class: "lbl" };
const _hoisted_21 = { class: "val" };
const _hoisted_22 = { class: "hud-item" };
const _hoisted_23 = { class: "lbl" };
const _hoisted_24 = { class: "val" };
const _hoisted_25 = { class: "hud-item" };
const _hoisted_26 = { class: "lbl" };
const _hoisted_27 = { class: "val" };
const _hoisted_28 = { class: "hud-item" };
const _hoisted_29 = { class: "lbl" };
const _hoisted_30 = { class: "val" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", {
        class: "hud-bar",
        "aria-label": "Flight status overlay",
        style: _normalizeStyle({ '--telemetry-font-size': `${$setup.sanitizedFontSizePx}px` })
    }, [
        _createElementVNode("div", _hoisted_1, [
            _createElementVNode("span", _hoisted_2, _toDisplayString($setup.t('telemetry.phoneBattery')), 1 /* TEXT */),
            _createElementVNode("span", {
                class: _normalizeClass(["val", $setup.batteryClass($setup.store.telemetry.phoneBatteryPercent)])
            }, _toDisplayString($setup.percent($setup.store.telemetry.phoneBatteryPercent)), 3 /* TEXT, CLASS */)
        ]),
        _createElementVNode("div", _hoisted_3, [
            _createElementVNode("span", _hoisted_4, _toDisplayString($setup.t('telemetry.controllerBattery')), 1 /* TEXT */),
            _createElementVNode("span", {
                class: _normalizeClass(["val", $setup.controllerBatteryClass])
            }, _toDisplayString($setup.controllerBattery), 3 /* TEXT, CLASS */)
        ]),
        _createElementVNode("div", _hoisted_5, [
            _createElementVNode("span", _hoisted_6, _toDisplayString($setup.t('telemetry.droneBattery')), 1 /* TEXT */),
            _createElementVNode("span", {
                class: _normalizeClass(["val", $setup.batteryClass($setup.store.telemetry.battery)])
            }, _toDisplayString($setup.percent($setup.store.telemetry.battery)), 3 /* TEXT, CLASS */)
        ]),
        _createElementVNode("div", _hoisted_7, [
            _createElementVNode("span", _hoisted_8, _toDisplayString($setup.t('telemetry.altitude')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_9, _toDisplayString($setup.heightText), 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_10, [
            _createElementVNode("span", _hoisted_11, _toDisplayString($setup.t('telemetry.horizontalSpeed')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_12, _toDisplayString($setup.store.telemetry.horizontalSpeed?.toFixed(1) || 0) + "m/s", 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_13, [
            _createElementVNode("span", _hoisted_14, _toDisplayString($setup.t('telemetry.verticalSpeed')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_15, _toDisplayString($setup.store.telemetry.verticalSpeed?.toFixed(1) || 0) + "m/s", 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_16, [
            _createElementVNode("span", _hoisted_17, _toDisplayString($setup.t('telemetry.horizontalDistance')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_18, _toDisplayString($setup.store.telemetry.horizontalDistance?.toFixed(1) || 0) + "m", 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_19, [
            _createElementVNode("span", _hoisted_20, _toDisplayString($setup.t('telemetry.satellites')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_21, _toDisplayString($setup.store.telemetry.satellites || 0), 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_22, [
            _createElementVNode("span", _hoisted_23, _toDisplayString($setup.t('telemetry.heading')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_24, _toDisplayString($setup.store.telemetry.heading || 0) + "°", 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_25, [
            _createElementVNode("span", _hoisted_26, _toDisplayString($setup.t('telemetry.pitch')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_27, _toDisplayString($setup.store.telemetry.pitch || 0) + "°", 1 /* TEXT */)
        ]),
        _createElementVNode("div", _hoisted_28, [
            _createElementVNode("span", _hoisted_29, _toDisplayString($setup.t('telemetry.roll')), 1 /* TEXT */),
            _createElementVNode("span", _hoisted_30, _toDisplayString($setup.store.telemetry.roll || 0) + "°", 1 /* TEXT */)
        ])
    ], 4 /* STYLE */));
}
__sfc__.__scopeId = "data-v-64473996";
__sfc__.render = render;
export default __sfc__;
