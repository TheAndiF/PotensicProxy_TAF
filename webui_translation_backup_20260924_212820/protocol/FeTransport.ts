/**
 * FE Transport Layer Framing (16-byte header + payload)
 *
 * Header:
 * 0: 0xFE (Magic)
 * 1-6: Reserved 0x00
 * 7: Type (FE Type: 0x14, 0x15, etc.)
 * 8-11: Reserved 0x00
 * 12-15: Payload length (Big-Endian uint32)
 */

export class FeTransport {
  static wrap(innerPayload: Uint8Array, feType: number = 0x15): Uint8Array {
    const packet = new Uint8Array(16 + innerPayload.length)
    const view = new DataView(packet.buffer)

    packet[0] = 0xFE
    packet[7] = feType & 0xFF
    view.setUint32(12, innerPayload.length, false) // Big-Endian uint32
    packet.set(innerPayload, 16)

    return packet
  }

  static unpack(packet: Uint8Array): { feType: number; payload: Uint8Array } | null {
    if (packet.length < 16 || packet[0] !== 0xFE) {
      return null
    }

    const view = new DataView(packet.buffer, packet.byteOffset, packet.byteLength)
    const feType = packet[7]
    const payloadLen = view.getUint32(12, false)
    const payload = packet.subarray(16, 16 + payloadLen)

    return { feType, payload }
  }
}
