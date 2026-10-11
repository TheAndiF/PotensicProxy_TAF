export class WebCodecsPlayer {
    constructor() {
        Object.defineProperty(this, "decoder", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "canvas", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "ctx", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "activeCodec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ''
        });
        Object.defineProperty(this, "currentCodecType", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'h265'
        });
        Object.defineProperty(this, "isConfigured", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "hasReceivedKeyframe", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "supportedH265", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "supportedH264", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "bestH265Codec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'hev1.1.6.L120.B0'
        });
        Object.defineProperty(this, "bestH264Codec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 'avc1.640028'
        });
        Object.defineProperty(this, "stats", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {
                fps: 0,
                framesDecoded: 0,
                droppedFrames: 0,
                width: 0,
                height: 0,
                codec: 'Detecting...',
                codecType: 'none',
                latencyMs: 0
            }
        });
        Object.defineProperty(this, "frameCountInSec", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "fpsTimer", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "lastTimestamp", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: 0
        });
        Object.defineProperty(this, "onStatsCallback", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
    }
    static isSupported() {
        return typeof window !== 'undefined' && typeof window.VideoDecoder !== 'undefined';
    }
    static async probeCodecs(width = 1920, height = 1080) {
        let bestH265 = '';
        let bestH264 = '';
        if (this.isSupported()) {
            for (const codec of this.H265_CANDIDATES) {
                try {
                    const support = await window.VideoDecoder.isConfigSupported({
                        codec,
                        codedWidth: width,
                        codedHeight: height,
                        hardwareAcceleration: 'prefer-hardware'
                    });
                    if (support && support.supported) {
                        bestH265 = codec;
                        break;
                    }
                }
                catch (_) { }
            }
            for (const codec of this.H264_CANDIDATES) {
                try {
                    const support = await window.VideoDecoder.isConfigSupported({
                        codec,
                        codedWidth: width,
                        codedHeight: height,
                        hardwareAcceleration: 'prefer-hardware'
                    });
                    if (support && support.supported) {
                        bestH264 = codec;
                        break;
                    }
                }
                catch (_) { }
            }
        }
        return {
            h265: Boolean(bestH265),
            h264: Boolean(bestH264),
            bestH265: bestH265 || this.H265_CANDIDATES[0],
            bestH264: bestH264 || this.H264_CANDIDATES[0]
        };
    }
    setCanvas(canvas) {
        this.canvas = canvas;
        this.ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
    }
    onStats(callback) {
        this.onStatsCallback = callback;
    }
    async init(width = 1920, height = 1080, preferH265 = true) {
        if (!WebCodecsPlayer.isSupported()) {
            this.stats.codec = 'Current browser does not support WebCodecs hardware decode';
            this.stats.codecType = 'none';
            this.onStatsCallback?.({ ...this.stats });
            return false;
        }
        const probe = await WebCodecsPlayer.probeCodecs(width, height);
        this.supportedH265 = probe.h265;
        this.supportedH264 = probe.h264;
        this.bestH265Codec = probe.bestH265;
        this.bestH264Codec = probe.bestH264;
        // If preferred H265 is supported, use it; otherwise fallback to H264
        if (preferH265 && this.supportedH265) {
            this.currentCodecType = 'h265';
            this.activeCodec = this.bestH265Codec;
        }
        else if (this.supportedH264) {
            this.currentCodecType = 'h264';
            this.activeCodec = this.bestH264Codec;
        }
        else {
            this.currentCodecType = preferH265 ? 'h265' : 'h264';
            this.activeCodec = preferH265 ? this.bestH265Codec : this.bestH264Codec;
        }
        this.stats.codec = this.activeCodec;
        this.stats.codecType = this.currentCodecType;
        this.setupDecoder(width, height);
        // FPS ticker
        if (this.fpsTimer)
            clearInterval(this.fpsTimer);
        this.fpsTimer = setInterval(() => {
            this.stats.fps = this.frameCountInSec;
            this.frameCountInSec = 0;
            this.onStatsCallback?.({ ...this.stats });
        }, 1000);
        return true;
    }
    setupDecoder(width, height) {
        if (this.decoder) {
            try {
                this.decoder.close();
            }
            catch (_) { }
            this.decoder = null;
        }
        try {
            this.decoder = new window.VideoDecoder({
                output: (videoFrame) => {
                    this.handleVideoFrame(videoFrame);
                },
                error: (e) => {
                    console.warn('[WebCodecsPlayer] Decoder error, will re-sync on next keyframe:', e);
                    this.stats.droppedFrames++;
                    this.isConfigured = false;
                    this.hasReceivedKeyframe = false;
                    this.onStatsCallback?.({ ...this.stats });
                }
            });
            const config = {
                codec: this.activeCodec,
                codedWidth: width,
                codedHeight: height,
                optimizeForLatency: true,
                hardwareAcceleration: 'prefer-hardware'
            };
            this.decoder.configure(config);
            this.isConfigured = true;
        }
        catch (e) {
            console.error('[WebCodecsPlayer] Configure failed:', e);
            this.stats.codec = `Configuration failed: ${e.message || e}`;
            this.isConfigured = false;
            this.onStatsCallback?.({ ...this.stats });
        }
    }
    feedFrame(frame) {
        // Dynamic codec switching if frame codec differs from current decoder codec
        if (frame.codec && frame.codec !== this.currentCodecType) {
            console.log(`[WebCodecsPlayer] Switching codec: ${this.currentCodecType} -> ${frame.codec}`);
            this.currentCodecType = frame.codec;
            this.activeCodec = frame.codec === 'h265' ? this.bestH265Codec : this.bestH264Codec;
            this.stats.codec = this.activeCodec;
            this.stats.codecType = this.currentCodecType;
            this.hasReceivedKeyframe = false;
            this.setupDecoder(frame.width || 1920, frame.height || 1080);
        }
        if (!this.decoder)
            return;
        // Must start decoding from a KeyFrame (IDR)
        if (!this.hasReceivedKeyframe) {
            if (!frame.isKeyFrame) {
                return;
            }
            this.hasReceivedKeyframe = true;
        }
        // If resolution changed, reconfigure
        if ((frame.width > 0 && frame.width !== this.stats.width) ||
            (frame.height > 0 && frame.height !== this.stats.height)) {
            this.stats.width = frame.width;
            this.stats.height = frame.height;
            this.setupDecoder(frame.width, frame.height);
        }
        if (!this.isConfigured || this.decoder.state === 'closed') {
            this.setupDecoder(frame.width || 1920, frame.height || 1080);
        }
        try {
            const nowMicros = Math.floor(performance.now() * 1000);
            // Ensure strictly increasing timestamp
            const timestamp = nowMicros > this.lastTimestamp ? nowMicros : this.lastTimestamp + 1000;
            this.lastTimestamp = timestamp;
            const chunk = new window.EncodedVideoChunk({
                type: frame.isKeyFrame ? 'key' : 'delta',
                timestamp,
                data: frame.data
            });
            this.decoder.decode(chunk);
        }
        catch (e) {
            console.warn('[WebCodecsPlayer] Decode error:', e);
            this.stats.droppedFrames++;
            if (frame.isKeyFrame) {
                this.setupDecoder(frame.width || 1920, frame.height || 1080);
            }
        }
    }
    handleVideoFrame(videoFrame) {
        try {
            this.stats.framesDecoded++;
            this.frameCountInSec++;
            this.stats.width = videoFrame.displayWidth;
            this.stats.height = videoFrame.displayHeight;
            if (this.canvas && this.ctx) {
                if (this.canvas.width !== videoFrame.displayWidth ||
                    this.canvas.height !== videoFrame.displayHeight) {
                    this.canvas.width = videoFrame.displayWidth;
                    this.canvas.height = videoFrame.displayHeight;
                }
                this.ctx.drawImage(videoFrame, 0, 0, this.canvas.width, this.canvas.height);
            }
            this.onStatsCallback?.({ ...this.stats });
        }
        finally {
            // Release GPU/hardware frame resource immediately
            videoFrame.close();
        }
    }
    destroy() {
        if (this.fpsTimer) {
            clearInterval(this.fpsTimer);
            this.fpsTimer = null;
        }
        if (this.decoder) {
            try {
                this.decoder.close();
            }
            catch (_) { }
            this.decoder = null;
        }
        this.canvas = null;
        this.ctx = null;
    }
}
Object.defineProperty(WebCodecsPlayer, "H265_CANDIDATES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [
        'hev1.1.6.L120.B0',
        'hvc1.1.6.L120.B0',
        'hev1.1.6.L93.B0',
        'hvc1.1.6.L93.B0',
        'hev1.1.6.L150.B0',
        'hvc1.1.6.L150.B0'
    ]
});
Object.defineProperty(WebCodecsPlayer, "H264_CANDIDATES", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: [
        'avc1.640028', // High Profile Level 4.0 (1080p)
        'avc1.64002a', // High Profile Level 4.2
        'avc1.4d4028', // Main Profile Level 4.0
        'avc1.4d401f', // Main Profile Level 3.1
        'avc1.42e028', // Baseline Profile Level 4.0
        'avc1.42001f' // Baseline Profile Level 3.1
    ]
});
