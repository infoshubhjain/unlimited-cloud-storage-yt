/**
 * Port of the 8x8 block-based encoding logic from C++ to TypeScript.
 * This handles the robust mapping of bits to pixel patterns.
 */

const PI_F = Math.PI;
const COEFFICIENT_STRENGTH = 150.0;
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

const precomputedBlocks: number[][][] = []; // [pattern][y][x]

function initPrecomputedBlocks() {
    const dc_value = 0.25 * alpha_f(0) * alpha_f(0) * 64.0 * 128.0;
    const dc_image: number[][] = [];
    for (let y = 0; y < 8; y++) {
        dc_image[y] = [];
        for (let x = 0; x < 8; x++) {
            dc_image[y][x] = 0.25 * alpha_f(0) * alpha_f(0) * dc_value * cosineTable[y][0] * cosineTable[x][0];
        }
    }

    const embed_basis: number[][][] = []; // [bit][y][x]
    for (let b = 0; b < BITS_PER_BLOCK; b++) {
        const { u, v } = EMBED_POSITIONS[b];
        const scale = 0.25 * alpha_f(u) * alpha_f(v) * COEFFICIENT_STRENGTH;
        embed_basis[b] = [];
        for (let y = 0; y < 8; y++) {
            embed_basis[b][y] = [];
            for (let x = 0; x < 8; x++) {
                embed_basis[b][y][x] = scale * cosineTable[y][u] * cosineTable[x][v];
            }
        }
    }

    const numPatterns = 1 << BITS_PER_BLOCK;
    for (let pattern = 0; pattern < numPatterns; pattern++) {
        precomputedBlocks[pattern] = [];
        for (let y = 0; y < 8; y++) {
            precomputedBlocks[pattern][y] = [];
            for (let x = 0; x < 8; x++) {
                let val = dc_image[y][x];
                for (let b = 0; b < BITS_PER_BLOCK; b++) {
                    const bit = (pattern >> (BITS_PER_BLOCK - 1 - b)) & 1;
                    val += (bit ? 1.0 : -1.0) * embed_basis[b][y][x];
                }
                precomputedBlocks[pattern][y][x] = Math.min(255, Math.max(0, Math.round(val)));
            }
        }
    }
}

initPrecomputedBlocks();

export interface FrameConfig {
    width: number;
    height: number;
}

export function encodeDataToCanvas(data: Uint8Array, canvas: HTMLCanvasElement, config: FrameConfig) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = config;
    canvas.width = width;
    canvas.height = height;

    const imageData = ctx.createImageData(width, height);
    const pixels = imageData.data;

    // Fill with mid-grey (128)
    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 128;
        pixels[i + 1] = 128;
        pixels[i + 2] = 128;
        pixels[i + 3] = 255;
    }

    const blocksPerRow = width / 8;
    const totalBits = data.length * 8;
    const activeBlocks = Math.min(
        (width / 8) * (height / 8),
        Math.ceil(totalBits / BITS_PER_BLOCK)
    );

    for (let blockIdx = 0; blockIdx < activeBlocks; blockIdx++) {
        const blockRow = Math.floor(blockIdx / blocksPerRow);
        const blockCol = blockIdx % blocksPerRow;
        const baseX = blockCol * 8;
        const baseY = blockRow * 8;

        const bitStart = blockIdx * BITS_PER_BLOCK;
        const bitEnd = Math.min(bitStart + BITS_PER_BLOCK, totalBits);

        let pattern = 0;
        for (let bitIndex = bitStart; bitIndex < bitEnd; bitIndex++) {
            const byteIdx = Math.floor(bitIndex / 8);
            const bitPos = 7 - (bitIndex % 8);
            const bit = (data[byteIdx] >> bitPos) & 1;
            pattern = (pattern << 1) | bit;
        }

        // Left shift if fewer bits extracted (though BITS_PER_BLOCK is 1)
        pattern <<= (BITS_PER_BLOCK - (bitEnd - bitStart));

        const block = precomputedBlocks[pattern];
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                const pxIdx = ((baseY + y) * width + (baseX + x)) * 4;
                const val = block[y][x];
                pixels[pxIdx] = val;
                pixels[pxIdx + 1] = val;
                pixels[pxIdx + 2] = val;
                pixels[pxIdx + 3] = 255;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}
