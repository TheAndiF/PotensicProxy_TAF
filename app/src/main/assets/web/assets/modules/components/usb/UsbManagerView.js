import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref } from '../../../vendor/vue.js';
import PacketConstructor from './PacketConstructor.js';
import UsbCapturePanel from './UsbCapturePanel.js';
import PacketMonitor from './PacketMonitor.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'UsbManagerView',
    setup(__props, { expose: __expose }) {
        __expose();
        const constructorRef = ref(null);
        function onLoadHex(hex) {
            if (constructorRef.value) {
                constructorRef.value.loadHex(hex);
            }
        }
        const __returned__ = { constructorRef, onLoadHex, PacketConstructor, UsbCapturePanel, PacketMonitor };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createVNode as _createVNode, openBlock as _openBlock, createElementBlock as _createElementBlock } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "usb-view-layout" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createVNode($setup["UsbCapturePanel"]),
        _createVNode($setup["PacketConstructor"], { ref: "constructorRef" }, null, 512 /* NEED_PATCH */),
        _createVNode($setup["PacketMonitor"], { onLoadHex: $setup.onLoadHex })
    ]));
}
__sfc__.__scopeId = "data-v-f19af6b5";
__sfc__.render = render;
export default __sfc__;
