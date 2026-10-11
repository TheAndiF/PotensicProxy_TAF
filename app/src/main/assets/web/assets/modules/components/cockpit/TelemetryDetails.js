import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'TelemetryDetails',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        function validNumber(value) {
            return value != null && Number.isFinite(value);
        }
        function meters(value) { return validNumber(value) ? `${Number(value).toFixed(1)} m` : '--'; }
        function speed(value) { return validNumber(value) ? `${Number(value).toFixed(1)} m/s` : '--'; }
        function volts(value) { return validNumber(value) && Number(value) > 0 ? `${Number(value).toFixed(2)} V` : '--'; }
        function degrees(value) { return validNumber(value) ? `${Math.round(Number(value))}°` : '--'; }
        function percent(value) { return validNumber(value) && Number(value) >= 0 && Number(value) <= 100 ? `${Math.round(Number(value))}%` : '--'; }
        function batteryClass(value) {
            if (!validNumber(value) || Number(value) < 0 || Number(value) > 100)
                return 'battery-unknown';
            return Number(value) <= 20 ? 'battery-low' : 'battery-ok';
        }
        const tofText = computed(() => {
            const value = store.telemetry.tofHeight;
            return validNumber(value) ? `${Number(value)} (raw)` : '--';
        });
        const __returned__ = { store, validNumber, meters, speed, volts, degrees, percent, batteryClass, tofText };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, normalizeClass as _normalizeClass, createTextVNode as _createTextVNode, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "telemetry-grid" };
const _hoisted_2 = { class: "telemetry-row" };
const _hoisted_3 = { class: "telemetry-row" };
const _hoisted_4 = { class: "telemetry-row" };
const _hoisted_5 = { class: "telemetry-row" };
const _hoisted_6 = { class: "telemetry-row" };
const _hoisted_7 = { class: "telemetry-row" };
const _hoisted_8 = { class: "telemetry-row" };
const _hoisted_9 = { class: "telemetry-row" };
const _hoisted_10 = { class: "telemetry-row" };
const _hoisted_11 = { class: "telemetry-row" };
const _hoisted_12 = { class: "telemetry-row" };
const _hoisted_13 = { class: "telemetry-row" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock(_Fragment, null, [
        _createElementVNode("div", _hoisted_1, [
            _createElementVNode("div", _hoisted_2, [
                _cache[0] || (_cache[0] = _createElementVNode("span", null, "Relative Höhe", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.meters($setup.store.telemetry.verticalDistance)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_3, [
                _cache[1] || (_cache[1] = _createElementVNode("span", null, "Altitude-Feld", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.meters($setup.store.telemetry.altitude)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_4, [
                _cache[2] || (_cache[2] = _createElementVNode("span", null, "TOF / Bodenabstand", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.tofText), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_5, [
                _cache[3] || (_cache[3] = _createElementVNode("span", null, "Horizontale Entfernung", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.meters($setup.store.telemetry.horizontalDistance)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_6, [
                _cache[4] || (_cache[4] = _createElementVNode("span", null, "Horizontale Geschwindigkeit", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.speed($setup.store.telemetry.horizontalSpeed)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_7, [
                _cache[5] || (_cache[5] = _createElementVNode("span", null, "Vertikale Geschwindigkeit", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.speed($setup.store.telemetry.verticalSpeed)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_8, [
                _cache[6] || (_cache[6] = _createElementVNode("span", null, "Satelliten", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.store.telemetry.satellites ?? 0), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_9, [
                _cache[7] || (_cache[7] = _createElementVNode("span", null, "Heading", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.degrees($setup.store.telemetry.heading)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_10, [
                _cache[8] || (_cache[8] = _createElementVNode("span", null, "Pitch / Roll", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.degrees($setup.store.telemetry.pitch)) + " / " + _toDisplayString($setup.degrees($setup.store.telemetry.roll)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_11, [
                _cache[9] || (_cache[9] = _createElementVNode("span", null, "Drohnenakku", -1 /* CACHED */)),
                _createElementVNode("strong", {
                    class: _normalizeClass($setup.batteryClass($setup.store.telemetry.battery))
                }, _toDisplayString($setup.percent($setup.store.telemetry.battery)), 3 /* TEXT, CLASS */)
            ]),
            _createElementVNode("div", _hoisted_12, [
                _cache[10] || (_cache[10] = _createElementVNode("span", null, "Drohnen-Spannung", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.volts($setup.store.telemetry.flightVoltage)), 1 /* TEXT */)
            ]),
            _createElementVNode("div", _hoisted_13, [
                _cache[11] || (_cache[11] = _createElementVNode("span", null, "Controller-Spannung", -1 /* CACHED */)),
                _createElementVNode("strong", null, _toDisplayString($setup.volts($setup.store.telemetry.remoterVoltage)), 1 /* TEXT */)
            ])
        ]),
        _cache[12] || (_cache[12] = _createElementVNode("p", { class: "telemetry-note" }, [
            _createTextVNode(" Die Cockpit-Höhe entspricht wie in der Potensic-App "),
            _createElementVNode("code", null, "verticalDistance"),
            _createTextVNode(". Das separate Altitude-Feld und TOF werden nur als zusätzliche Telemetrie angezeigt und nicht als Cockpit-Höhe verwendet. ")
        ], -1 /* CACHED */))
    ], 64 /* STABLE_FRAGMENT */));
}
__sfc__.__scopeId = "data-v-94d60acd";
__sfc__.render = render;
export default __sfc__;
