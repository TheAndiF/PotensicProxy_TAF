import { defineComponent as _defineComponent } from '../vendor/vue.js';
import { onMounted, onUnmounted } from '../vendor/vue.js';
import HeaderBar from './components/header/HeaderBar.js';
import CockpitView from './components/cockpit/CockpitView.js';
import MissionPlannerView from './components/mission/MissionPlannerView.js';
import MapMainView from './components/map/MapMainView.js';
import GalleryView from './components/gallery/GalleryView.js';
import UsbManagerView from './components/usb/UsbManagerView.js';
import DebugConsoleView from './components/debug/DebugConsoleView.js';
import { useDroneStore } from './stores/useDroneStore.js';
import { UsbTransportService } from './services/UsbTransportService.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'App',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        onMounted(() => {
            UsbTransportService.getInstance().start();
            store.addLog('INFO', 'Potensic Proxy - TAF Vue 3 modular console started');
        });
        onUnmounted(() => {
            UsbTransportService.getInstance().stop();
        });
        const __returned__ = { store, HeaderBar, CockpitView, MissionPlannerView, MapMainView, GalleryView, UsbManagerView, DebugConsoleView };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createVNode as _createVNode, openBlock as _openBlock, createBlock as _createBlock, createCommentVNode as _createCommentVNode, vShow as _vShow, withDirectives as _withDirectives, createElementVNode as _createElementVNode, createElementBlock as _createElementBlock } from "../vendor/vue.js";
const _hoisted_1 = { id: "app-root" };
const _hoisted_2 = { class: "view-container" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createVNode($setup["HeaderBar"]),
        _createElementVNode("main", _hoisted_2, [
            ($setup.store.activeTab === 'cockpit')
                ? (_openBlock(), _createBlock($setup["CockpitView"], { key: 0 }))
                : _createCommentVNode("v-if", true),
            ($setup.store.activeTab === 'mission')
                ? (_openBlock(), _createBlock($setup["MissionPlannerView"], { key: 1 }))
                : _createCommentVNode("v-if", true),
            ($setup.store.activeTab === 'map')
                ? (_openBlock(), _createBlock($setup["MapMainView"], { key: 2 }))
                : _createCommentVNode("v-if", true),
            ($setup.store.activeTab === 'gallery')
                ? (_openBlock(), _createBlock($setup["GalleryView"], { key: 3 }))
                : _createCommentVNode("v-if", true),
            _withDirectives(_createVNode($setup["UsbManagerView"], null, null, 512 /* NEED_PATCH */), [
                [_vShow, $setup.store.activeTab === 'usb']
            ]),
            ($setup.store.activeTab === 'debug')
                ? (_openBlock(), _createBlock($setup["DebugConsoleView"], { key: 4 }))
                : _createCommentVNode("v-if", true)
        ])
    ]));
}
__sfc__.__scopeId = "data-v-f13b4d11";
__sfc__.render = render;
export default __sfc__;
