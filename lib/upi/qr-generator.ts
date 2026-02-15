/**
 * UPI QR Code Generator
 *
 * Generates a UPI payment QR code as a base64 SVG data URI.
 * Follows the UPI Deep Link specification:
 *   upi://pay?pa={VPA}&pn={PayeeName}&am={Amount}&cu={Currency}&tn={Note}
 *
 * Uses a pure-JS QR code encoder (no external dependencies).
 */

// ─── UPI URI Builder ─────────────────────────────────────────────────────────

export interface UpiQrParams {
  /** UPI VPA / ID (e.g. merchant@upi) */
  vpa: string
  /** Payee display name */
  payeeName?: string
  /** Transaction amount */
  amount?: number
  /** Currency code (default INR) */
  currency?: string
  /** Transaction note */
  note?: string
  /** Merchant category code */
  mcc?: string
  /** Transaction reference ID */
  txnRefId?: string
}

export function buildUpiUri(params: UpiQrParams): string {
  const parts = [`upi://pay?pa=${encodeURIComponent(params.vpa)}`]
  if (params.payeeName) parts.push(`pn=${encodeURIComponent(params.payeeName)}`)
  if (params.amount && params.amount > 0) parts.push(`am=${params.amount.toFixed(2)}`)
  parts.push(`cu=${params.currency ?? 'INR'}`)
  if (params.note) parts.push(`tn=${encodeURIComponent(params.note)}`)
  if (params.mcc) parts.push(`mc=${params.mcc}`)
  if (params.txnRefId) parts.push(`tr=${encodeURIComponent(params.txnRefId)}`)
  return parts.join('&')
}

// ─── Minimal QR Code Encoder ─────────────────────────────────────────────────
// Numeric mode QR for short strings, byte mode for general UPI URIs.
// Produces a boolean matrix; we then render to SVG.

// Reed-Solomon and QR math tables
const EXP_TABLE: number[] = new Array(256)
const LOG_TABLE: number[] = new Array(256)

;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 256; i++) {
    EXP_TABLE[i] = x
    LOG_TABLE[x] = i
    x = x * 2
    if (x >= 256) x ^= 0x11d
  }
})()

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP_TABLE[(LOG_TABLE[a] + LOG_TABLE[b]) % 255]
}

function rsGenPoly(ecLen: number): number[] {
  let poly = [1]
  for (let i = 0; i < ecLen; i++) {
    const newPoly = new Array(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      newPoly[j] ^= poly[j]
      newPoly[j + 1] ^= gfMul(poly[j], EXP_TABLE[i])
    }
    poly = newPoly
  }
  return poly
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGenPoly(ecLen)
  const msg = [...data, ...new Array(ecLen).fill(0)]
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef)
      }
    }
  }
  return msg.slice(data.length)
}

// QR version configs for byte mode, EC level M
// [version, totalCodewords, ecCodewordsPerBlock, group1Blocks, group1DataCw, group2Blocks, group2DataCw]
const VERSION_TABLE: [number, number, number, number, number, number, number][] = [
  [1, 16, 10, 1, 16, 0, 0],
  [2, 28, 16, 1, 28, 0, 0],
  [3, 44, 26, 1, 44, 0, 0],
  [4, 64, 18, 2, 32, 0, 0],
  [5, 86, 24, 2, 43, 0, 0],
  [6, 108, 16, 4, 27, 0, 0],
  [7, 124, 18, 4, 31, 0, 0],
  [8, 152, 22, 2, 38, 2, 38],
  [9, 180, 22, 3, 36, 2, 36],
  [10, 216, 26, 4, 43, 1, 43],
]

function pickVersion(dataLen: number): { version: number; totalDcw: number; ecCwPerBlock: number; blocks: [number, number][] } {
  for (const [ver, totalCw, ecPerBlock, g1b, g1d, g2b, g2d] of VERSION_TABLE) {
    const blocks: [number, number][] = []
    for (let i = 0; i < g1b; i++) blocks.push([g1d, ecPerBlock])
    for (let i = 0; i < g2b; i++) blocks.push([g2d, ecPerBlock])
    const totalDataCw = blocks.reduce((s, b) => s + b[0], 0)
    // Byte mode overhead: 4 (mode) + 8 or 16 (count) + data*8
    const countBits = ver <= 9 ? 8 : 16
    const totalBits = 4 + countBits + dataLen * 8
    const totalDataBits = totalDataCw * 8
    if (totalBits <= totalDataBits) {
      return { version: ver, totalDcw: totalCw, ecCwPerBlock: ecPerBlock, blocks }
    }
  }
  // Fallback to version 10
  const entry = VERSION_TABLE[9]
  const blocks: [number, number][] = []
  for (let i = 0; i < entry[3]; i++) blocks.push([entry[4], entry[2]])
  for (let i = 0; i < entry[5]; i++) blocks.push([entry[6], entry[2]])
  return { version: entry[0], totalDcw: entry[1], ecCwPerBlock: entry[2], blocks }
}

function encodeDataByte(data: string, version: number, blocks: [number, number][]): { dataBlocks: number[][]; ecBlocks: number[][] } {
  const totalDataCw = blocks.reduce((s, b) => s + b[0], 0)
  const countBits = version <= 9 ? 8 : 16

  // Build bit stream
  let bits = ''
  bits += '0100' // Byte mode indicator
  bits += data.length.toString(2).padStart(countBits, '0')
  for (let i = 0; i < data.length; i++) {
    bits += data.charCodeAt(i).toString(2).padStart(8, '0')
  }
  // Terminator
  const capacity = totalDataCw * 8
  const termLen = Math.min(4, capacity - bits.length)
  bits += '0'.repeat(termLen)
  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits += '0'
  // Pad bytes
  const padBytes = [0xec, 0x11]
  let padIdx = 0
  while (bits.length < capacity) {
    bits += padBytes[padIdx % 2].toString(2).padStart(8, '0')
    padIdx++
  }

  // Split into codewords
  const codewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(parseInt(bits.slice(i, i + 8), 2))
  }

  // Split into data blocks and compute EC for each
  const dataBlocks: number[][] = []
  const ecBlocks: number[][] = []
  let offset = 0
  for (const [dcw, ecCw] of blocks) {
    const block = codewords.slice(offset, offset + dcw)
    dataBlocks.push(block)
    ecBlocks.push(rsEncode(block, ecCw))
    offset += dcw
  }

  return { dataBlocks, ecBlocks }
}

function interleave(dataBlocks: number[][], ecBlocks: number[][]): number[] {
  const result: number[] = []
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length))
  for (let i = 0; i < maxDataLen; i++) {
    for (const block of dataBlocks) {
      if (i < block.length) result.push(block[i])
    }
  }
  const maxEcLen = Math.max(...ecBlocks.map((b) => b.length))
  for (let i = 0; i < maxEcLen; i++) {
    for (const block of ecBlocks) {
      if (i < block.length) result.push(block[i])
    }
  }
  return result
}

// Alignment pattern positions per version
const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 52],
}

function createMatrix(version: number): { matrix: (number | null)[][]; size: number } {
  const size = version * 4 + 17
  const matrix: (number | null)[][] = Array.from({ length: size }, () => new Array(size).fill(null))

  // Finder patterns (7x7 at corners)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r, mc = col + c
        if (mr < 0 || mr >= size || mc < 0 || mc >= size) continue
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          matrix[mr][mc] = 0 // separator
        } else if ((r === 0 || r === 6) || (c === 0 || c === 6) || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[mr][mc] = 1
        } else {
          matrix[mr][mc] = 0
        }
      }
    }
  }
  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0 ? 1 : 0
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0 ? 1 : 0
  }

  // Dark module
  matrix[size - 8][8] = 1

  // Alignment patterns
  if (version >= 2 && ALIGNMENT_POSITIONS[version]) {
    const positions = ALIGNMENT_POSITIONS[version]
    for (const row of positions) {
      for (const col of positions) {
        if (matrix[row][col] !== null) continue // Skip if overlaps finder
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const val = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0
            matrix[row + r][col + c] = val
          }
        }
      }
    }
  }

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (matrix[8][i] === null) matrix[8][i] = 0
    if (matrix[i][8] === null) matrix[i][8] = 0
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = 0
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = 0
  }
  if (matrix[8][8] === null) matrix[8][8] = 0

  return { matrix, size }
}

function placeData(matrix: (number | null)[][], size: number, data: number[]) {
  // Convert to bit stream
  let bits = ''
  for (const byte of data) bits += byte.toString(2).padStart(8, '0')

  let bitIdx = 0
  let upward = true
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col = 5 // Skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i)
    for (const row of rows) {
      for (let c = 0; c < 2; c++) {
        const cc = col - c
        if (matrix[row][cc] !== null) continue
        matrix[row][cc] = bitIdx < bits.length ? parseInt(bits[bitIdx], 10) : 0
        bitIdx++
      }
    }
    upward = !upward
  }
}

function applyMask(matrix: (number | null)[][], size: number): number[][] {
  // Use mask pattern 0: (row + col) % 2 === 0
  const result: number[][] = Array.from({ length: size }, () => new Array(size).fill(0))
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const val = matrix[r][c] ?? 0
      // Only mask data/EC modules (those that were null in the pattern)
      result[r][c] = val
    }
  }

  // Simple mask 0
  const maskFn = (r: number, c: number) => (r + c) % 2 === 0

  // Re-create to know which are data modules
  const templateMatrix = createMatrix(Math.floor((size - 17) / 4))
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (templateMatrix.matrix[r][c] === null && maskFn(r, c)) {
        result[r][c] ^= 1
      }
    }
  }

  // Apply format info for mask 0, EC level M
  // Pre-computed format bits for EC M, mask 0 = 101010000010010
  const formatBits = '101010000010010'
  // Horizontal: bits 0-7 around top-left finder
  const hPositions = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
  ]
  const vPositions = [
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ]
  for (let i = 0; i < 8; i++) {
    const [r, c] = hPositions[i]
    result[r][c] = parseInt(formatBits[i], 10)
  }
  for (let i = 0; i < 7; i++) {
    const [r, c] = vPositions[i]
    result[r][c] = parseInt(formatBits[14 - i], 10)
  }
  // Right side
  for (let i = 0; i < 7; i++) {
    result[8][size - 1 - i] = parseInt(formatBits[i], 10)
  }
  // Bottom side
  for (let i = 0; i < 8; i++) {
    result[size - 8 + i][8] = parseInt(formatBits[14 - i], 10) ?? 0
  }

  return result
}

function generateQrMatrix(data: string): number[][] {
  const { version, blocks } = pickVersion(data.length)
  const { dataBlocks, ecBlocks } = encodeDataByte(data, version, blocks)
  const interleaved = interleave(dataBlocks, ecBlocks)
  const { matrix, size } = createMatrix(version)
  placeData(matrix, size, interleaved)
  return applyMask(matrix, size)
}

// ─── SVG Renderer ────────────────────────────────────────────────────────────

function qrToSvg(matrix: number[][], moduleSize: number = 4, quietZone: number = 4): string {
  const size = matrix.length
  const fullSize = (size + quietZone * 2) * moduleSize
  let paths = ''

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x = (c + quietZone) * moduleSize
        const y = (r + quietZone) * moduleSize
        paths += `M${x},${y}h${moduleSize}v${moduleSize}h-${moduleSize}z`
      }
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${fullSize}" height="${fullSize}">`,
    `<rect width="${fullSize}" height="${fullSize}" fill="white"/>`,
    `<path d="${paths}" fill="black"/>`,
    `</svg>`,
  ].join('')
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Generate a UPI QR code as a base64-encoded SVG data URI.
 */
export function generateUpiQrCode(params: UpiQrParams): string {
  const uri = buildUpiUri(params)
  const matrix = generateQrMatrix(uri)
  const svg = qrToSvg(matrix)

  // Convert to base64 data URI
  if (typeof window !== 'undefined') {
    return `data:image/svg+xml;base64,${btoa(svg)}`
  }
  // SSR fallback
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

/**
 * Validate a UPI ID (VPA) format.
 * Format: <username>@<handle>
 * - Username: alphanumeric, dots, hyphens (1-50 chars)
 * - Handle: alphanumeric (1-50 chars)
 */
export function validateUpiId(upiId: string): { valid: boolean; message?: string } {
  if (!upiId || upiId.trim() === '') {
    return { valid: false, message: 'UPI ID is required' }
  }
  const trimmed = upiId.trim()

  // Must contain exactly one @
  const atCount = (trimmed.match(/@/g) || []).length
  if (atCount !== 1) {
    return { valid: false, message: 'UPI ID must contain exactly one @ symbol (e.g. name@upi)' }
  }

  // Regex: username@handle
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,49}@[a-zA-Z][a-zA-Z0-9]{0,49}$/
  if (!regex.test(trimmed)) {
    return { valid: false, message: 'Invalid UPI ID format. Expected: username@handle (e.g. merchant@upi, john.doe@oksbi)' }
  }

  return { valid: true }
}
