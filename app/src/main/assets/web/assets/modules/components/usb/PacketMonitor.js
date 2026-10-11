import { defineComponent as _defineComponent } from '../../../vendor/vue.js';
import { ref, computed, watch, nextTick } from '../../../vendor/vue.js';
import { useDroneStore } from '../../stores/useDroneStore.js';
import { ByteUtils } from '../../utils/ByteUtils.js';
const __sfc__ = /*@__PURE__*/ _defineComponent({
    __name: 'PacketMonitor',
    emits: ["loadHex"],
    setup(__props, { expose: __expose }) {
        __expose();
        const store = useDroneStore();
        // Filter States
        const filterDir = ref('all');
        const hideTelemetry = ref(false);
        const selectedCategory = ref('all');
        const selectedFeType = ref('all');
        const searchKeyword = ref('');
        const autoScroll = ref(true);
        const tableRef = ref(null);
        // Category Options for filter bar
        const categoryOptions = [
            { value: 'flight_cmd', label: 'Flight Control', icon: '⚡' },
            { value: 'camera', label: 'Camera & Terminal', icon: '📷' },
            { value: 'rf_fpv', label: 'RF Video', icon: '📡' },
            { value: 'remoter', label: 'Controller Status', icon: '🎮' },
            { value: 'telemetry', label: 'Flight Telemetry', icon: '🛫' },
            { value: 'rc_sticks', label: 'Joystick Feedback', icon: '🕹️' },
            { value: 'video', label: 'Video Stream', icon: '📹' },
            { value: 'other', label: 'Other Data', icon: '📦' }
        ];
        function getCategoryLabel(cat) {
            const found = categoryOptions.find(c => c.value === cat);
            return found ? found.label : 'Unknown Type';
        }
        function formatDetailValue(val) {
            if (val === true)
                return 'Yes (True)';
            if (val === false)
                return 'No (False)';
            if (val === null || val === undefined)
                return '--';
            return String(val);
        }
        function getDetailValClass(val) {
            if (val === true)
                return 'val-success';
            if (val === false)
                return 'val-danger';
            if (typeof val === 'string') {
                if (val.includes('Ready') || val.includes('Normal') || val.includes('Ready') || val.includes('Enabled') || val.includes('PASS')) {
                    return 'val-success';
                }
                if (val.includes('Not') || val.includes('Abnormal') || val.includes('High Interference') || val.includes('Triggered') || val.includes('Disabled')) {
                    return 'val-danger';
                }
                if (val.includes('Pairing')) {
                    return 'val-warning';
                }
            }
            return 'val-neutral';
        }
        function selectCategory(cat) {
            selectedCategory.value = cat;
        }
        function resetFilters() {
            filterDir.value = 'all';
            hideTelemetry.value = false;
            selectedCategory.value = 'all';
            selectedFeType.value = 'all';
            searchKeyword.value = '';
        }
        const hasActiveFilter = computed(() => {
            return (filterDir.value !== 'all' ||
                hideTelemetry.value ||
                selectedCategory.value !== 'all' ||
                (selectedFeType.value && selectedFeType.value !== 'all') ||
                !!searchKeyword.value.trim());
        });
        const filteredPackets = computed(() => {
            let list = store.packets;
            // 1. Direction Filter
            if (filterDir.value === 'rx')
                list = list.filter(p => p.dir === 'RX');
            if (filterDir.value === 'tx')
                list = list.filter(p => p.dir === 'TX');
            // 2. Quick Hide High-Frequency Telemetry (telemetry, rc_sticks, video)
            if (hideTelemetry.value) {
                list = list.filter(p => p.category !== 'telemetry' && p.category !== 'rc_sticks' && p.category !== 'video');
            }
            // 3. Category Filter
            if (selectedCategory.value !== 'all') {
                list = list.filter(p => p.category === selectedCategory.value);
            }
            // 4. FE Type Filter
            if (selectedFeType.value && selectedFeType.value !== 'all') {
                if (selectedFeType.value === 'raw') {
                    list = list.filter(p => p.feType === null);
                }
                else {
                    const targetVal = parseInt(selectedFeType.value, 16);
                    list = list.filter(p => p.feType === targetVal);
                }
            }
            // 5. Keyword Search
            if (searchKeyword.value.trim()) {
                const kw = searchKeyword.value.trim().toLowerCase();
                list = list.filter(p => (p.summary && p.summary.toLowerCase().includes(kw)) ||
                    (p.hex && p.hex.toLowerCase().includes(kw)) ||
                    (p.feTypeName && p.feTypeName.toLowerCase().includes(kw)) ||
                    (p.categoryLabel && p.categoryLabel.toLowerCase().includes(kw)));
            }
            return list;
        });
        const filteredCount = computed(() => {
            return Math.max(0, store.packets.length - filteredPackets.value.length);
        });
        function xmlEscape(value) {
            const text = value === null || value === undefined ? '' : String(value);
            return text
                .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&apos;');
        }
        function objectFieldsToXml(tagName, value) {
            if (!value || Object.keys(value).length === 0)
                return `    <${tagName} />`;
            const fields = Object.entries(value)
                .map(([key, fieldValue]) => `      <field name="${xmlEscape(key)}">${xmlEscape(typeof fieldValue === 'object' && fieldValue !== null
                ? JSON.stringify(fieldValue)
                : fieldValue)}</field>`)
                .join('\n');
            return `    <${tagName}>\n${fields}\n    </${tagName}>`;
        }
        function buildPacketLogXml(packetSnapshot) {
            const generatedAt = new Date().toISOString();
            const packetsXml = packetSnapshot.map((p, index) => {
                const feTypeHex = p.feType === null ? '' : `0x${p.feType.toString(16).padStart(2, '0').toUpperCase()}`;
                return [
                    `  <packet index="${index + 1}" id="${xmlEscape(p.id)}">`,
                    `    <direction>${xmlEscape(p.dir)}</direction>`,
                    `    <time>${xmlEscape(p.time)}</time>`,
                    `    <lengthBytes>${p.len}</lengthBytes>`,
                    `    <feType decimal="${p.feType ?? ''}" hex="${feTypeHex}" />`,
                    `    <feTypeName>${xmlEscape(p.feTypeName)}</feTypeName>`,
                    `    <category>${xmlEscape(p.category)}</category>`,
                    `    <categoryLabel>${xmlEscape(p.categoryLabel)}</categoryLabel>`,
                    `    <summary>${xmlEscape(p.summary)}</summary>`,
                    `    <hex>${xmlEscape(p.hex)}</hex>`,
                    objectFieldsToXml('details', p.details),
                    objectFieldsToXml('telemetry', p.telemetry),
                    '  </packet>'
                ].join('\n');
            }).join('\n');
            return [
                '<?xml version="1.0" encoding="UTF-8"?>',
                '<potensicPacketLog>',
                '  <metadata>',
                `    <generatedAt>${xmlEscape(generatedAt)}</generatedAt>`,
                `    <packetCount>${packetSnapshot.length}</packetCount>`,
                '    <bufferLimit>1000</bufferLimit>',
                '    <order>newest-first</order>',
                '  </metadata>',
                packetsXml,
                '</potensicPacketLog>',
                ''
            ].join('\n');
        }
        function savePacketsAsXml() {
            const now = new Date();
            const pad = (value) => String(value).padStart(2, '0');
            const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
            const filename = `${date}_${time}_log.xml`;
            // Snapshot first so incoming RX/TX traffic can continue without mutating the
            // collection being serialized. The snapshot also includes packets waiting in
            // the 100 ms UI batch queue.
            const packetSnapshot = store.getPacketSnapshot();
            const xml = buildPacketLogXml(packetSnapshot);
            const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            // Do not revoke synchronously. Android WebView/Chromium may still be handing
            // the object URL to the download subsystem, especially while RX traffic is busy.
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            store.addLog('INFO', `Saved ${packetSnapshot.length} packet entries to ${filename}`);
        }
        function scrollToNewestPacket() {
            if (!autoScroll.value || !tableRef.value)
                return;
            nextTick(() => {
                if (tableRef.value)
                    tableRef.value.scrollTop = 0;
            });
        }
        // Watch the newest packet ID instead of packet count. Once the ring buffer reaches
        // 1000 entries its length no longer changes, but the newest packet ID still does.
        watch(() => store.packets[0]?.id, () => scrollToNewestPacket());
        watch(autoScroll, enabled => {
            if (enabled)
                scrollToNewestPacket();
        });
        const __returned__ = { store, filterDir, hideTelemetry, selectedCategory, selectedFeType, searchKeyword, autoScroll, tableRef, categoryOptions, getCategoryLabel, formatDetailValue, getDetailValClass, selectCategory, resetFilters, hasActiveFilter, filteredPackets, filteredCount, xmlEscape, objectFieldsToXml, buildPacketLogXml, savePacketsAsXml, scrollToNewestPacket, get ByteUtils() { return ByteUtils; } };
        Object.defineProperty(__returned__, '__isScriptSetup', { enumerable: false, value: true });
        return __returned__;
    }
});
import { createCommentVNode as _createCommentVNode, createTextVNode as _createTextVNode, resolveComponent as _resolveComponent, withCtx as _withCtx, createVNode as _createVNode, toDisplayString as _toDisplayString, createElementVNode as _createElementVNode, renderList as _renderList, Fragment as _Fragment, openBlock as _openBlock, createElementBlock as _createElementBlock, normalizeClass as _normalizeClass, createBlock as _createBlock, withModifiers as _withModifiers } from "../../../vendor/vue.js";
const _hoisted_1 = { class: "monitor-panel" };
const _hoisted_2 = { class: "monitor-toolbar" };
const _hoisted_3 = { class: "toolbar-left" };
const _hoisted_4 = { class: "toolbar-right" };
const _hoisted_5 = { class: "category-filter-bar" };
const _hoisted_6 = { class: "cat-chips" };
const _hoisted_7 = { class: "filter-aux" };
const _hoisted_8 = { class: "stats-text" };
const _hoisted_9 = {
    key: 0,
    class: "filtered-badge"
};
const _hoisted_10 = {
    class: "packet-table-container",
    ref: "tableRef"
};
const _hoisted_11 = ["onClick"];
const _hoisted_12 = { class: "packet-header" };
const _hoisted_13 = { class: "pkt-time" };
const _hoisted_14 = { class: "pkt-len" };
const _hoisted_15 = ["title"];
const _hoisted_16 = ["title"];
const _hoisted_17 = {
    key: 0,
    class: "pkt-details"
};
const _hoisted_18 = {
    key: 0,
    class: "parsed-fields-box"
};
const _hoisted_19 = { class: "fields-grid" };
const _hoisted_20 = { class: "field-key" };
const _hoisted_21 = { class: "hex-section" };
const _hoisted_22 = { class: "hex-title" };
const _hoisted_23 = { class: "hex-dump" };
const _hoisted_24 = {
    key: 1,
    class: "telemetry-info"
};
function render(_ctx, _cache, $props, $setup, $data, $options) {
    const _component_el_radio_button = _resolveComponent("el-radio-button");
    const _component_el_radio_group = _resolveComponent("el-radio-group");
    const _component_el_button = _resolveComponent("el-button");
    const _component_el_checkbox = _resolveComponent("el-checkbox");
    const _component_el_tooltip = _resolveComponent("el-tooltip");
    const _component_el_input = _resolveComponent("el-input");
    const _component_el_tag = _resolveComponent("el-tag");
    const _component_el_option = _resolveComponent("el-option");
    const _component_el_select = _resolveComponent("el-select");
    const _component_el_empty = _resolveComponent("el-empty");
    return (_openBlock(), _createElementBlock("div", _hoisted_1, [
        _createCommentVNode(" Main Toolbar "),
        _createElementVNode("div", _hoisted_2, [
            _createCommentVNode(" Direction & Quick Toggles "),
            _createElementVNode("div", _hoisted_3, [
                _createVNode(_component_el_radio_group, {
                    modelValue: $setup.filterDir,
                    "onUpdate:modelValue": _cache[0] || (_cache[0] = $event => (($setup.filterDir) = $event)),
                    size: "small"
                }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_radio_button, { value: "all" }, {
                            default: _withCtx(() => [...(_cache[8] || (_cache[8] = [
                                    _createTextVNode("All", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "rx" }, {
                            default: _withCtx(() => [...(_cache[9] || (_cache[9] = [
                                    _createTextVNode("RX Receive", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        }),
                        _createVNode(_component_el_radio_button, { value: "tx" }, {
                            default: _withCtx(() => [...(_cache[10] || (_cache[10] = [
                                    _createTextVNode("TX Send", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        })
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["modelValue"]),
                _createCommentVNode(" One-Click Quick Telemetry Filter "),
                _createVNode(_component_el_button, {
                    type: $setup.hideTelemetry ? 'warning' : 'default',
                    plain: !$setup.hideTelemetry,
                    size: "small",
                    class: "quick-filter-btn",
                    onClick: _cache[1] || (_cache[1] = $event => ($setup.hideTelemetry = !$setup.hideTelemetry)),
                    title: $setup.hideTelemetry ? 'Click to show telemetry data again' : 'Click to hide high-rate flight telemetry, joystick feedback, and video frames'
                }, {
                    default: _withCtx(() => [
                        _createTextVNode(_toDisplayString($setup.hideTelemetry ? '🚫 Normal Telemetry Hidden' : '👁️ Hide Normal Telemetry'), 1 /* TEXT */)
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["type", "plain", "title"]),
                _createCommentVNode(" Drop Telemetry at Ingestion to protect queue "),
                _createVNode(_component_el_tooltip, {
                    content: "When enabled, high-rate telemetry is not added to history, preventing important commands from being pushed out.",
                    placement: "top"
                }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_checkbox, {
                            modelValue: $setup.store.ignoreTelemetryAtIngestion,
                            "onUpdate:modelValue": _cache[2] || (_cache[2] = $event => (($setup.store.ignoreTelemetryAtIngestion) = $event)),
                            label: "Queue Flood Protection",
                            size: "small",
                            class: "ingestion-checkbox"
                        }, null, 8 /* PROPS */, ["modelValue"])
                    ]),
                    _: 1 /* STABLE */
                })
            ]),
            _createCommentVNode(" Search & Utility Actions "),
            _createElementVNode("div", _hoisted_4, [
                _createVNode(_component_el_input, {
                    modelValue: $setup.searchKeyword,
                    "onUpdate:modelValue": _cache[3] || (_cache[3] = $event => (($setup.searchKeyword) = $event)),
                    size: "small",
                    placeholder: "Search category/summary/HEX...",
                    style: { "width": "175px" },
                    clearable: ""
                }, null, 8 /* PROPS */, ["modelValue"]),
                _createVNode(_component_el_checkbox, {
                    modelValue: $setup.autoScroll,
                    "onUpdate:modelValue": _cache[4] || (_cache[4] = $event => (($setup.autoScroll) = $event)),
                    label: "Auto Scroll",
                    size: "small"
                }, null, 8 /* PROPS */, ["modelValue"]),
                _createVNode(_component_el_button, {
                    size: "small",
                    type: "primary",
                    plain: "",
                    onClick: $setup.savePacketsAsXml
                }, {
                    default: _withCtx(() => [...(_cache[11] || (_cache[11] = [
                            _createTextVNode("Save", -1 /* CACHED */)
                        ]))]),
                    _: 1 /* STABLE */
                }),
                _createVNode(_component_el_button, {
                    size: "small",
                    type: "danger",
                    plain: "",
                    onClick: _cache[5] || (_cache[5] = $event => ($setup.store.clearPackets()))
                }, {
                    default: _withCtx(() => [...(_cache[12] || (_cache[12] = [
                            _createTextVNode("Clear", -1 /* CACHED */)
                        ]))]),
                    _: 1 /* STABLE */
                })
            ])
        ]),
        _createCommentVNode(" Category Filter Bar (Row 2) "),
        _createElementVNode("div", _hoisted_5, [
            _createElementVNode("div", _hoisted_6, [
                _cache[14] || (_cache[14] = _createElementVNode("span", { class: "cat-label" }, "Type Filter:", -1 /* CACHED */)),
                _createVNode(_component_el_tag, {
                    effect: $setup.selectedCategory === 'all' ? 'dark' : 'plain',
                    class: "filter-chip",
                    size: "small",
                    onClick: _cache[6] || (_cache[6] = $event => ($setup.selectCategory('all')))
                }, {
                    default: _withCtx(() => [...(_cache[13] || (_cache[13] = [
                            _createTextVNode(" All ", -1 /* CACHED */)
                        ]))]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["effect"]),
                (_openBlock(), _createElementBlock(_Fragment, null, _renderList($setup.categoryOptions, (cat) => {
                    return _createVNode(_component_el_tag, {
                        key: cat.value,
                        effect: $setup.selectedCategory === cat.value ? 'dark' : 'plain',
                        class: _normalizeClass(["filter-chip", 'chip-' + cat.value]),
                        size: "small",
                        onClick: $event => ($setup.selectCategory(cat.value))
                    }, {
                        default: _withCtx(() => [
                            _createTextVNode(_toDisplayString(cat.icon) + " " + _toDisplayString(cat.label), 1 /* TEXT */)
                        ]),
                        _: 2 /* DYNAMIC */
                    }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["effect", "class", "onClick"]);
                }), 64 /* STABLE_FRAGMENT */))
            ]),
            _createCommentVNode(" FE Type & Filter Stats "),
            _createElementVNode("div", _hoisted_7, [
                _createVNode(_component_el_select, {
                    modelValue: $setup.selectedFeType,
                    "onUpdate:modelValue": _cache[7] || (_cache[7] = $event => (($setup.selectedFeType) = $event)),
                    placeholder: "FE Type",
                    clearable: "",
                    size: "small",
                    style: { "width": "135px" }
                }, {
                    default: _withCtx(() => [
                        _createVNode(_component_el_option, {
                            value: "all",
                            label: "All FE Type"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x05",
                            label: "FE 0x05 (Camera Response RX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x15",
                            label: "FE 0x15 (Camera Command TX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x14",
                            label: "FE 0x14 (Flight Control Heartbeat TX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x31",
                            label: "FE 0x31 (Flight Controller Response RX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x16",
                            label: "FE 0x16 (RF Video TX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x17",
                            label: "FE 0x17 (Controller Config TX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x21",
                            label: "FE 0x21 (Flight Telemetry RX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x41",
                            label: "FE 0x41 (Controller RC RX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x06",
                            label: "FE 0x06 (Video Stream RX)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "0x12",
                            label: "FE 0x12 (AOA Handshake)"
                        }),
                        _createVNode(_component_el_option, {
                            value: "raw",
                            label: "Non-FE Raw Packet (HFD)"
                        })
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["modelValue"]),
                _createElementVNode("span", _hoisted_8, [
                    _createTextVNode(" Showing " + _toDisplayString($setup.filteredPackets.length) + "/" + _toDisplayString($setup.store.packets.length) + " entries ", 1 /* TEXT */),
                    ($setup.filteredCount > 0)
                        ? (_openBlock(), _createElementBlock("span", _hoisted_9, " (Filtered " + _toDisplayString($setup.filteredCount) + " entries) ", 1 /* TEXT */))
                        : _createCommentVNode("v-if", true)
                ]),
                ($setup.hasActiveFilter)
                    ? (_openBlock(), _createBlock(_component_el_button, {
                        key: 0,
                        size: "small",
                        link: "",
                        type: "primary",
                        onClick: $setup.resetFilters
                    }, {
                        default: _withCtx(() => [...(_cache[15] || (_cache[15] = [
                                _createTextVNode(" Reset Filters ", -1 /* CACHED */)
                            ]))]),
                        _: 1 /* STABLE */
                    }))
                    : _createCommentVNode("v-if", true)
            ])
        ]),
        _createCommentVNode(" Packet Table / List "),
        _createElementVNode("div", _hoisted_10, [
            (_openBlock(true), _createElementBlock(_Fragment, null, _renderList($setup.filteredPackets, (p) => {
                return (_openBlock(), _createElementBlock("div", {
                    key: p.id,
                    class: "packet-row",
                    onClick: $event => (p.expanded = !p.expanded)
                }, [
                    _createElementVNode("div", _hoisted_12, [
                        _createVNode(_component_el_tag, {
                            type: p.dir === 'RX' ? 'success' : 'primary',
                            size: "small",
                            effect: "dark"
                        }, {
                            default: _withCtx(() => [
                                _createTextVNode(_toDisplayString(p.dir), 1 /* TEXT */)
                            ]),
                            _: 2 /* DYNAMIC */
                        }, 1032 /* PROPS, DYNAMIC_SLOTS */, ["type"]),
                        _createCommentVNode(" Category Badge "),
                        _createElementVNode("span", {
                            class: _normalizeClass(["cat-badge", 'cat-' + (p.category || 'other')])
                        }, _toDisplayString(p.categoryLabel || $setup.getCategoryLabel(p.category)), 3 /* TEXT, CLASS */),
                        _createElementVNode("span", _hoisted_13, _toDisplayString(p.time), 1 /* TEXT */),
                        _createElementVNode("span", _hoisted_14, _toDisplayString(p.len) + "B", 1 /* TEXT */),
                        _createElementVNode("span", {
                            class: "pkt-type",
                            title: p.feTypeName
                        }, _toDisplayString(p.feTypeName), 9 /* TEXT, PROPS */, _hoisted_15),
                        _createElementVNode("span", {
                            class: "pkt-summary",
                            title: p.summary
                        }, _toDisplayString(p.summary), 9 /* TEXT, PROPS */, _hoisted_16),
                        _createVNode(_component_el_button, {
                            size: "small",
                            link: "",
                            type: "primary",
                            onClick: _withModifiers($event => (_ctx.$emit('loadHex', p.hex)), ["stop"])
                        }, {
                            default: _withCtx(() => [...(_cache[16] || (_cache[16] = [
                                    _createTextVNode(" Load into Builder ", -1 /* CACHED */)
                                ]))]),
                            _: 1 /* STABLE */
                        }, 8 /* PROPS */, ["onClick"])
                    ]),
                    (p.expanded)
                        ? (_openBlock(), _createElementBlock("div", _hoisted_17, [
                            _createCommentVNode(" Structured Parsed Fields Breakdown "),
                            (p.details && Object.keys(p.details).length > 0)
                                ? (_openBlock(), _createElementBlock("div", _hoisted_18, [
                                    _cache[17] || (_cache[17] = _createElementVNode("div", { class: "fields-header" }, [
                                        _createElementVNode("span", { class: "fields-icon" }, "📊"),
                                        _createElementVNode("strong", null, "Protocol Field Details:")
                                    ], -1 /* CACHED */)),
                                    _createElementVNode("div", _hoisted_19, [
                                        (_openBlock(true), _createElementBlock(_Fragment, null, _renderList(p.details, (val, key) => {
                                            return (_openBlock(), _createElementBlock("div", {
                                                key: key,
                                                class: "field-item"
                                            }, [
                                                _createElementVNode("span", _hoisted_20, _toDisplayString(key) + ":", 1 /* TEXT */),
                                                _createElementVNode("span", {
                                                    class: _normalizeClass(["field-val", $setup.getDetailValClass(val)])
                                                }, _toDisplayString($setup.formatDetailValue(val)), 3 /* TEXT, CLASS */)
                                            ]));
                                        }), 128 /* KEYED_FRAGMENT */))
                                    ])
                                ]))
                                : _createCommentVNode("v-if", true),
                            _createElementVNode("div", _hoisted_21, [
                                _createElementVNode("div", _hoisted_22, [
                                    _createElementVNode("strong", null, "Raw HEX Packet (" + _toDisplayString(p.len) + " bytes):", 1 /* TEXT */)
                                ]),
                                _createElementVNode("div", _hoisted_23, _toDisplayString($setup.ByteUtils.formatHex(p.hex)), 1 /* TEXT */)
                            ]),
                            (p.telemetry)
                                ? (_openBlock(), _createElementBlock("div", _hoisted_24, [
                                    _cache[18] || (_cache[18] = _createElementVNode("strong", null, "Flight Telemetry Mapping:", -1 /* CACHED */)),
                                    _createTextVNode(" " + _toDisplayString(JSON.stringify(p.telemetry)), 1 /* TEXT */)
                                ]))
                                : _createCommentVNode("v-if", true)
                        ]))
                        : _createCommentVNode("v-if", true)
                ], 8 /* PROPS */, _hoisted_11));
            }), 128 /* KEYED_FRAGMENT */)),
            ($setup.filteredPackets.length === 0)
                ? (_openBlock(), _createBlock(_component_el_empty, {
                    key: 0,
                    description: $setup.store.packets.length > 0 ? 'No packets match the current filter' : 'Waiting for USB packet stream...',
                    "image-size": 80,
                    style: { "padding": "40px 0" }
                }, {
                    default: _withCtx(() => [
                        ($setup.hasActiveFilter)
                            ? (_openBlock(), _createBlock(_component_el_button, {
                                key: 0,
                                size: "small",
                                type: "primary",
                                plain: "",
                                onClick: $setup.resetFilters
                            }, {
                                default: _withCtx(() => [...(_cache[19] || (_cache[19] = [
                                        _createTextVNode(" Show All Data ", -1 /* CACHED */)
                                    ]))]),
                                _: 1 /* STABLE */
                            }))
                            : _createCommentVNode("v-if", true)
                    ]),
                    _: 1 /* STABLE */
                }, 8 /* PROPS */, ["description"]))
                : _createCommentVNode("v-if", true)
        ], 512 /* NEED_PATCH */)
    ]));
}
__sfc__.__scopeId = "data-v-641f090e";
__sfc__.render = render;
export default __sfc__;
