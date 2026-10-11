import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { useI18n } from '../../i18n/index.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'LanguagePanel',
    setup(__props, { expose: __expose }) {
        __expose();
        const { t, locale, setLocale } = useI18n();
        function onChange(value) { setLocale(value); }
        const __returned__ = { t, locale, setLocale, onChange };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, resolveComponent as _resolveComponent, createVNode as _createVNode, withCtx as _withCtx, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "language-panel" };
const _hoisted_2 = { class: "language-copy" };
const _hoisted_3 = { class: "language-title" };
const _hoisted_4 = { class: "language-subtitle" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_option = _resolveComponent("el-option");
    const _component_el_select = _resolveComponent("el-select");
    return (_openBlock(), _createElementBlock("section", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, _toDisplayString($setup.t('language.title')), 1 /* TEXT */),
            _createElementVNode("div", _hoisted_4, _toDisplayString($setup.t('language.subtitle')), 1 /* TEXT */)
        ]),
        _createVNode(_component_el_select, {
            modelValue: $setup.locale,
            "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.locale) = $event)),
            size: "small",
            class: "language-select",
            onChange: $setup.onChange
        }, {
            default: _withCtx(() => [
                _createVNode(_component_el_option, {
                    value: "system",
                    label: $setup.t('language.system')
                }, null, 8 /* PROPS */, ["label"]),
                _createVNode(_component_el_option, {
                    value: "de",
                    label: $setup.t('language.german')
                }, null, 8 /* PROPS */, ["label"]),
                _createVNode(_component_el_option, {
                    value: "en",
                    label: $setup.t('language.english')
                }, null, 8 /* PROPS */, ["label"]),
                _createVNode(_component_el_option, {
                    value: "zh",
                    label: $setup.t('language.chinese')
                }, null, 8 /* PROPS */, ["label"])
            ]),
            _: 1 /* STABLE */
        }, 8 /* PROPS */, ["modelValue"])
    ]));
}
__sfc__.__scopeId = "data-v-c2c86ecf";
__sfc__.render = render;
export default __sfc__;
