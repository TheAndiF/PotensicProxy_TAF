/**
 * FF FD Inner Command Framing
 *
 * Structure:
 * 0: 0xFF
 * 1: 0xFD
 * 2-3: Content length (Little-Endian uint16)
 * 4-5: Command short (Little-Endian uint16)
 * 6: [Optional cmd byte]
 * 6/7+: Data bytes
 * Last: XOR Checksum over bytes [2 .. total-1]
 */
import { Checksum } from '../utils/Checksum'

export class FfFdCommand {
  /**
   * Build inner command with 1-byte command (e.g. camera commands)
   */
  static buildWithCmdByte(cmdByte: number, data: Uint8Array | null = null, cmdShort: number = 0x1200): Uint8Array {
    const dataLen = data ? data.length : 0
    const totalLen = 8 + dataLen
    const contentLen = 2 + 1 + dataLen + 1 // short(2) + cmd(1) + data + checksum(1)

    const packet = new Uint8Array(totalLen)
    const view = new DataView(packet.buffer)

    packet[0] = 0xFF
    packet[1] = 0xFD
    view.setUint16(2, contentLen, true) // Little-Endian
    view.setUint16(4, cmdShort, true)   // Little-Endian
    packet[6] = cmdByte & 0xFF
    if (data) {
      packet.set(data, 7)
    }

    packet[totalLen - 1] = Checksum.xor(packet, 2, totalLen - 1)
    return packet
  }

  /**
   * Build inner command with custom short and NO cmd byte (e.g. flight commands)
   */
  static buildWithShort(cmdShort: number, data: Uint8Array | null = null): Uint8Array {
    const dataLen = data ? data.length : 0
    const totalLen = 7 + dataLen
    const contentLen = 2 + dataLen + 1 // short(2) + data + checksum(1)

    const packet = new Uint8Array(totalLen)
    const view = new DataView(packet.buffer)

    packet[0] = 0xFF
    packet[1] = 0xFD
    view.setUint16(2, contentLen, true)
    view.setUint16(4, cmdShort, true)
    if (data) {
      packet.set(data, 6)
    }

    packet[totalLen - 1] = Checksum.xor(packet, 2, totalLen - 1)
    return packet
  }
}
