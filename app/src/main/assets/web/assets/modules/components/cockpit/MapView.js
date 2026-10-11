import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useI18n } from '../../i18n/index.js';
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService.js';
import { useMapPosition } from '../../composables/useMapPosition.js';
import { screenPoint } from '../../utils/mapProjection.js';
import MapTileLayer from '../map/MapTileLayer.js';
import MapSourceControls from '../map/MapSourceControls.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MapView',
    props: {
        showDataMode: { type: Boolean, required: false, default: false },
        compact: { type: Boolean, required: false, default: false }
    },
    setup(__props, { expose: __expose }) {
        __expose();
        const props = __props;
        const store = useDroneStore();
        const { t } = useI18n();
        const { currentPosition, source: positionSource } = useMapPosition();
        const root = ref(null);
        const config = ref(null);
        const zoom = ref(15);
        const size = ref({ w: 800, h: 500 });
        const tileRevision = ref(0);
        const tileError = ref(false);
        const quickError = ref('');
        let observer = null;
        let loadedAfterError = 0;
        const centerLat = computed(() => currentPosition.value?.latitude ?? 52.52);
        const centerLon = computed(() => currentPosition.value?.longitude ?? 13.405);
        const dataModeLabel = computed(() => ({ auto: 'AUTO', offline: t('map.offlineOnly').toUpperCase(), online: t('map.onlineFirst').toUpperCase() }[config.value?.dataMode || 'auto']));
        const positionLabel = computed(() => {
            if (!currentPosition.value)
                return t('map.waitingGps');
            const coordinates = `${currentPosition.value.latitude.toFixed(6)}, ${currentPosition.value.longitude.toFixed(6)}`;
            return positionSource.value === 'manual' ? `${coordinates} · ${t('map.currentManual').replace('Current position: ', '').replace('Aktuelle Position: ', '')}` : coordinates;
        });
        const homePoint = computed(() => {
            const lat = store.telemetry.homeLatitude;
            const lon = store.telemetry.homeLongitude;
            if (!store.telemetry.homeSynced || !Number.isFinite(lat) || !Number.isFinite(lon) || lat == null || lon == null)
                return null;
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || (lat === 0 && lon === 0))
                return null;
            return screenPoint(lat, lon, centerLat.value, centerLon.value, zoom.value, size.value.w, size.value.h);
        });
        function setZoom(value) { zoom.value = Math.max(1, Math.min(19, Math.round(value))); }
        function onWheel(event) { setZoom(zoom.value + (event.deltaY < 0 ? 1 : -1)); }
        function onTileError() { tileError.value = true; loadedAfterError = 0; }
        function onTileLoad() {
            if (!tileError.value)
                return;
            loadedAfterError++;
            if (loadedAfterError >= 3)
                tileError.value = false;
        }
        function onMapConfigChanged(event) {
            const detail = event.detail;
            if (!detail)
                return;
            config.value = detail;
            quickError.value = '';
            tileError.value = false;
            tileRevision.value++;
        }
        async function refreshSize() {
            await nextTick();
            const measure = () => {
                if (!root.value)
                    return;
                const rect = root.value.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0)
                    size.value = { w: rect.width, h: rect.height };
            };
            requestAnimationFrame(() => { measure(); requestAnimationFrame(measure); });
            window.setTimeout(measure, 80);
            window.setTimeout(measure, 180);
        }
        onMounted(async () => {
            try {
                config.value = await MapService.getConfig();
                zoom.value = config.value.defaultZoom || 15;
            }
            catch { }
            if (root.value) {
                observer = new ResizeObserver(([entry]) => {
                    if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
                        size.value = { w: entry.contentRect.width, h: entry.contentRect.height };
                });
                observer.observe(root.value);
            }
            window.addEventListener('cockpit-view-resized', refreshSize);
            window.addEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged);
            await refreshSize();
        });
        onUnmounted(() => {
            observer?.disconnect();
            window.removeEventListener('cockpit-view-resized', refreshSize);
            window.removeEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged);
        });
        watch(() => config.value?.defaultZoom, value => { if (value)
            zoom.value = value; });
        const __returned__ = { props, store, t, currentPosition, positionSource, root, config, zoom, size, tileRevision, tileError, quickError, get observer() { return observer; }, set observer(v) { observer = v; }, get loadedAfterError() { return loadedAfterError; }, set loadedAfterError(v) { loadedAfterError = v; }, centerLat, centerLon, dataModeLabel, positionLabel, homePoint, setZoom, onWheel, onTileError, onTileLoad, onMapConfigChanged, refreshSize, MapTileLayer, MapSourceControls };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createVNode as _createVNode, createElementVNode as _createElementVNode, openBlock as _openBlock, createElementBlock as _createElementBlock, createCommentVNode as _createCommentVNode, normalizeStyle as _normalizeStyle, toDisplayString as _toDisplayString, createBlock as _createBlock, withModifiers as _withModifiers } from "../../../vendor/vue.js";
const _hoisted_1 = ["width", "height"];
const _hoisted_2 = ["x1", "y1", "x2", "y2"];
const _hoisted_3 = ["title"];
const _hoisted_4 = { class: "map-osd" };
const _hoisted_5 = { key: 0 };
const _hoisted_6 = {
    key: 4,
    class: "map-error",
    role: "status"
};
const _hoisted_7 = { class: "attribution" };
function render(_ctx, _cache, $props, $setup, $data, $options) {
    return (_openBlock(), _createElementBlock("div", {
        class: "map-view",
        ref: "root",
        onWheel: _withModifiers($setup.onWheel, ["prevent"])
    }, [
        _createVNode($setup["MapTileLayer"], {
            "center-latitude": $setup.centerLat,
            "center-longitude": $setup.centerLon,
            zoom: $setup.zoom,
            width: $setup.size.w,
            height: $setup.size.h,
            revision: $setup.tileRevision,
            onTileError: $setup.onTileError,
            onTileLoad: $setup.onTileLoad
        }, null, 8 /* PROPS */, ["center-latitude", "center-longitude", "zoom", "width", "height", "revision"]),
        ($setup.homePoint)
            ? (_openBlock(), _createElementBlock("svg", {
                key: 0,
                class: "home-line",
                width: $setup.size.w,
                height: $setup.size.h,
                "aria-hidden": "true"
            }, [
                _createElementVNode("line", {
                    x1: $setup.size.w / 2,
                    y1: $setup.size.h / 2,
                    x2: $setup.homePoint.x,
                    y2: $setup.homePoint.y
                }, null, 8 /* PROPS */, _hoisted_2)
            ], 8 /* PROPS */, _hoisted_1))
            : _createCommentVNode("v-if", true),
        ($setup.homePoint)
            ? (_openBlock(), _createElementBlock("div", {
                key: 1,
                class: "home-marker",
                style: _normalizeStyle({ left: $setup.homePoint.x + 'px', top: $setup.homePoint.y + 'px' }),
                title: $setup.t('map.homePoint')
            }, "H", 12 /* STYLE, PROPS */, _hoisted_3))
            : _createCommentVNode("v-if", true),
        ($setup.positionSource === 'drone')
            ? (_openBlock(), _createElementBlock("div", {
                key: 2,
                class: "drone-marker",
                style: _normalizeStyle({ transform: `translate(-50%,-50%) rotate(${$setup.store.telemetry.heading || 0}deg)` })
            }, "▲", 4 /* STYLE */))
            : _createCommentVNode("v-if", true),
        _createElementVNode("div", _hoisted_4, [
            _createElementVNode("span", null, _toDisplayString($setup.positionLabel), 1 /* TEXT */),
            _createElementVNode("span", null, "Z" + _toDisplayString($setup.zoom), 1 /* TEXT */),
            ($props.showDataMode)
                ? (_openBlock(), _createElementBlock("span", _hoisted_5, _toDisplayString($setup.dataModeLabel), 1 /* TEXT */))
                : _createCommentVNode("v-if", true)
        ]),
        ($setup.config)
            ? (_openBlock(), _createBlock($setup["MapSourceControls"], {
                key: 3,
                class: "map-standard-controls",
                config: $setup.config,
                modelValue: $setup.zoom,
                "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.zoom) = $event)),
                "show-data-mode": $props.showDataMode,
                compact: $props.compact,
                onConfigSaved: _cache[1] || (_cache[1] = $event => ($setup.config = $event)),
                onError: _cache[2] || (_cache[2] = $event => ($setup.quickError = $event))
            }, null, 8 /* PROPS */, ["config", "modelValue", "show-data-mode", "compact"]))
            : _createCommentVNode("v-if", true),
        ($setup.tileError || $setup.quickError)
            ? (_openBlock(), _createElementBlock("div", _hoisted_6, _toDisplayString($setup.quickError || $setup.t('map.sourceUnavailable')), 1 /* TEXT */))
            : _createCommentVNode("v-if", true),
        _createElementVNode("div", _hoisted_7, _toDisplayString($setup.config?.attribution || ''), 1 /* TEXT */)
    ], 544 /* NEED_HYDRATION, NEED_PATCH */));
}
__sfc__.__scopeId = "data-v-85c593c8";
__sfc__.render = render;
export default __sfc__;
