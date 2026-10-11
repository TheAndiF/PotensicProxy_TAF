import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'InfoPopover',
    props: {
        content: { type: String, required: true },
        ariaLabel: { type: String, required: false },
        width: { type: Number, required: false, default: 320 }
    },
    setup(__props, { expose: __expose }) {
        __expose();
        const __returned__ = {};
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, openBlock as _openBlock, createBlock as _createBlock } from "../../../vendor/vue.js";
const _hoisted_1 = ["aria-label"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_popover = _resolveComponent("el-popover");
    return (_openBlock(), _createBlock(_component_el_popover, {
        placement: "top",
        width: $props.width,
        trigger: "click",
        content: $props.content
    }, {
        reference: _withCtx(() => [
            _createElementVNode("button", {
                type: "button",
                class: "info-button",
                "aria-label": $props.ariaLabel || 'Info'
            }, "i", 8 /* PROPS */, _hoisted_1)
        ]),
        _: 1 /* STABLE */
    }, 8 /* PROPS */, ["width", "content"]));
}
__sfc__.__scopeId = "data-v-8f8c82cb";
__sfc__.render = render;
export default __sfc__;
