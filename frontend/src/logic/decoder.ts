/**
 * Port of the 8x8 block-based decoding logic from C++ to TypeScript.
 * This extracts bits from frame pixel data using DCT-based projections.
 */

const PI_F = Math.PI;
const BITS_PER_BLOCK = 1;

const EMBED_POSITIONS = [
    { u: 0, v: 1 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 2 },
];

function alpha_f(u: number): number {
    return u === 0 ? 0.70710678118654752 : 1.0;
}

const cosineTable: number[][] = [];
for (let i = 0; i < 8; i++) {
    cosineTable[i] = [];
    for (let j = 0; j < 8; j++) {
        cosineTable[i][j] = Math.cos(((2.0 * i + 1.0) * j * PI_F) / 16.0);
    }
}

const embedBasis: number[][][] = []; // [bit][y][x]
function initDecoderBasis() {
    for (let b = 0; b < BITS_PER_BLOCK; b++) {
        const { u, v } = EMBED_POSITIONS[b];
        const scale = 0.25 * alpha_f(u) * alpha_f(v);
        embedBasis[b] = [];
        for (let y = 0; y < 8; y++) {
            embedBasis[b][y] = [];
            for (let x = 0; x < 8; x++) {
                embedBasis[b][y][x] = scale * cosineTable[y][u] * cosineTable[x][v];
            }
        }
    }
}

initDecoderBasis();

export interface DecodeConfig {
    width: number;
    height: number;
}

/**
 * Extracts raw data from a single frame's pixel data.
 * @param pixels The RGBA pixel data from a canvas (Uint8ClampedArray)
 */
export function extractDataFromFrame(pixels: Uint8ClampedArray, config: DecodeConfig): Uint8Array {
    const { width, height } = config;
    const blocksPerRow = width / 8;
    const totalBlocks = (width / 8) * (height / 8);

    // We bitpack BITS_PER_BLOCK into bytes
    const totalBytes = Math.floor((totalBlocks * BITS_PER_BLOCK) / 8);
    const data = new Uint8Array(totalBytes);

    for (let byteIdx = 0; byteIdx < totalBytes; byteIdx++) {
        let currentByte = 0;

        for (let sub = 0; sub < 8 / BITS_PER_BLOCK; sub++) {
            const blockIdx = byteIdx * (8 / BITS_PER_BLOCK) + sub;
            const blockRow = Math.floor(blockIdx / blocksPerRow);
            const blockCol = blockIdx % blocksPerRow;
            const baseX = blockCol * 8;
            const baseY = blockRow * 8;

            // Extract bits from this block
            for (let b = 0; b < BITS_PER_BLOCK; b++) {
                let dotProduct = 0;
                const basis = embedBasis[b];

                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        const pxIdx = ((baseY + y) * width + (baseX + x)) * 4;
                        // Use the Red channel (since it's grayscale, R=G=B)
                        const pixelVal = pixels[pxIdx];
                        dotProduct += pixelVal * basis[y][x];
                    }
                }

                // The DC component in encoder was (128 * ...). 
                // In C++ it subtracts 128 or uses high-pass. 
                // Simplified threshold: since basis sums to 0, dot product responds to the pattern.
                currentByte = (currentByte << 1) | (dotProduct > 0 ? 1 : 0);
            }
        }
        data[byteIdx] = currentByte;
    }

    return data;
}

/**
 * Searches for packets in the raw data stream.
 * Packets are identified by our MAGIC_ID.
 */
export function findPackets(data: Uint8Array): Uint8Array[] {
    const packets: Uint8Array[] = [];

    for (let i = 0; i < data.length - 100; i++) {
        if (data[i] === 0x4d && data[i + 1] === 0x56 && data[i + 2] === 0x59 && data[i + 3] === 0x54) {
            // Found a potential packet. 
            // In a real implementation we'd read the header and extract specific size.
            // For the web demo, we assume fixed packet size (V1 header + payload).
            // Header is 40 bytes (V1) or 44 bytes (V2). Let's peek version.
            const version = data[i + 4];
            const headerSize = version === 2 ? 44 : 40;
            const symbolSize = (data[i + 29] << 8) | data[i + 28]; // symbol_size is U16 at offset 28

            const packetSize = headerSize + symbolSize;
            if (i + packetSize <= data.length) {
                packets.push(data.slice(i, i + packetSize));
                i += packetSize - 1;
            }
        }
    }
    return packets;
}
