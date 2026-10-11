import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from '../../../vendor/vue.js';
import { ElMessage, ElMessageBox } from '../../../vendor/element-plus.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { useI18n } from '../../i18n/index.js';
import { MAP_CONFIG_CHANGED_EVENT, MapService } from '../../services/MapService.js';
import { MissionService } from '../../services/MissionService.js';
import { ATOM1_CAPABILITIES, newMission, newWaypoint } from '../../types/mission.js';
import MapTileLayer from '../map/MapTileLayer.js';
import MapSourceControls from '../map/MapSourceControls.js';
import { MAP_POSITION_CHANGED_EVENT } from '../../composables/useMapPosition.js';
import { geoPoint, screenPoint as projectScreen, worldPoint } from '../../utils/mapProjection.js';
import { circle, grid, pathLengthMeters, polygon, renumber, spiral, validateMission } from '../../mission/geometry.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'MissionPlannerView',
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        const { t } = useI18n();
        const mission = ref(newMission());
        const library = ref([]);
        const selectedMissionId = ref('');
        const selectedWaypoint = ref(null);
        const mode = ref('manual');
        const params = reactive({ radius: 40, points: 16, width: 60, height: 80, spacing: 12, heading: 0 });
        const mapRoot = ref(null), size = ref({ w: 900, h: 600 }), zoom = ref(15), mapConfig = ref(null);
        const tileRevision = ref(0), tileError = ref(false);
        const center = reactive({ latitude: 52.52, longitude: 13.405 });
        let observer = null;
        let panning = false, panMoved = false, panStart = { x: 0, y: 0 }, panWorld = { x: 0, y: 0 };
        const distance = computed(() => pathLengthMeters(mission.value.waypoints));
        const chunks = computed(() => Math.max(1, Math.ceil(mission.value.waypoints.length / ATOM1_CAPABILITIES.maxWaypointsPerRecord)));
        const issues = computed(() => validateMission(mission.value));
        function validGps() { const { latitude, longitude } = store.telemetry; return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0); }
        function world(lon, lat, z) { return worldPoint(lon, lat, z); }
        function unworld(x, y, z) { return geoPoint(x, y, z); }
        function screenPoint(lat, lon) { return projectScreen(lat, lon, center.latitude, center.longitude, zoom.value, size.value.w, size.value.h); }
        const waypointScreen = computed(() => mission.value.waypoints.map(wp => ({ ...screenPoint(wp.latitude, wp.longitude), wp })));
        const droneScreen = computed(() => validGps() ? screenPoint(store.telemetry.latitude, store.telemetry.longitude) : null);
        const homeScreen = computed(() => { const lat = store.telemetry.homeLatitude, lon = store.telemetry.homeLongitude; return store.telemetry.homeSynced && typeof lat === 'number' && typeof lon === 'number' ? screenPoint(lat, lon) : null; });
        function onWheel(e) { zoom.value = Math.max(1, Math.min(19, zoom.value + (e.deltaY < 0 ? 1 : -1))); }
        function beginPan(e) { if (e.button !== 0)
            return; panning = true; panMoved = false; panStart = { x: e.clientX, y: e.clientY }; panWorld = world(center.longitude, center.latitude, zoom.value); }
        function movePan(e) { if (!panning)
            return; const dx = e.clientX - panStart.x, dy = e.clientY - panStart.y; if (Math.abs(dx) + Math.abs(dy) > 4)
            panMoved = true; const c = unworld(panWorld.x - dx, panWorld.y - dy, zoom.value); center.latitude = c.latitude; center.longitude = c.longitude; }
        function endPan() { panning = false; }
        function onMapClick(e) { if (panMoved) {
            panMoved = false;
            return;
        } if (mode.value !== 'manual' || !mapRoot.value)
            return; const r = mapRoot.value.getBoundingClientRect(), c = world(center.longitude, center.latitude, zoom.value), p = unworld(c.x + (e.clientX - r.left) - size.value.w / 2, c.y + (e.clientY - r.top) - size.value.h / 2, zoom.value); const wp = newWaypoint(p.latitude, p.longitude, mission.value.waypoints.length + 1); mission.value.waypoints.push(wp); mission.value.geometry = { kind: 'manual' }; selectedWaypoint.value = wp; }
        function selectWaypoint(wp) { selectedWaypoint.value = wp; }
        function removeSelected() { if (!selectedWaypoint.value)
            return; mission.value.waypoints = renumber(mission.value.waypoints.filter(w => w.id !== selectedWaypoint.value.id)); selectedWaypoint.value = null; }
        function currentCenter() { return mission.value.waypoints[0] ? { latitude: mission.value.waypoints[0].latitude, longitude: mission.value.waypoints[0].longitude } : { ...center }; }
        function applyGenerated(points, kind) { mission.value.waypoints = renumber(points); mission.value.geometry = { kind, center: currentCenter(), parameters: { ...params } }; selectedWaypoint.value = mission.value.waypoints[0] || null; }
        function template() { return selectedWaypoint.value || mission.value.waypoints[0]; }
        function generateCircle() { applyGenerated(circle(currentCenter(), params.radius, params.points, template()), 'circle'); }
        function generatePolygon() { applyGenerated(polygon(currentCenter(), params.radius, Math.max(3, Math.min(12, params.points)), params.heading, template()), 'polygon'); }
        function generateGrid() { applyGenerated(grid(currentCenter(), params.width, params.height, params.spacing, params.heading, template()), 'grid'); }
        function generateSpiral() { applyGenerated(spiral(currentCenter(), Math.max(1, params.radius / 8), params.radius, 3, params.points, template()), 'spiral'); }
        function reverseRoute() { mission.value.waypoints = renumber([...mission.value.waypoints].reverse()); }
        function centerOnDrone() { if (validGps()) {
            center.latitude = store.telemetry.latitude;
            center.longitude = store.telemetry.longitude;
        }
        else if (mission.value.waypoints[0]) {
            center.latitude = mission.value.waypoints[0].latitude;
            center.longitude = mission.value.waypoints[0].longitude;
        } }
        function createMission() { mission.value = newMission(); selectedMissionId.value = ''; selectedWaypoint.value = null; centerOnDrone(); }
        async function refreshLibrary() { try {
            library.value = await MissionService.list();
        }
        catch (e) {
            ElMessage.warning(`Missionsspeicher nicht erreichbar: ${e instanceof Error ? e.message : e}`);
        } }
        async function saveMission() { try {
            mission.value = await MissionService.save(mission.value);
            selectedMissionId.value = mission.value.id;
            await refreshLibrary();
            ElMessage.success('Mission gespeichert');
            return true;
        }
        catch (e) {
            ElMessage.error(`Speichern fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
            return false;
        } }
        async function loadSelected() { if (!selectedMissionId.value)
            return; try {
            mission.value = await MissionService.load(selectedMissionId.value);
            selectedWaypoint.value = mission.value.waypoints[0] || null;
            if (mission.value.waypoints[0]) {
                center.latitude = mission.value.waypoints[0].latitude;
                center.longitude = mission.value.waypoints[0].longitude;
            }
        }
        catch (e) {
            ElMessage.error(`Laden fehlgeschlagen: ${e instanceof Error ? e.message : e}`);
        } }
        async function deleteSelected() { if (!selectedMissionId.value)
            return; try {
            await ElMessageBox.confirm('Gespeicherte Mission wirklich löschen?', 'Mission löschen');
            await MissionService.remove(selectedMissionId.value);
            createMission();
            await refreshLibrary();
        }
        catch { } }
        async function exportPotensic() { if (await saveMission())
            window.location.href = MissionService.exportPotensicUrl(mission.value.id); }
        function onMapConfigChanged(event) { const detail = event.detail; if (!detail)
            return; mapConfig.value = detail; tileRevision.value++; tileError.value = false; }
        function onMapPositionChanged(event) { const detail = event.detail; if (!detail)
            return; center.latitude = detail.latitude; center.longitude = detail.longitude; }
        onMounted(async () => { window.addEventListener('mousemove', movePan); window.addEventListener('mouseup', endPan); window.addEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged); window.addEventListener(MAP_POSITION_CHANGED_EVENT, onMapPositionChanged); try {
            mapConfig.value = await MapService.getConfig();
            zoom.value = mapConfig.value.defaultZoom || 15;
        }
        catch { } ; if (validGps()) {
            center.latitude = store.telemetry.latitude;
            center.longitude = store.telemetry.longitude;
        } if (mapRoot.value) {
            observer = new ResizeObserver(([e]) => { if (e.contentRect.width > 0 && e.contentRect.height > 0)
                size.value = { w: e.contentRect.width, h: e.contentRect.height }; });
            observer.observe(mapRoot.value);
        } await nextTick(); await refreshLibrary(); });
        onUnmounted(() => { observer?.disconnect(); window.removeEventListener('mousemove', movePan); window.removeEventListener('mouseup', endPan); window.removeEventListener(MAP_CONFIG_CHANGED_EVENT, onMapConfigChanged); window.removeEventListener(MAP_POSITION_CHANGED_EVENT, onMapPositionChanged); });
        const __returned__ = { store, t, mission, library, selectedMissionId, selectedWaypoint, mode, params, mapRoot, size, zoom, mapConfig, tileRevision, tileError, center, get observer() { return observer; }, set observer(v) { observer = v; }, get panning() { return panning; }, set panning(v) { panning = v; }, get panMoved() { return panMoved; }, set panMoved(v) { panMoved = v; }, get panStart() { return panStart; }, set panStart(v) { panStart = v; }, get panWorld() { return panWorld; }, set panWorld(v) { panWorld = v; }, distance, chunks, issues, validGps, world, unworld, screenPoint, waypointScreen, droneScreen, homeScreen, onWheel, beginPan, movePan, endPan, onMapClick, selectWaypoint, removeSelected, currentCenter, applyGenerated, template, generateCircle, generatePolygon, generateGrid, generateSpiral, reverseRoute, centerOnDrone, createMission, refreshLibrary, saveMission, loadSelected, deleteSelected, exportPotensic, onMapConfigChanged, onMapPositionChanged, MapTileLayer, MapSourceControls };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createElementVNode as _createElementVNode, resolveComponent as _resolveComponent, createVNode as _createVNode, createTextVNode as _createTextVNode, withCtx as _withCtx, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, createBlock as _createBlock, toDisplayString as _toDisplayString, createCommentVNode as _createCommentVNode, withModifiers as _withModifiers, normalizeClass as _normalizeClass, normalizeStyle as _normalizeStyle } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "mission-page" };
const _hoisted_2 = { class: "mission-sidebar" };
const _hoisted_3 = { class: "panel" };
const _hoisted_4 = { class: "button-row" };
const _hoisted_5 = { class: "button-row" };
const _hoisted_6 = { class: "panel" };
const _hoisted_7 = { class: "tool-grid" };
const _hoisted_8 = { class: "form-grid" };
const _hoisted_9 = { class: "panel stats" };
const _hoisted_10 = { class: "mission-map-wrap" };
const _hoisted_11 = ["width", "height"];
const _hoisted_12 = ["points"];
const _hoisted_13 = ["onClick"];
const _hoisted_14 = { class: "map-osd" };
const _hoisted_15 = {
    key: 3,
    class: "map-error"
};
const _hoisted_16 = { class: "attribution" };
const _hoisted_17 = { class: "inspector" };
const _hoisted_18 = {
    key: 0,
    class: "panel"
};
const _hoisted_19 = { class: "panel-title" };
const _hoisted_20 = { class: "waypoint-form" };
const _hoisted_21 = {
    key: 1,
    class: "panel"
};
const _hoisted_22 = { class: "panel validation" };
const _hoisted_23 = {
    key: 0,
    class: "issue ok"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_button = _resolveComponent("el-button");
    const _component_el_option = _resolveComponent("el-option");
    const _component_el_select = _resolveComponent("el-select");
    const _component_el_input_number = _resolveComponent("el-input-number");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createElementVNode("aside", _hoisted_2, [
            _createElementVNode("section", _hoisted_3, [
                _cache[27] || (_cache[27] = _createElementVNode("div", { class: "panel-title" }, "Mission", -1 /* CACHED */)),
                _createVNode(_component_el_input, {
                    modelValue: $setup.mission.name,
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.mission.name) = $event)),
                    size: "small"
                }, null, 8 /* PROPS */, ["modelValue"]),
                _createElementVNode("div", _hoisted_4, [
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.createMission
                    }, {
                        default: _withCtx(() => [...(_cache[23] || (_cache[23] = [
                                _createTextVNode("Neu", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_button, {
                        size: "small",
                        type: "primary",
                        onClick: $setup.saveMission
                    }, {
                        default: _withCtx(() => [...(_cache[24] || (_cache[24] = [
                                _createTextVNode("Speichern", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    })
                ]),
                _createVNode(_component_el_select, {
                    modelValue: $setup.selectedMissionId,
                    "onUpdate:modelValue": _cache[1] || (_cache[1] = $event => (($setup.selectedMissionId) = $event)),
                    size: "small",
                    placeholder: "Gespeicherte Mission",
                    onChange: $setup.loadSelected
                }, {
                    default: _withCtx(() => [
                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.library, (m) => {
                            return (_openBlock(), _createBlock(_component_el_option, {
                                key: m.id,
                                label: `${m.name} (${m.waypointCount})`,
                                value: m.id
                            }, null, 8 /* PROPS */, ["label", "value"]));
                        }), 128 /* KEYED_FRAGMENT */))
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["modelValue"]),
                _createElementVNode("div", _hoisted_5, [
                    _createVNode(_component_el_button, {
                        size: "small",
                        disabled: !$setup.selectedMissionId,
                        onClick: $setup.deleteSelected
                    }, {
                        default: _withCtx(() => [...(_cache[25] || (_cache[25] = [
                                _createTextVNode("Löschen", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }, 8 /* PROPS */, ["disabled"]),
                    _createVNode(_component_el_button, {
                        size: "small",
                        disabled: $setup.mission.waypoints.length === 0,
                        onClick: $setup.exportPotensic
                    }, {
                        default: _withCtx(() => [...(_cache[26] || (_cache[26] = [
                                _createTextVNode("map.db", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }, 8 /* PROPS */, ["disabled"])
                ])
            ]),
            _createElementVNode("section", _hoisted_6, [
                _cache[40] || (_cache[40] = _createElementVNode("div", { class: "panel-title" }, "Planungswerkzeuge", -1 /* CACHED */)),
                _createElementVNode("div", _hoisted_7, [
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: _cache[2] || (_cache[2] = $event => ($setup.mode = 'manual')),
                        type: $setup.mode === 'manual' ? 'primary' : 'default'
                    }, {
                        default: _withCtx(() => [...(_cache[28] || (_cache[28] = [
                                _createTextVNode("Wegpunkt", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }, 8 /* PROPS */, ["type"]),
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.generateCircle
                    }, {
                        default: _withCtx(() => [...(_cache[29] || (_cache[29] = [
                                _createTextVNode("Kreis", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.generatePolygon
                    }, {
                        default: _withCtx(() => [...(_cache[30] || (_cache[30] = [
                                _createTextVNode("Polygon", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.generateGrid
                    }, {
                        default: _withCtx(() => [...(_cache[31] || (_cache[31] = [
                                _createTextVNode("Survey", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.generateSpiral
                    }, {
                        default: _withCtx(() => [...(_cache[32] || (_cache[32] = [
                                _createTextVNode("Spirale", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }),
                    _createVNode(_component_el_button, {
                        size: "small",
                        onClick: $setup.reverseRoute
                    }, {
                        default: _withCtx(() => [...(_cache[33] || (_cache[33] = [
                                _createTextVNode("Umkehren", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    })
                ]),
                _createElementVNode("div", _hoisted_8, [
                    _createElementVNode("label", null, [
                        _cache[34] || (_cache[34] = _createTextVNode("Radius m ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.radius,
                            "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.params.radius) = $event)),
                            min: 1,
                            max: 5000,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("label", null, [
                        _cache[35] || (_cache[35] = _createTextVNode("Punkte ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.points,
                            "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.params.points) = $event)),
                            min: 3,
                            max: 200,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("label", null, [
                        _cache[36] || (_cache[36] = _createTextVNode("Breite m ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.width,
                            "onUpdate:modelValue": _cache[5] || (_cache[5] = $event => (($setup.params.width) = $event)),
                            min: 2,
                            max: 5000,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("label", null, [
                        _cache[37] || (_cache[37] = _createTextVNode("Höhe m ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.height,
                            "onUpdate:modelValue": _cache[6] || (_cache[6] = $event => (($setup.params.height) = $event)),
                            min: 2,
                            max: 5000,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("label", null, [
                        _cache[38] || (_cache[38] = _createTextVNode("Raster m ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.spacing,
                            "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => (($setup.params.spacing) = $event)),
                            min: 1,
                            max: 500,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _createElementVNode("label", null, [
                        _cache[39] || (_cache[39] = _createTextVNode("Kurs ° ", -1 /* CACHED */)),
                        _createVNode(_component_el_input_number, {
                            modelValue: $setup.params.heading,
                            "onUpdate:modelValue": _cache[8] || (_cache[8] = $event => (($setup.params.heading) = $event)),
                            min: 0,
                            max: 359,
                            size: "small"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ])
                ])
            ]),
            _createElementVNode("section", _hoisted_9, [
                _createElementVNode("div", null, [
                    _createElementVNode("strong", null, _toDisplayString($setup.mission.waypoints.length), 1 /* TEXT */),
                    _cache[41] || (_cache[41] = _createElementVNode("span", null, "Wegpunkte", -1 /* CACHED */))
                ]),
                _createElementVNode("div", null, [
                    _createElementVNode("strong", null, _toDisplayString(($setup.distance / 1000).toFixed(2)), 1 /* TEXT */),
                    _cache[42] || (_cache[42] = _createElementVNode("span", null, "km Strecke", -1 /* CACHED */))
                ]),
                _createElementVNode("div", null, [
                    _createElementVNode("strong", null, _toDisplayString($setup.chunks), 1 /* TEXT */),
                    _cache[43] || (_cache[43] = _createElementVNode("span", null, "ATOM-1-Blöcke", -1 /* CACHED */))
                ])
            ])
        ]),
        _createElementVNode("section", _hoisted_10, [
            _createElementVNode("div", {
                ref: "mapRoot",
                class: "mission-map",
                onClick: $setup.onMapClick,
                onWheel: _withModifiers($setup.onWheel, ["prevent"]),
                onMousedown: $setup.beginPan
            }, [
                _createVNode($setup["MapTileLayer"], {
                    "center-latitude": $setup.center.latitude,
                    "center-longitude": $setup.center.longitude,
                    zoom: $setup.zoom,
                    width: $setup.size.w,
                    height: $setup.size.h,
                    revision: $setup.tileRevision,
                    onTileError: _cache[9] || (_cache[9] = $event => ($setup.tileError = true)),
                    onTileLoad: _cache[10] || (_cache[10] = $event => ($setup.tileError = false))
                }, null, 8 /* PROPS */, ["center-latitude", "center-longitude", "zoom", "width", "height", "revision"]),
                (_openBlock(), _createElementBlock("svg", {
                    class: "route-layer",
                    width: $setup.size.w,
                    height: $setup.size.h
                }, [
                    ($setup.waypointScreen.length > 1)
                        ? (_openBlock(), _createElementBlock("polyline", {
                            key: 0,
                            points: $setup.waypointScreen.map(p => `${p.x},${p.y}`).join(' ')
                        }, null, 8 /* PROPS */, _hoisted_12))
                        : _createCommentVNode("v-if", true)
                ], 8 /* PROPS */, _hoisted_11)),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.waypointScreen, (p) => {
                    return (_openBlock(), _createElementBlock("button", {
                        key: p.wp.id,
                        class: _normalizeClass(["wp-marker", { selected: $setup.selectedWaypoint?.id === p.wp.id }]),
                        style: _normalizeStyle({ left: p.x + 'px', top: p.y + 'px' }),
                        onClick: _withModifiers($event => ($setup.selectWaypoint(p.wp)), ["stop"])
                    }, _toDisplayString(p.wp.sequence), 15 /* TEXT, CLASS, STYLE, PROPS */, _hoisted_13));
                }), 128 /* KEYED_FRAGMENT */)),
                ($setup.droneScreen)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 0,
                        class: "drone-marker",
                        style: _normalizeStyle({ left: $setup.droneScreen.x + 'px', top: $setup.droneScreen.y + 'px', transform: `translate(-50%,-50%) rotate(${$setup.store.telemetry.heading || 0}deg)` })
                    }, "▲", 4 /* STYLE */))
                    : _createCommentVNode("v-if", true),
                ($setup.homeScreen)
                    ? (_openBlock(), _createElementBlock("div", {
                        key: 1,
                        class: "home-marker",
                        style: _normalizeStyle({ left: $setup.homeScreen.x + 'px', top: $setup.homeScreen.y + 'px' })
                    }, "H", 4 /* STYLE */))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("div", _hoisted_14, [
                    _createElementVNode("span", null, _toDisplayString($setup.center.latitude.toFixed(6)) + ", " + _toDisplayString($setup.center.longitude.toFixed(6)), 1 /* TEXT */),
                    _createElementVNode("span", null, "Z" + _toDisplayString($setup.zoom), 1 /* TEXT */)
                ]),
                ($setup.mapConfig)
                    ? (_openBlock(), _createBlock($setup["MapSourceControls"], {
                        key: 2,
                        class: "standard-controls",
                        config: $setup.mapConfig,
                        modelValue: $setup.zoom,
                        "onUpdate:modelValue": _cache[11] || (_cache[11] = $event => (($setup.zoom) = $event)),
                        "show-data-mode": false,
                        onConfigSaved: _cache[12] || (_cache[12] = $event => ($setup.mapConfig = $event))
                    }, null, 8 /* PROPS */, ["config", "modelValue"]))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("button", {
                    class: "center-control",
                    title: "Auf Drohne zentrieren",
                    onClick: _withModifiers($setup.centerOnDrone, ["stop"])
                }, "⌖"),
                ($setup.tileError)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_15, _toDisplayString($setup.t('map.sourceUnavailable')), 1 /* TEXT */))
                    : _createCommentVNode("v-if", true),
                _createElementVNode("div", _hoisted_16, _toDisplayString($setup.mapConfig?.attribution || ''), 1 /* TEXT */)
            ], 544 /* NEED_HYDRATION, NEED_PATCH */)
        ]),
        _createElementVNode("aside", _hoisted_17, [
            ($setup.selectedWaypoint)
                ? (_openBlock(), _createElementBlock("section", _hoisted_18, [
                    _createElementVNode("div", _hoisted_19, "Wegpunkt " + _toDisplayString($setup.selectedWaypoint.sequence), 1 /* TEXT */),
                    _createElementVNode("div", _hoisted_20, [
                        _createElementVNode("label", null, [
                            _cache[44] || (_cache[44] = _createTextVNode("Breitengrad ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.latitude,
                                "onUpdate:modelValue": _cache[13] || (_cache[13] = $event => (($setup.selectedWaypoint.latitude) = $event)),
                                precision: 7,
                                step: 0.00001,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[45] || (_cache[45] = _createTextVNode("Längengrad ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.longitude,
                                "onUpdate:modelValue": _cache[14] || (_cache[14] = $event => (($setup.selectedWaypoint.longitude) = $event)),
                                precision: 7,
                                step: 0.00001,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[46] || (_cache[46] = _createTextVNode("Höhe m ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.altitude,
                                "onUpdate:modelValue": _cache[15] || (_cache[15] = $event => (($setup.selectedWaypoint.altitude) = $event)),
                                min: -500,
                                max: 10000,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[47] || (_cache[47] = _createTextVNode("Geschwindigkeit m/s ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.speed,
                                "onUpdate:modelValue": _cache[16] || (_cache[16] = $event => (($setup.selectedWaypoint.speed) = $event)),
                                min: 0,
                                max: 100,
                                step: 0.5,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[48] || (_cache[48] = _createTextVNode("Yaw ° ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.yaw,
                                "onUpdate:modelValue": _cache[17] || (_cache[17] = $event => (($setup.selectedWaypoint.yaw) = $event)),
                                min: 0,
                                max: 359,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[49] || (_cache[49] = _createTextVNode("Gimbal ° ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.gimbalPitch,
                                "onUpdate:modelValue": _cache[18] || (_cache[18] = $event => (($setup.selectedWaypoint.gimbalPitch) = $event)),
                                min: -90,
                                max: 30,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[50] || (_cache[50] = _createTextVNode("Zoom × ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.zoom,
                                "onUpdate:modelValue": _cache[19] || (_cache[19] = $event => (($setup.selectedWaypoint.zoom) = $event)),
                                min: 1,
                                max: 20,
                                step: 0.1,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[51] || (_cache[51] = _createTextVNode("Verweildauer s ", -1 /* CACHED */)),
                            _createVNode(_component_el_input_number, {
                                modelValue: $setup.selectedWaypoint.dwellTime,
                                "onUpdate:modelValue": _cache[20] || (_cache[20] = $event => (($setup.selectedWaypoint.dwellTime) = $event)),
                                min: 0,
                                max: 600,
                                size: "small"
                            }, null, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[52] || (_cache[52] = _createTextVNode("Aktion ", -1 /* CACHED */)),
                            _createVNode(_component_el_select, {
                                modelValue: $setup.selectedWaypoint.action,
                                "onUpdate:modelValue": _cache[21] || (_cache[21] = $event => (($setup.selectedWaypoint.action) = $event)),
                                size: "small"
                            }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_option, {
                                        label: "Keine",
                                        value: "none"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "Hover",
                                        value: "hover"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "RTH",
                                        value: "rth"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "Landung",
                                        value: "land"
                                    })
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createElementVNode("label", null, [
                            _cache[53] || (_cache[53] = _createTextVNode("Kamera ", -1 /* CACHED */)),
                            _createVNode(_component_el_select, {
                                modelValue: $setup.selectedWaypoint.cameraAction,
                                "onUpdate:modelValue": _cache[22] || (_cache[22] = $event => (($setup.selectedWaypoint.cameraAction) = $event)),
                                size: "small"
                            }, {
                                default: _withCtx(() => [
                                    _createVNode(_component_el_option, {
                                        label: "Keine",
                                        value: "none"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "Foto",
                                        value: "photo"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "Aufnahme Start",
                                        value: "start-record"
                                    }),
                                    _createVNode(_component_el_option, {
                                        label: "Aufnahme Stop",
                                        value: "stop-record"
                                    })
                                ]),
                                _: 1 /* STABLE */
                            }, 8 /* PROPS */, ["modelValue"])
                        ]),
                        _createVNode(_component_el_button, {
                            size: "small",
                            type: "danger",
                            onClick: $setup.removeSelected
                        }, {
                            default: _withCtx(() => [...(_cache[54] || (_cache[54] = [
                                    _createTextVNode("Wegpunkt löschen", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        })
                    ])
                ]))
                : (_openBlock(), _createElementBlock("section", _hoisted_21, [...(_cache[55] || (_cache[55] = [
                        _createElementVNode("div", { class: "panel-title" }, "Wegpunkt", -1 /* CACHED */),
                        _createElementVNode("p", { class: "muted" }, "Wegpunkt auf der Karte auswählen oder im Modus „Wegpunkt“ auf die Karte klicken.", -1 /* CACHED */)
                    ]))])),
            _createElementVNode("section", _hoisted_22, [
                _cache[57] || (_cache[57] = _createElementVNode("div", { class: "panel-title" }, "ATOM-1-Prüfung", -1 /* CACHED */)),
                (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.issues, (issue) => {
                    return (_openBlock(), _createElementBlock("div", {
                        key: issue.code,
                        class: _normalizeClass(["issue", issue.level])
                    }, [
                        _createElementVNode("strong", null, _toDisplayString(issue.level.toUpperCase()), 1 /* TEXT */),
                        _createElementVNode("span", null, _toDisplayString(issue.message), 1 /* TEXT */)
                    ], 2 /* CLASS */));
                }), 128 /* KEYED_FRAGMENT */)),
                ($setup.issues.length === 0)
                    ? (_openBlock(), _createElementBlock("div", _hoisted_23, [...(_cache[56] || (_cache[56] = [
                            _createElementVNode("strong", null, "OK", -1 /* CACHED */),
                            _createElementVNode("span", null, "Keine Hinweise.", -1 /* CACHED */)
                        ]))]))
                    : _createCommentVNode("v-if", true)
            ])
        ])
    ]));
}
__sfc__.__scopeId = "data-v-d8888a57";
__sfc__.render = render;
export default __sfc__;
