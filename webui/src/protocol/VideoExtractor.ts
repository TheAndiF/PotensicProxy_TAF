/**
 * Video extractor for Potensic ATOM / ATOM 2 FE 0x06 streams.
 *
 * ATOM:   3-byte per-FE transport prefix -> H.264 Annex-B access units.
 * ATOM 2: w42 transport (CC BB AA FF) -> H.264/H.265 payloads.
 */
import { ByteUtils } from '../utils/ByteUtils'

export type DroneModel = 'ATOM' | 'ATOM_2'

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

  static readonly FALLBACK_VPS = ByteUtils.hexToBytes(
    '0000000140010c01ffff016000000300a0000003000003007bac0c00011940001a5e02a8'
  )
  static readonly FALLBACK_SPS = ByteUtils.hexToBytes(
    '00000001420101016000000300a0000003000003007ba003c08010e58d2ee452fcd404040410000465000069780a10'
  )
  static readonly FALLBACK_PPS = ByteUtils.hexToBytes('000000014401c0f28e783b34')

  private droneModel: DroneModel = 'ATOM'
  private videoBuffer: Uint8Array = new Uint8Array(0)
  private atomFrameBuffer: Uint8Array = new Uint8Array(0)
  private atomFrameIsKey = false
  private frameSeq = 0

  private vps: Uint8Array | null = null
  private sps: Uint8Array | null = null
  private pps: Uint8Array | null = null
  private sps264: Uint8Array | null = null
  private pps264: Uint8Array | null = null

  public detectedCodec: 'h264' | 'h265' | 'unknown' = 'h264'
  public currentWidth = 1280
  public currentHeight = 720

  public packetsFed = 0
  public videoChunksParsed = 0
  public framesExtracted = 0
  public iFrames = 0
  public pFrames = 0
  public lastFrameTime = 0
  public lastWidth = 0
  public lastHeight = 0

  private listeners: ((frame: ExtractedVideoFrame) => void)[] = []

  static getInstance(): VideoExtractor {
    if (!this.instance) this.instance = new VideoExtractor()
    return this.instance
  }

  setDroneModel(model: string) {
    const normalized: DroneModel = model === 'ATOM_2' ? 'ATOM_2' : 'ATOM'
    if (this.droneModel === normalized) return
    this.droneModel = normalized
    this.currentWidth = normalized === 'ATOM' ? 1280 : 1920
    this.currentHeight = normalized === 'ATOM' ? 720 : 1080
    this.detectedCodec = normalized === 'ATOM' ? 'h264' : 'unknown'
    this.reset()
    console.info(`[VideoExtractor] Drone model=${normalized}`)
  }

  getDroneModel(): DroneModel { return this.droneModel }

  onFrame(listener: (frame: ExtractedVideoFrame) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const idx = this.listeners.indexOf(listener)
      if (idx >= 0) this.listeners.splice(idx, 1)
    }
  }

  getStreamInitBytes(codec: 'h264' | 'h265' = this.detectedCodec === 'h264' ? 'h264' : 'h265'): Uint8Array {
    if (codec === 'h264') {
      const s = this.sps264 || new Uint8Array(0)
      const p = this.pps264 || new Uint8Array(0)
      return this.concat(s, p)
    }
    const v = this.vps || VideoExtractor.FALLBACK_VPS
    const s = this.sps || VideoExtractor.FALLBACK_SPS
    const p = this.pps || VideoExtractor.FALLBACK_PPS
    return this.concat(v, s, p)
  }

  reset() {
    this.videoBuffer = new Uint8Array(0)
    this.atomFrameBuffer = new Uint8Array(0)
    this.atomFrameIsKey = false
    this.vps = null; this.sps = null; this.pps = null; this.sps264 = null; this.pps264 = null
    this.frameSeq = 0
  }

  feed(data: Uint8Array): boolean {
    if (!data || data.length === 0) return false
    this.packetsFed++

    let payload = data
    if (
      data.length >= VideoExtractor.FE_HEADER_SIZE && data[0] === 0xfe && data[1] === 0x00 &&
      data[2] === 0x00 && data[3] === 0x00 && data[4] === 0x00 && data[5] === 0x00 && data[7] === 0x06
    ) {
      const plen = ((data[12] & 0xff) << 24) | ((data[13] & 0xff) << 16) | ((data[14] & 0xff) << 8) | (data[15] & 0xff)
      const available = data.length - VideoExtractor.FE_HEADER_SIZE
      const copyLen = plen > 0 && plen <= available ? plen : available
      payload = data.subarray(VideoExtractor.FE_HEADER_SIZE, VideoExtractor.FE_HEADER_SIZE + copyLen)
    }

    if (this.droneModel === 'ATOM') return this.feedAtom(payload)
    return this.feedW42(payload)
  }

  /** Real ATOM capture: [seq][flags][class] then H.264 Annex-B fragment. */
  private feedAtom(payload: Uint8Array): boolean {
    if (payload.length <= 3) return true
    const flags = payload[1] & 0xff
    const frameClass = payload[2] & 0xff
    const start = (flags & 0x08) !== 0
    const end = (flags & 0x04) !== 0
    const keyHint = (flags & 0x01) !== 0 || frameClass === 0x05
    const fragment = payload.subarray(3)

    if (start) {
      this.atomFrameBuffer = fragment.slice()
      this.atomFrameIsKey = keyHint
    } else if (this.atomFrameBuffer.length > 0) {
      this.atomFrameBuffer = this.concat(this.atomFrameBuffer, fragment)
      this.atomFrameIsKey = this.atomFrameIsKey || keyHint
    } else {
      return true
    }

    if (this.atomFrameBuffer.length > VideoExtractor.MAX_BUFFER_SIZE) {
      this.atomFrameBuffer = new Uint8Array(0)
      this.atomFrameIsKey = false
      return true
    }

    if (end) {
      const frame = this.atomFrameBuffer
      const isKey = this.atomFrameIsKey
      this.atomFrameBuffer = new Uint8Array(0)
      this.atomFrameIsKey = false
      this.videoChunksParsed++
      this.processAtomAccessUnit(frame, isKey)
    }
    return true
  }

  private processAtomAccessUnit(data: Uint8Array, keyHint: boolean) {
    if (data.length < 5) return
    const starts = this.findStartCodes(data)
    let containsPicture = false
    let isIDR = keyHint
    let containsSps = false
    let containsPps = false

    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].start : data.length
      if (start.header >= data.length || end <= start.start) return
      const nal = data.slice(start.start, end)
      const type = data[start.header] & 0x1f
      if (type === 7) { this.sps264 = nal; containsSps = true }
      else if (type === 8) { this.pps264 = nal; containsPps = true }
      else if (type === 5) { isIDR = true; containsPicture = true }
      else if (type === 1) containsPicture = true
    })

    if (!containsPicture) return
    this.detectedCodec = 'h264'
    let finalData = data
    if (isIDR && !(containsSps && containsPps) && this.sps264 && this.pps264) {
      finalData = this.concat(this.sps264, this.pps264, data)
    }
    this.emitFrame(finalData, 1280, 720, isIDR, 'h264')
  }

  private feedW42(payload: Uint8Array): boolean {
    if (payload.length === 0) return true
    this.videoBuffer = this.concat(this.videoBuffer, payload)
    let k = 0
    const limit = this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE
    let lastConsumed = 0

    while (k <= limit) {
      if (this.videoBuffer[k] === 0xcc && this.videoBuffer[k + 1] === 0xbb && this.videoBuffer[k + 2] === 0xaa && this.videoBuffer[k + 3] === 0xff) {
        const w = (this.videoBuffer[k + 4] & 0xff) | ((this.videoBuffer[k + 5] & 0xff) << 8)
        const h = (this.videoBuffer[k + 6] & 0xff) | ((this.videoBuffer[k + 7] & 0xff) << 8)
        const frameOrder = (this.videoBuffer[k + 8] & 0xff) | ((this.videoBuffer[k + 9] & 0xff) << 8)
        const dataType = this.videoBuffer[k + 10] & 0xff
        const refreshType = this.videoBuffer[k + 11] & 0xff
        const payloadLen = (this.videoBuffer[k + 12] & 0xff) | ((this.videoBuffer[k + 13] & 0xff) << 8) |
          ((this.videoBuffer[k + 14] & 0xff) << 16) | ((this.videoBuffer[k + 15] & 0xff) << 24)
        const realPayloadLen = (this.videoBuffer[k + 16] & 0xff) | ((this.videoBuffer[k + 17] & 0xff) << 8) |
          ((this.videoBuffer[k + 18] & 0xff) << 16) | ((this.videoBuffer[k + 19] & 0xff) << 24)
        if (payloadLen < 0 || payloadLen > 1_000_000 || realPayloadLen < 0 || realPayloadLen > payloadLen) { k++; continue }
        const totalChunkLen = VideoExtractor.VIDEO_HEADER_SIZE + payloadLen
        if (k + totalChunkLen > this.videoBuffer.length) { lastConsumed = k; break }
        this.videoChunksParsed++
        if (w > 0 && h > 0) { this.currentWidth = w; this.currentHeight = h }
        if (dataType === 0 && realPayloadLen > 4) {
          const nalData = this.videoBuffer.subarray(k + VideoExtractor.VIDEO_HEADER_SIZE, k + VideoExtractor.VIDEO_HEADER_SIZE + realPayloadLen)
          this.processW42Nal(nalData, w, h, frameOrder, refreshType === 0)
        }
        k += totalChunkLen
        lastConsumed = k
      } else k++
    }

    if (lastConsumed > 0) this.videoBuffer = this.videoBuffer.subarray(lastConsumed)
    else if (this.videoBuffer.length > VideoExtractor.MAX_BUFFER_SIZE) this.videoBuffer = this.videoBuffer.subarray(this.videoBuffer.length - VideoExtractor.VIDEO_HEADER_SIZE)
    return true
  }

  private processW42Nal(nalData: Uint8Array, width: number, height: number, _frameOrder: number, isHeaderIntra: boolean) {
    if (nalData.length < 5) return
    const starts = this.findStartCodes(nalData)
    if (starts.length === 0) return
    let isIDR = isHeaderIntra
    let containsPicture = false
    let codec: 'h264' | 'h265' = this.detectedCodec === 'h264' ? 'h264' : 'h265'

    starts.forEach((start, i) => {
      const end = i + 1 < starts.length ? starts[i + 1].start : nalData.length
      const nal = nalData.slice(start.start, end)
      const first = nalData[start.header] & 0xff
      const second = start.header + 1 < nalData.length ? nalData[start.header + 1] & 0xff : 0
      const h265Type = (first >> 1) & 0x3f
      const h264Type = first & 0x1f
      const looksH265 = (second & 0x07) !== 0 && [0,1,19,20,21,32,33,34,39,40].includes(h265Type)
      if (looksH265 && (h265Type >= 32 || this.detectedCodec === 'h265')) {
        codec = 'h265'; this.detectedCodec = 'h265'
        if (h265Type === 32) this.vps = nal
        else if (h265Type === 33) this.sps = nal
        else if (h265Type === 34) this.pps = nal
        else if ([19,20,21].includes(h265Type)) { isIDR = true; containsPicture = true }
        else if ([0,1].includes(h265Type)) containsPicture = true
      } else {
        codec = 'h264'
        if (h264Type === 7) { this.sps264 = nal; this.detectedCodec = 'h264' }
        else if (h264Type === 8) { this.pps264 = nal; this.detectedCodec = 'h264' }
        else if (h264Type === 5) { isIDR = true; containsPicture = true; this.detectedCodec = 'h264' }
        else if (h264Type === 1) { containsPicture = true; this.detectedCodec = 'h264' }
      }
    })

    if (!containsPicture) return
    let finalData = nalData
    if (isIDR) {
      const init = this.getStreamInitBytes(codec)
      if (init.length > 0) finalData = this.concat(init, nalData)
    }
    this.emitFrame(finalData, width || this.currentWidth, height || this.currentHeight, isIDR, codec)
  }

  private emitFrame(data: Uint8Array, width: number, height: number, isKeyFrame: boolean, codec: 'h264' | 'h265') {
    this.framesExtracted++
    this.lastFrameTime = Date.now()
    this.lastWidth = width
    this.lastHeight = height
    if (isKeyFrame) this.iFrames++; else this.pFrames++
    const frame: ExtractedVideoFrame = { data, width, height, isKeyFrame, codec, timestamp: Date.now(), seq: this.frameSeq++ }
    for (const listener of this.listeners) {
      try { listener(frame) } catch (e) { console.error('[VideoExtractor] Listener error:', e) }
    }
  }

  private findStartCodes(data: Uint8Array): {start:number, header:number}[] {
    const out: {start:number, header:number}[] = []
    for (let i = 0; i + 3 < data.length;) {
      if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 1) { out.push({start:i, header:i+3}); i += 3 }
      else if (i + 4 < data.length && data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0 && data[i + 3] === 1) { out.push({start:i, header:i+4}); i += 4 }
      else i++
    }
    return out
  }

  private concat(...parts: Uint8Array[]): Uint8Array {
    const len = parts.reduce((sum, p) => sum + p.length, 0)
    const out = new Uint8Array(len)
    let offset = 0
    parts.forEach(p => { out.set(p, offset); offset += p.length })
    return out
  }
}
