/**
 * Byte and Hex String Manipulation Utilities
 */

export class ByteUtils {
  static hexToBytes(hex: string): Uint8Array {
    const clean = hex.replace(/[\s\r\n]/g, '')
    const bytes = new Uint8Array(Math.floor(clean.length / 2))
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  static formatHex(hex: string): string {
    return (hex || '').match(/.{1,2}/g)?.join(' ') || hex
  }

  static formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(1) + ' ' + sizes[i]
  }
}
