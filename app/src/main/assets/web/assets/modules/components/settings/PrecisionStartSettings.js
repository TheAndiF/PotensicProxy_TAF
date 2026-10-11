import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { useI18n } from '../../i18n/index.js';
import { usePrecisionStartSettings } from '../../composables/usePrecisionStartSettings.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'PrecisionStartSettings',
    setup(__props, { expose: __expose }) {
        __expose();
        const { t } = useI18n();
        const { endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters } = usePrecisionStartSettings();
        function normalize() {
            endHeight.value = Math.max(1, Math.min(120, Number(endHeight.value) || 20));
            heightStep.value = Math.max(0.5, Math.min(50, Number(heightStep.value) || 5));
            stabilizationSeconds.value = Math.max(0, Math.min(15, Number(stabilizationSeconds.value) || 2));
            positionWarningMeters.value = Math.max(0.5, Math.min(50, Number(positionWarningMeters.value) || 3));
            positionAbortMeters.value = Math.max(positionWarningMeters.value + 0.5, Math.min(100, Number(positionAbortMeters.value) || 6));
        }
        const __returned__ = { t, endHeight, heightStep, stabilizationSeconds, positionWarningMeters, positionAbortMeters, normalize };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, vModelText as _vModelText, withDirectives as _withDirectives, createTextVNode as _createTextVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "pstart-settings" };
const _hoisted_2 = { class: "settings-card" };
const _hoisted_3 = { class: "settings-title" };
const _hoisted_4 = { class: "settings-help" };
const _hoisted_5 = { class: "settings-grid" };
const _hoisted_6 = { class: "input-unit" };
const _hoisted_7 = { class: "input-unit" };
const _hoisted_8 = { class: "input-unit" };
const _hoisted_9 = { class: "input-unit" };
const _hoisted_10 = { class: "input-unit" };
const _hoisted_11 = { class: "rules-box" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, "🎯 " + _toDisplayString($setup.t('pstart.settingsTitle')), 1 /* TEXT */),
            _createElementVNode("p", _hoisted_4, _toDisplayString($setup.t('pstart.settingsHelp')), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_5, [
                _createElementVNode("label", null, [
                    _createElementVNode("span", null, _toDisplayString($setup.t('pstart.endHeight')), 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_6, [
                        _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.endHeight) = $event)),
                            type: "number",
                            min: "1",
                            max: "120",
                            step: "0.5",
                            onChange: $setup.normalize
                        }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                            [
                                _vModelText,
                                $setup.endHeight,
                                void 0,
                                { number: true }
                            ]
                        ]),
                        _cache[5] || (_cache[5] = _createTextVNode(" m", -1 /* CACHED */))
                    ])
                ]),
                _createElementVNode("label", null, [
                    _createElementVNode("span", null, _toDisplayString($setup.t('pstart.heightStep')), 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_7, [
                        _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.heightStep) = $event)),
                            type: "number",
                            min: "0.5",
                            max: "50",
                            step: "0.5",
                            onChange: $setup.normalize
                        }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                            [
                                _vModelText,
                                $setup.heightStep,
                                void 0,
                                { number: true }
                            ]
                        ]),
                        _cache[6] || (_cache[6] = _createTextVNode(" m", -1 /* CACHED */))
                    ])
                ]),
                _createElementVNode("label", null, [
                    _createElementVNode("span", null, _toDisplayString($setup.t('pstart.stabilization')), 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_8, [
                        _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.stabilizationSeconds) = $event)),
                            type: "number",
                            min: "0",
                            max: "15",
                            step: "0.5",
                            onChange: $setup.normalize
                        }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                            [
                                _vModelText,
                                $setup.stabilizationSeconds,
                                void 0,
                                { number: true }
                            ]
                        ]),
                        _cache[7] || (_cache[7] = _createTextVNode(" s", -1 /* CACHED */))
                    ])
                ]),
                _createElementVNode("label", null, [
                    _createElementVNode("span", null, _toDisplayString($setup.t('pstart.positionWarning')), 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_9, [
                        _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.positionWarningMeters) = $event)),
                            type: "number",
                            min: "0.5",
                            max: "50",
                            step: "0.5",
                            onChange: $setup.normalize
                        }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                            [
                                _vModelText,
                                $setup.positionWarningMeters,
                                void 0,
                                { number: true }
                            ]
                        ]),
                        _cache[8] || (_cache[8] = _createTextVNode(" m", -1 /* CACHED */))
                    ])
                ]),
                _createElementVNode("label", null, [
                    _createElementVNode("span", null, _toDisplayString($setup.t('pstart.positionAbort')), 1 /* TEXT */),
                    _createElementVNode("span", _hoisted_10, [
                        _withDirectives(_createElementVNode("input", {
                            "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.positionAbortMeters) = $event)),
                            type: "number",
                            min: "1",
                            max: "100",
                            step: "0.5",
                            onChange: $setup.normalize
                        }, null, 544 /* NEED_HYDRATION, NEED_PATCH */), [
                            [
                                _vModelText,
                                $setup.positionAbortMeters,
                                void 0,
                                { number: true }
                            ]
                        ]),
                        _cache[9] || (_cache[9] = _createTextVNode(" m", -1 /* CACHED */))
                    ])
                ])
            ]),
            _createElementVNode("div", _hoisted_11, [
                _createElementVNode("strong", null, _toDisplayString($setup.t('pstart.v1Rules')), 1 /* TEXT */),
                _createElementVNode("ul", null, [
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleNoLateral')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleFirstPoint')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.rulePositionTolerance')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleGrid')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleImages')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleProtocol')), 1 /* TEXT */),
                    _createElementVNode("li", null, _toDisplayString($setup.t('pstart.ruleStep0')), 1 /* TEXT */)
                ])
            ])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-6f4aba77";
__sfc__.render = render;
export default __sfc__;
