/**
 * Video Extractor for Potensic ATOM 2 USB Stream
 *
 * Extracts H.265 (HEVC) NAL units directly from USB FE frames (feType = 0x06).
 * Ported and optimized from Android VideoExtractor.kt for high performance in TypeScript.
 */
import { ByteUtils } from '../utils/ByteUtils'

export interface ExtractedVideoFrame {
  data: Uint8Array
  width: number
  height: number
  isKeyFrame: boolean
  codec: 'h264' | 'h265'
  timestamp: number
  seq: number
}

export class VideoExtractor {
  private static instance: VideoExtractor | null = null

  static readonly VIDEO_MAGIC = new Uint8Array([0xcc, 0xbb, 0xaa, 0xff])
  static readonly FE_HEADER_SIZE = 16
  static readonly VIDEO_HEADER_SIZE = 24
  static readonly MAX_BUFFER_SIZE = 2_000_000

  // Fallback parameter sets for Potensic ATOM 2 1080P HEVC stream
  static readonly FALLBACK_VPS = ByteUtils.hexToBytes(
    '0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8'
  )
  static readonly FALLBACK_SPS = ByteUtils.hexToBytes(
    '00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10'
  )
  static readonly FALLBACK_PPS = ByteUtils.hexToBytes('000000014401c0f28e783b34')

  // Accumulating streaming buffer for video chunks (matching vf5 in nl6.d)
  private videoBuffer: Uint8Array = new Uint8Array(0)
  private frameSeq = 0

  // Cached parameter sets for H.265
  private vps: Uint8Array | null = null
  private sps: Uint8Array | null = null
  private pps: Uint8Array | null = null

  // Cached parameter sets for H.264
  private sps264: Uint8Array | null = null
  private pps264: Uint8Array | null = null

  // Detection & Dimensions
  public detectedCodec: 'h264' | 'h265' | 'unknown' = 'unknown'
  public currentWidth = 1920
  public currentHeight = 1080

  // Real-time Statistics
  public packetsFed = 0
  public videoChunksParsed = 0
  public framesExtracted = 0
  public iFrames = 0
  public pFrames = 0
  public lastFrameTime = 0
  public lastWidth = 0
  public lastHeight = 0

  // Event callbacks
  private listeners: ((frame: ExtractedVideoFrame) => void)[] = []

  static getInstance(): VideoExtractor {
    if (!this.instance) {
      this.instance = new VideoExtractor()
    }
    return this.instance
  }

  onFrame(listener: (frame: ExtractedVideoFrame) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  getStreamInitBytes(): Uint8Array {
    const v = this.vps || VideoExtractor.FALLBACK_VPS
    const s = this.sps || VideoExtractor.FALLBACK_SPS
    const p = this.pps || VideoExtractor.FALLBACK_PPS
    const total = new Uint8Array(v.length + s.length + p.length)
    total.set(v, 0)
    total.set(s, v.length)
    total.set(p, v.length + s.length)
    return total
  }

  reset() {
    this.videoBuffer = new Uint8Array(0)
    this.vps = null
    this.sps = null
    this.pps = null
    this.sps264 = null
    this.pps264 = null
    this.frameSeq = 0
  }

  /**
   * Feed incoming video data.
   * Accepts:
   * 1. Full FE frame: 0xFE, 0x00, ..., feType=0x06, [length], [video payload]
   * 2. Raw video payload stripped of FE header
   */
  feed(data: Uint8Array): boolean {
    if (!data || data.length === 0) return false
    this.packetsFed++

    let payload: Uint8Array = data

    // Check if this is an outer FE transport packet (feType = 0x06)
    if (
      data.length >= VideoExtractor.FE_HEADER_SIZE &&
      data[0] === 0xfe &&
      data[1] === 0x00 &&
      data[2] === 0x00 &&
      data[3] === 0x00 &&
      data[4] === 0x00 &&
      data[5] === 0x00 &&
      data[7] === 0x06
    ) {
      const plen =
        ((data[12] & 0xff) << 24) |
        ((data[13] & 0xff) << 16) |
        ((data[14] & 0xff) << 8) |
        (data[15] & 0xff)

      const available = data.length - VideoExtractor.FE_HEADER_SIZE
      const copyLen = plen > 0 && plen <= available ? plen : available
      payload = data.subarray(VideoExtractor.FE_HEADER_SIZE, VideoExtractor.FE_HEADER_SIZE + copyLen)
    }

    if (payload.length === 0) return true

    // Append incoming payload to accumulating video stream buffer
    const merged = new Uint8Array(this.videoBuffer.length + payload.length)
    merged.set(this.videoBuffer, 0)
    merged.set(payload, this.videoBuffer.length)
    this.videoBuffer = merged

    // Parse w42 chunks from the accumulating buffer (matching nl6.d and w42.java)
    let k = 0
    const limit = this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE
    let lastConsumed = 0

    while (k <= limit) {
      // Look for w42 Magic: 0xCC, 0xBB, 0xAA, 0xFF
      if (
        this.videoBuffer[k] === 0xcc &&
        this.videoBuffer[k + 1] === 0xbb &&
        this.videoBuffer[k + 2] === 0xaa &&
        this.videoBuffer[k + 3] === 0xff
      ) {
        const w = (this.videoBuffer[k + 4] & 0xff) | ((this.videoBuffer[k + 5] & 0xff) << 8)
        const h = (this.videoBuffer[k + 6] & 0xff) | ((this.videoBuffer[k + 7] & 0xff) << 8)
        const frameOrder = (this.videoBuffer[k + 8] & 0xff) | ((this.videoBuffer[k + 9] & 0xff) << 8)
        const dataType = this.videoBuffer[k + 10] & 0xff // 0: Video, 1: Gallery, 2: x10
        const refreshType = this.videoBuffer[k + 11] & 0xff // 0: Intra/IDR, 1: Inter/P

        const payloadLen =
          (this.videoBuffer[k + 12] & 0xff) |
          ((this.videoBuffer[k + 13] & 0xff) << 8) |
          ((this.videoBuffer[k + 14] & 0xff) << 16) |
          ((this.videoBuffer[k + 15] & 0xff) << 24)

        const realPayloadLen =
          (this.videoBuffer[k + 16] & 0xff) |
          ((this.videoBuffer[k + 17] & 0xff) << 8) |
          ((this.videoBuffer[k + 18] & 0xff) << 16) |
          ((this.videoBuffer[k + 19] & 0xff) << 24)

        // Sanity checks on header
        if (
          payloadLen < 0 ||
          payloadLen > 1_000_000 ||
          realPayloadLen < 0 ||
          realPayloadLen > payloadLen
        ) {
          k++
          continue
        }

        const totalChunkLen = VideoExtractor.VIDEO_HEADER_SIZE + payloadLen
        if (k + totalChunkLen > this.videoBuffer.length) {
          // Chunk is not yet complete in buffer — prune leading consumed data and wait for next USB packet
          lastConsumed = k
          break
        }

        this.videoChunksParsed++

        if (w > 0 && h > 0) {
          this.currentWidth = w
          this.currentHeight = h
        }

        // dataType 0 is live camera video stream
        if (dataType === 0 && realPayloadLen > 4) {
          const nalData = this.videoBuffer.subarray(
            k + VideoExtractor.VIDEO_HEADER_SIZE,
            k + VideoExtractor.VIDEO_HEADER_SIZE + realPayloadLen
          )
          this.processNalUnit(nalData, w, h, frameOrder, refreshType === 0)
        }

        k += totalChunkLen
        lastConsumed = k
      } else {
        k++
      }
    }

    // Retain unconsumed trailing bytes for next packet
    if (lastConsumed > 0) {
      this.videoBuffer = this.videoBuffer.subarray(lastConsumed)
    } else if (this.videoBuffer.length > VideoExtractor.MAX_BUFFER_SIZE) {
      // Drop oldest bytes if congested without matching magic
      this.videoBuffer = this.videoBuffer.subarray(this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE)
    }

    return true
  }

  /**
   * Process a single NAL unit extracted from a w42 chunk.
   * Matches ub2.java and VideoPacket.kt logic.
   */
  private processNalUnit(
    nalData: Uint8Array,
    width: number,
    height: number,
    frameOrder: number,
    isHeaderIntra: boolean
  ) {
    if (nalData.length < 5) return

    // Find start code offset (usually index 0: 00 00 00 01 or 00 00 01)
    let nalByteOffset = 4
    if (nalData[0] === 0 && nalData[1] === 0 && nalData[2] === 1) {
      nalByteOffset = 3
    } else if (nalData[0] === 0 && nalData[1] === 0 && nalData[2] === 0 && nalData[3] === 1) {
      nalByteOffset = 4
    } else {
      for (let i = 0; i < Math.min(16, nalData.length - 4); i++) {
        if (nalData[i] === 0 && nalData[i + 1] === 0 && nalData[i + 2] === 1) {
          nalByteOffset = i + 3
          break
        }
        if (nalData[i] === 0 && nalData[i + 1] === 0 && nalData[i + 2] === 0 && nalData[i + 3] === 1) {
          nalByteOffset = i + 4
          break
        }
      }
    }

    if (nalByteOffset >= nalData.length) return
    const nalByte = nalData[nalByteOffset]

    let isIDR = false
    let isParamSet = false
    let codec: 'h264' | 'h265' = 'h265'

    // === Check H.265 NAL types (ub2.java) ===
    const h265Type = (nalByte >> 1) & 0x3f
    if (h265Type === 32) {
      // H265 VPS (type 32, 0x40)
      this.vps = nalData
      this.detectedCodec = 'h265'
      isParamSet = true
    } else if (h265Type === 33) {
      // H265 SPS (type 33, 0x42)
      this.sps = nalData
      this.detectedCodec = 'h265'
      isParamSet = true
    } else if (h265Type === 34) {
      // H265 PPS (type 34, 0x44)
      this.pps = nalData
      this.detectedCodec = 'h265'
      isParamSet = true
    } else if (h265Type === 39 || h265Type === 40) {
      // H265 SEI
      isParamSet = true
    } else if (h265Type === 19 || h265Type === 20 || h265Type === 21) {
      // H265 IDR_W_RADL (19) or IDR_N_LP (20) or CRA (21)
      isIDR = true
      codec = 'h265'
      this.detectedCodec = 'h265'
    } else if (h265Type === 1 || h265Type === 0) {
      // H265 TRAIL_R / TRAIL_N P-frame
      isIDR = false
      codec = 'h265'
      this.detectedCodec = 'h265'
    }
    // === Check H.264 NAL types ===
    else {
      const h264Type = nalByte & 0x1f
      if (h264Type === 7) {
        // H264 SPS (type 7)
        this.sps264 = nalData
        this.detectedCodec = 'h264'
        isParamSet = true
      } else if (h264Type === 8) {
        // H264 PPS (type 8)
        this.pps264 = nalData
        this.detectedCodec = 'h264'
        isParamSet = true
      } else if (h264Type === 6) {
        // H264 SEI (type 6)
        isParamSet = true
      } else if (h264Type === 5) {
        // H264 IDR (type 5)
        isIDR = true
        codec = 'h264'
        this.detectedCodec = 'h264'
      } else if (h264Type === 1) {
        // H264 Non-IDR / P-frame (type 1)
        isIDR = false
        codec = 'h264'
        this.detectedCodec = 'h264'
      } else if (isHeaderIntra) {
        isIDR = true
      }
    }

    // Parameter sets alone do not display a picture, cache them until IDR slice
    if (isParamSet && !isIDR) {
      return
    }

    // Prepare complete frame buffer (prepend parameter sets to IDR)
    let finalData = nalData

    if (isIDR) {
      if (codec === 'h265') {
        const hasVPS =
          nalData.length > nalByteOffset + 1 &&
          nalData[nalByteOffset] === 0x40

        if (!hasVPS) {
          const init = this.getStreamInitBytes()
          finalData = new Uint8Array(init.length + nalData.length)
          finalData.set(init, 0)
          finalData.set(nalData, init.length)
        }
      } else if (codec === 'h264') {
        if (this.sps264 && this.pps264) {
          finalData = new Uint8Array(this.sps264.length + this.pps264.length + nalData.length)
          finalData.set(this.sps264, 0)
          finalData.set(this.pps264, this.sps264.length)
          finalData.set(nalData, this.sps264.length + this.pps264.length)
        }
      }
    }

    this.framesExtracted++
    this.lastFrameTime = Date.now()
    this.lastWidth = width || this.currentWidth
    this.lastHeight = height || this.currentHeight

    if (isIDR) {
      this.iFrames++
    } else {
      this.pFrames++
    }

    const frameEvent: ExtractedVideoFrame = {
      data: finalData,
      width: this.lastWidth,
      height: this.lastHeight,
      isKeyFrame: isIDR,
      codec,
      timestamp: Date.now(),
      seq: this.frameSeq++
    }

    for (const listener of this.listeners) {
      try {
        listener(frameEvent)
      } catch (e) {
        console.error('[VideoExtractor] Listener error:', e)
      }
    }
  }
}
