import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { useTelemetryDisplaySettings } from '../../composables/useTelemetryDisplaySettings.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'DisplaySettingsPanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const { fontSizePx, minFontSize, maxFontSize, defaultFontSize } = useTelemetryDisplaySettings();
        const __returned__ = { fontSizePx, minFontSize, maxFontSize, defaultFontSize };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, vModelText as _vModelText, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "display-settings-panel" };
const _hoisted_2 = { class: "display-controls" };
const _hoisted_3 = { class: "font-size-value" };
const _hoisted_4 = ["min", "max"];
const _hoisted_5 = ["min", "max"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _cache[5] || (_cache[5] = _createElementVNode("div", { class: "display-copy" }, [
            _createElementVNode("div", { class: "display-title" }, "Anzeige"),
            _createElementVNode("div", { class: "display-subtitle" }, "Schriftgröße der Telemetrie-Leiste im Flight Cockpit für große Displays anpassen.")
        ], -1 /* CACHED */)),
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("label", _hoisted_3, [
                _cache[3] || (_cache[3] = _createElementVNode("span", null, "Telemetrie", -1 /* CACHED */)),
                _withDirectives(_createElementVNode("input", {
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.fontSizePx) = $event)),
                    type: "number",
                    min: $setup.minFontSize,
                    max: $setup.maxFontSize,
                    step: "1"
                }, null, 8 /* PROPS */, _hoisted_4), [
                    [
                        _vModelText,
                        $setup.fontSizePx,
                        void 0,
                        { number: true }
                    ]
                ]),
                _cache[4] || (_cache[4] = _createElementVNode("span", null, "px", -1 /* CACHED */))
            ]),
            _withDirectives(_createElementVNode("input", {
                "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.fontSizePx) = $event)),
                class: "font-size-slider",
                type: "range",
                min: $setup.minFontSize,
                max: $setup.maxFontSize,
                step: "1"
            }, null, 8 /* PROPS */, _hoisted_5), [
                [
                    _vModelText,
                    $setup.fontSizePx,
                    void 0,
                    { number: true }
                ]
            ]),
            _createElementVNode("button", {
                class: "reset-button",
                type: "button",
                onClick: _cache[2] || (_cache[2] = $event => ($setup.fontSizePx = $setup.defaultFontSize))
            }, "Standard")
        ])
    ]));
}
__sfc__.__scopeId = "data-v-62b77a36";
__sfc__.render = render;
export default __sfc__;
