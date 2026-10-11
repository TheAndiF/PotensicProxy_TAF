import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { Compass } from '../../../vendor/element-plus-icons.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useI18n } from '../../i18n/index.js';
import { useUiTheme } from '../../composables/useUiTheme.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'HeaderBar',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const { t } = useI18n();
        const { theme } = useUiTheme();
        const __returned__ = { store, t, theme, get Compass() { return Compass; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createVNode as _createVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createElementVNode as _createElementVNode, toDisplayString as _toDisplayString, createTextVNode as _createTextVNode, vModelSelect as _vModelSelect, withDirectives as _withDirectives, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "app-header" };
const _hoisted_2 = { class: "brand-section" };
const _hoisted_3 = { class: "logo" };
const _hoisted_4 = {
    class: "tabs-group",
    "aria-label": "Main navigation"
};
const _hoisted_5 = { class: "status-tags" };
const _hoisted_6 = ["title"];
const _hoisted_7 = { value: "dark" };
const _hoisted_8 = { value: "light" };
const _hoisted_9 = { value: "gray" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_icon = _resolveComponent("el-icon");
    const _component_el_radio_button = _resolveComponent("el-radio-button");
    const _component_el_radio_group = _resolveComponent("el-radio-group");
    const _component_el_tag = _resolveComponent("el-tag");
    return (_openBlock(), _createElementBlock("header", _hoisted_1, [
        _createElementVNode("div", _hoisted_2, [
            _createElementVNode("div", _hoisted_3, [
                _createVNode(_component_el_icon, {
                    size: 20,
                    color: "#00ff88"
                }, {
                    default: _withCtx(() => [
                        _createVNode($setup["Compass"])
                    ]),
                    _: 1 /* STABLE */
                }),
                _cache[2] || (_cache[2] = _createElementVNode("span", { class: "title" }, "POTENSIC PROXY - TAF", -1 /* CACHED */))
            ])
        ]),
        _createElementVNode("nav", _hoisted_4, [
            _createVNode(_component_el_radio_group, {
                modelValue: $setup.store.activeTab,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.store.activeTab) = $event)),
                size: "small",
                class: "main-tabs"
            }, {
                default: _withCtx(() => [
                    _createVNode(_component_el_radio_button, { value: "cockpit" }, {
                        default: _withCtx(() => [
                            _createTextVNode("🎮 " + _toDisplayString($setup.t('header.cockpit')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_radio_button, { value: "mission" }, {
                        default: _withCtx(() => [
                            _createTextVNode("🧭 " + _toDisplayString($setup.t('header.mission')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_radio_button, { value: "map" }, {
                        default: _withCtx(() => [
                            _createTextVNode("🗺️ " + _toDisplayString($setup.t('header.map')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_radio_button, { value: "gallery" }, {
                        default: _withCtx(() => [
                            _createTextVNode("🖼️ " + _toDisplayString($setup.t('header.gallery')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_radio_button, { value: "usb" }, {
                        default: _withCtx(() => [
                            _createTextVNode("⚡ " + _toDisplayString($setup.t('header.usb')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_radio_button, { value: "debug" }, {
                        default: _withCtx(() => [
                            _createTextVNode("🛠️ " + _toDisplayString($setup.t('header.system')), 1 /* TEXT */)
                        ]),
                        _: 1 /* STABLE */
                    })
                ]),
                _: 1 /* STABLE */
            }, 8 /* PROPS */, ["modelValue"])
        ]),
        _createElementVNode("div", _hoisted_5, [
            _createElementVNode("label", {
                class: "theme-picker",
                title: $setup.t('theme.title')
            }, [
                _createElementVNode("span", null, _toDisplayString($setup.t('theme.title')), 1 /* TEXT */),
                _withDirectives(_createElementVNode("select", {
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.theme) = $event))
                }, [
                    _createElementVNode("option", _hoisted_7, _toDisplayString($setup.t('theme.dark')), 1 /* TEXT */),
                    _createElementVNode("option", _hoisted_8, _toDisplayString($setup.t('theme.light')), 1 /* TEXT */),
                    _createElementVNode("option", _hoisted_9, _toDisplayString($setup.t('theme.gray')), 1 /* TEXT */)
                ], 512 /* NEED_PATCH */), [
                    [_vModelSelect, $setup.theme]
                ])
            ], 8 /* PROPS */, _hoisted_6),
            _createVNode(_component_el_tag, {
                type: $setup.store.connection.usbConnected ? 'success' : 'danger',
                effect: "dark",
                size: "small"
            }, {
                default: _withCtx(() => [
                    _createTextVNode(" USB: " + _toDisplayString($setup.store.connection.usbConnected ? $setup.t('status.connected') : $setup.t('status.disconnected')), 1 /* TEXT */)
                ]),
                _: 1 /* STABLE */
            }, 8 /* PROPS */, ["type"]),
            _createVNode(_component_el_tag, {
                type: $setup.store.connection.wsConnected ? 'success' : 'info',
                effect: "dark",
                size: "small"
            }, {
                default: _withCtx(() => [
                    _createTextVNode(" Passthrough: " + _toDisplayString($setup.store.connection.wsConnected ? $setup.t('status.ready') : $setup.t('status.disconnected')), 1 /* TEXT */)
                ]),
                _: 1 /* STABLE */
            }, 8 /* PROPS */, ["type"])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-48ba7c8a";
__sfc__.render = render;
export default __sfc__;
