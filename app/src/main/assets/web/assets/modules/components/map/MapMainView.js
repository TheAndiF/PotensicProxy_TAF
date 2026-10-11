import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import MapView from '../cockpit/MapView.js';
import MapSettingsView from '../settings/MapSettingsView.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MapMainView',
    setup(__props, { expose: __expose }) {
        __expose();
        const __returned__ = { MapView, MapSettingsView };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createVNode as _createVNode, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "map-page" };
const _hoisted_2 = { class: "map-stage" };
const _hoisted_3 = { class: "map-settings" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("section", _hoisted_2, [
            _createVNode($setup["MapView"], { "show-data-mode": false })
        ]),
        _createElementVNode("aside", _hoisted_3, [
            _createVNode($setup["MapSettingsView"])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-0e99671d";
__sfc__.render = render;
export default __sfc__;
