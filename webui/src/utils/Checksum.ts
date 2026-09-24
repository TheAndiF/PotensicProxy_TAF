/**
 * Checksum Calculations
 */

export class Checksum {
  /**
   * Calculate XOR checksum over range [start, end)
   */
  static xor(data: Uint8Array, start: number, end: number): number {
    let checksum = 0
    for (let i = start; i < end; i++) {
      checksum ^= data[i]
    }
    return checksum & 0xFF
  }
}
