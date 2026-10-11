/**
 * Video extractor for Potensic ATOM / ATOM 2 FE 0x06 streams.
 *
 * ATOM:   3-byte per-FE transport prefix -> H.264 Annex-B access units.
 * ATOM 2: w42 transport (CC BB AA FF) -> H.264/H.265 payloads.
 */
import { ByteUtils } from '../utils/ByteUtils.js';
export class VideoExtractor {
    constructor() {
        Object.defineProperty(this, "droneModel", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'ATOM'
        });
        Object.defineProperty(this, "videoBuffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Uint8Array(0)
        });
        Object.defineProperty(this, "atomFrameBuffer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Uint8Array(0)
        });
        Object.defineProperty(this, "atomFrameIsKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "frameSeq", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "vps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "sps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pps", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "sps264", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "pps264", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "detectedCodec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'h264'
        });
        Object.defineProperty(this, "currentWidth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 1280
        });
        Object.defineProperty(this, "currentHeight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 720
        });
        Object.defineProperty(this, "packetsFed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "videoChunksParsed", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "framesExtracted", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "iFrames", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "pFrames", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastFrameTime", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastWidth", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "lastHeight", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "listeners", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
    }
    static getInstance() {
        if (!this.instance)
            this.instance = new VideoExtractor();
        return this.instance;
    }
    setDroneModel(model) {
        const normalized = model === 'ATOM_2' ? 'ATOM_2' : 'ATOM';
        if (this.droneModel === normalized)
            return;
        this.droneModel = normalized;
        this.currentWidth = normalized === 'ATOM' ? 1280 : 1920;
        this.currentHeight = normalized === 'ATOM' ? 720 : 1080;
        this.detectedCodec = normalized === 'ATOM' ? 'h264' : 'unknown';
        this.reset();
        console.info(`[VideoExtractor] Drone model=${normalized}`);
    }
    getDroneModel() { return this.droneModel; }
    onFrame(listener) {
        this.listeners.push(listener);
        return () => {
            const idx = this.listeners.indexOf(listener);
            if (idx >= 0)
                this.listeners.splice(idx, 1);
        };
    }
    getStreamInitBytes(codec = this.detectedCodec === 'h264' ? 'h264' : 'h265') {
        if (codec === 'h264') {
            const s = this.sps264 || new Uint8Array(0);
            const p = this.pps264 || new Uint8Array(0);
            return this.concat(s, p);
        }
        const v = this.vps || VideoExtractor.FALLBACK_VPS;
        const s = this.sps || VideoExtractor.FALLBACK_SPS;
        const p = this.pps || VideoExtractor.FALLBACK_PPS;
        return this.concat(v, s, p);
    }
    reset() {
        this.videoBuffer = new Uint8Array(0);
        this.atomFrameBuffer = new Uint8Array(0);
        this.atomFrameIsKey = false;
        this.vps = null;
        this.sps = null;
        this.pps = null;
        this.sps264 = null;
        this.pps264 = null;
        this.frameSeq = 0;
    }
    feed(data) {
        if (!data || data.length === 0)
            return false;
        this.packetsFed++;
        let payload = data;
        if (data.length >= VideoExtractor.FE_HEADER_SIZE && data[0] === 0xfe && data[1] === 0x00 &&
            data[2] === 0x00 && data[3] === 0x00 && data[4] === 0x00 && data[5] === 0x00 && data[7] === 0x06) {
            const plen = ((data[12] & 0xff) << 24) | ((data[13] & 0xff) << 16) | ((data[14] & 0xff) << 8) | (data[15] & 0xff);
            const available = data.length - VideoExtractor.FE_HEADER_SIZE;
            const copyLen = plen > 0 && plen <= available ? plen : available;
            payload = data.subarray(VideoExtractor.FE_HEADER_SIZE, VideoExtractor.FE_HEADER_SIZE + copyLen);
        }
        if (this.droneModel === 'ATOM')
            return this.feedAtom(payload);
        return this.feedW42(payload);
    }
    /** Real ATOM capture: [seq][flags][class] then H.264 Annex-B fragment. */
    feedAtom(payload) {
        if (payload.length <= 3)
            return true;
        const flags = payload[1] & 0xff;
        const frameClass = payload[2] & 0xff;
        const start = (flags & 0x08) !== 0;
        const end = (flags & 0x04) !== 0;
        const keyHint = (flags & 0x01) !== 0 || frameClass === 0x05;
        const fragment = payload.subarray(3);
        if (start) {
            this.atomFrameBuffer = fragment.slice();
            this.atomFrameIsKey = keyHint;
        }
        else if (this.atomFrameBuffer.length > 0) {
            this.atomFrameBuffer = this.concat(this.atomFrameBuffer, fragment);
            this.atomFrameIsKey = this.atomFrameIsKey || keyHint;
        }
        else {
            return true;
        }
        if (this.atomFrameBuffer.length > VideoExtractor.MAX_BUFFER_SIZE) {
            this.atomFrameBuffer = new Uint8Array(0);
            this.atomFrameIsKey = false;
            return true;
        }
        if (end) {
            const frame = this.atomFrameBuffer;
            const isKey = this.atomFrameIsKey;
            this.atomFrameBuffer = new Uint8Array(0);
            this.atomFrameIsKey = false;
            this.videoChunksParsed++;
            this.processAtomAccessUnit(frame, isKey);
        }
        return true;
    }
    processAtomAccessUnit(data, keyHint) {
        if (data.length < 5)
            return;
        const starts = this.findStartCodes(data);
        let containsPicture = false;
        let isIDR = keyHint;
        let containsSps = false;
        let containsPps = false;
        starts.forEach((start, i) => {
            const end = i + 1 < starts.length ? starts[i + 1].start : data.length;
            if (start.header >= data.length || end <= start.start)
                return;
            const nal = data.slice(start.start, end);
            const type = data[start.header] & 0x1f;
            if (type === 7) {
                this.sps264 = nal;
                containsSps = true;
            }
            else if (type === 8) {
                this.pps264 = nal;
                containsPps = true;
            }
            else if (type === 5) {
                isIDR = true;
                containsPicture = true;
            }
            else if (type === 1)
                containsPicture = true;
        });
        if (!containsPicture)
            return;
        this.detectedCodec = 'h264';
        let finalData = data;
        if (isIDR && !(containsSps && containsPps) && this.sps264 && this.pps264) {
            finalData = this.concat(this.sps264, this.pps264, data);
        }
        this.emitFrame(finalData, 1280, 720, isIDR, 'h264');
    }
    feedW42(payload) {
        if (payload.length === 0)
            return true;
        this.videoBuffer = this.concat(this.videoBuffer, payload);
        let k = 0;
        const limit = this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE;
        let lastConsumed = 0;
        while (k <= limit) {
            if (this.videoBuffer[k] === 0xcc && this.videoBuffer[k + 1] === 0xbb && this.videoBuffer[k + 2] === 0xaa && this.videoBuffer[k + 3] === 0xff) {
                const w = (this.videoBuffer[k + 4] & 0xff) | ((this.videoBuffer[k + 5] & 0xff) << 8);
                const h = (this.videoBuffer[k + 6] & 0xff) | ((this.videoBuffer[k + 7] & 0xff) << 8);
                const frameOrder = (this.videoBuffer[k + 8] & 0xff) | ((this.videoBuffer[k + 9] & 0xff) << 8);
                const dataType = this.videoBuffer[k + 10] & 0xff;
                const refreshType = this.videoBuffer[k + 11] & 0xff;
                const payloadLen = (this.videoBuffer[k + 12] & 0xff) | ((this.videoBuffer[k + 13] & 0xff) << 8) |
                    ((this.videoBuffer[k + 14] & 0xff) << 16) | ((this.videoBuffer[k + 15] & 0xff) << 24);
                const realPayloadLen = (this.videoBuffer[k + 16] & 0xff) | ((this.videoBuffer[k + 17] & 0xff) << 8) |
                    ((this.videoBuffer[k + 18] & 0xff) << 16) | ((this.videoBuffer[k + 19] & 0xff) << 24);
                if (payloadLen < 0 || payloadLen > 1000000 || realPayloadLen < 0 || realPayloadLen > payloadLen) {
                    k++;
                    continue;
                }
                const totalChunkLen = VideoExtractor.VIDEO_HEADER_SIZE + payloadLen;
                if (k + totalChunkLen > this.videoBuffer.length) {
                    lastConsumed = k;
                    break;
                }
                this.videoChunksParsed++;
                if (w > 0 && h > 0) {
                    this.currentWidth = w;
                    this.currentHeight = h;
                }
                if (dataType === 0 && realPayloadLen > 4) {
                    const nalData = this.videoBuffer.subarray(k + VideoExtractor.VIDEO_HEADER_SIZE, k + VideoExtractor.VIDEO_HEADER_SIZE + realPayloadLen);
                    this.processW42Nal(nalData, w, h, frameOrder, refreshType === 0);
                }
                k += totalChunkLen;
                lastConsumed = k;
            }
            else
                k++;
        }
        if (lastConsumed > 0)
            this.videoBuffer = this.videoBuffer.subarray(lastConsumed);
        else if (this.videoBuffer.length > VideoExtractor.MAX_BUFFER_SIZE)
            this.videoBuffer = this.videoBuffer.subarray(this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE);
        return true;
    }
    processW42Nal(nalData, width, height, _frameOrder, isHeaderIntra) {
        if (nalData.length < 5)
            return;
        const starts = this.findStartCodes(nalData);
        if (starts.length === 0)
            return;
        let isIDR = isHeaderIntra;
        let containsPicture = false;
        let codec = this.detectedCodec === 'h264' ? 'h264' : 'h265';
        starts.forEach((start, i) => {
            const end = i + 1 < starts.length ? starts[i + 1].start : nalData.length;
            const nal = nalData.slice(start.start, end);
            const first = nalData[start.header] & 0xff;
            const second = start.header + 1 < nalData.length ? nalData[start.header + 1] & 0xff : 0;
            const h265Type = (first >> 1) & 0x3f;
            const h264Type = first & 0x1f;
            const looksH265 = (second & 0x07) !== 0 && [0, 1, 19, 20, 21, 32, 33, 34, 39, 40].includes(h265Type);
            if (looksH265 && (h265Type >= 32 || this.detectedCodec === 'h265')) {
                codec = 'h265';
                this.detectedCodec = 'h265';
                if (h265Type === 32)
                    this.vps = nal;
                else if (h265Type === 33)
                    this.sps = nal;
                else if (h265Type === 34)
                    this.pps = nal;
                else if ([19, 20, 21].includes(h265Type)) {
                    isIDR = true;
                    containsPicture = true;
                }
                else if ([0, 1].includes(h265Type))
                    containsPicture = true;
            }
            else {
                codec = 'h264';
                if (h264Type === 7) {
                    this.sps264 = nal;
                    this.detectedCodec = 'h264';
                }
                else if (h264Type === 8) {
                    this.pps264 = nal;
                    this.detectedCodec = 'h264';
                }
                else if (h264Type === 5) {
                    isIDR = true;
                    containsPicture = true;
                    this.detectedCodec = 'h264';
                }
                else if (h264Type === 1) {
                    containsPicture = true;
                    this.detectedCodec = 'h264';
                }
            }
        });
        if (!containsPicture)
            return;
        let finalData = nalData;
        if (isIDR) {
            const init = this.getStreamInitBytes(codec);
            if (init.length > 0)
                finalData = this.concat(init, nalData);
        }
        this.emitFrame(finalData, width || this.currentWidth, height || this.currentHeight, isIDR, codec);
    }
    emitFrame(data, width, height, isKeyFrame, codec) {
        this.framesExtracted++;
        this.lastFrameTime = Date.now();
        this.lastWidth = width;
        this.lastHeight = height;
        if (isKeyFrame)
            this.iFrames++;
        else
            this.pFrames++;
        const frame = { data, width, height, isKeyFrame, codec, timestamp: Date.now(), seq: this.frameSeq++ };
        for (const listener of this.listeners) {
            try {
                listener(frame);
            }
            catch (e) {
                console.error('[VideoExtractor] Listener error:', e);
            }
        }
    }
    findStartCodes(data) {
        const out = [];
        for (let i = 0; i + 3 < data.length;) {
            if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) {
                out.push({ start: i, header: i + 3 });
                i += 3;
            }
            else if (i + 4 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) {
                out.push({ start: i, header: i + 4 });
                i += 4;
            }
            else
                i++;
        }
        return out;
    }
    concat(...parts) {
        const len = parts.reduce((sum, p) => sum + p.length, 0);
        const out = new Uint8Array(len);
        let offset = 0;
        parts.forEach(p => { out.set(p, offset); offset += p.length; });
        return out;
    }
}
Object.defineProperty(VideoExtractor, "instance", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: null
});
Object.defineProperty(VideoExtractor, "VIDEO_MAGIC", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: new Uint8Array([0xcc, 0xbb, 0xaa, 0xff])
});
Object.defineProperty(VideoExtractor, "FE_HEADER_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 16
});
Object.defineProperty(VideoExtractor, "VIDEO_HEADER_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 24
});
Object.defineProperty(VideoExtractor, "MAX_BUFFER_SIZE", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: 2000000
});
Object.defineProperty(VideoExtractor, "FALLBACK_VPS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ByteUtils.hexToBytes('0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8')
});
Object.defineProperty(VideoExtractor, "FALLBACK_SPS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ByteUtils.hexToBytes('00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10')
});
Object.defineProperty(VideoExtractor, "FALLBACK_PPS", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: ByteUtils.hexToBytes('000000014401c0f28e783b34')
});
