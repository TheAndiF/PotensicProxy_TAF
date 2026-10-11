import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed } from '../../../vendor/vue.js';
import { MapService } from '../../services/MapService.js';
import { worldPoint } from '../../utils/mapProjection.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MapTileLayer',
    props: {
        centerLatitude: { type: Number, required: true },
        centerLongitude: { type: Number, required: true },
        zoom: { type: Number, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        revision: { type: Number, required: false }
    },
    emits: ["tile-error", "tile-load"],
    setup(__props, { expose: __expose, emit: __emit }) {
        __expose();
        const props = __props;
        const emit = __emit;
        const tiles = computed(() => {
            const center = worldPoint(props.centerLongitude, props.centerLatitude, props.zoom);
            const n = 1 << props.zoom;
            const x0 = Math.floor((center.x - props.width / 2) / 256) - 1;
            const x1 = Math.floor((center.x + props.width / 2) / 256) + 1;
            const y0 = Math.floor((center.y - props.height / 2) / 256) - 1;
            const y1 = Math.floor((center.y + props.height / 2) / 256) + 1;
            const out = [];
            for (let tileX = x0; tileX <= x1; tileX++) {
                for (let tileY = y0; tileY <= y1; tileY++) {
                    if (tileY < 0 || tileY >= n)
                        continue;
                    const x = ((tileX % n) + n) % n;
                    out.push({
                        key: `${props.zoom}/${x}/${tileY}/${props.revision || 0}`,
                        url: MapService.tileUrl(props.zoom, x, tileY, props.revision),
                        left: tileX * 256 - center.x + props.width / 2,
                        top: tileY * 256 - center.y + props.height / 2
                    });
                }
            }
            return out;
        });
        function onError() { emit('tile-error'); }
        function onLoad() { emit('tile-load'); }
        const __returned__ = { props, emit, tiles, onError, onLoad };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeStyle as _normalizeStyle } from "../../../vendor/vue.js";
const _hoisted_1 = {
    class: "tiles",
    "aria-hidden": "true"
};
const _hoisted_2 = ["src"];
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.tiles, (tile) => {
            return (_openBlock(), _createElementBlock("img", {
                key: tile.key,
                class: "tile",
                src: tile.url,
                style: _normalizeStyle({ left: tile.left + 'px', top: tile.top + 'px' }),
                draggable: "false",
                onLoad: $setup.onLoad,
                onError: $setup.onError
            }, null, 44 /* STYLE, PROPS, NEED_HYDRATION */, _hoisted_2));
        }), 128 /* KEYED_FRAGMENT */))
    ]));
}
__sfc__.__scopeId = "data-v-3cd4383a";
__sfc__.render = render;
export default __sfc__;
