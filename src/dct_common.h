#pragma once

#include "configuration.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <utility>

inline constexpr float PI_F = 3.14159265358979323846f;

inline constexpr std::pair<int, int> EMBED_POSITIONS[] = {
    {0, 1},
    {1, 0},
    {1, 1},
    {0, 2},
};

struct CosineTable {
    float data[8][8];
};

inline const CosineTable &get_cosine_table() {
    static const CosineTable table = [] {
        CosineTable cosine_table{};
        for (int i = 0; i < 8; ++i) {
            for (int j = 0; j < 8; ++j) {
                cosine_table.data[i][j] = std::cos(
                    (2.0f * static_cast<float>(i) + 1.0f) * static_cast<float>(j) * PI_F / 16.0f);
            }
        }
        return cosine_table;
    }();
    return table;
}

constexpr float alpha_f(const int u) {
    return u == 0 ? 0.70710678118654752f : 1.0f;
}

struct PrecomputedBlocks {
    static constexpr int NUM_PATTERNS = 1 << BITS_PER_BLOCK;
    uint8_t patterns[NUM_PATTERNS][8][8];
};

inline const PrecomputedBlocks &get_precomputed_blocks() {
    static const PrecomputedBlocks blocks = [] {
        PrecomputedBlocks result{};
        const auto &[data] = get_cosine_table();

        constexpr float dc_value = 0.25f * alpha_f(0) * alpha_f(0) * 64.0f * 128.0f;

        float dc_image[8][8];
        for (int x = 0; x < 8; ++x) {
            for (int y = 0; y < 8; ++y) {
                dc_image[x][y] = 0.25f * alpha_f(0) * alpha_f(0) * dc_value
                                 * data[x][0] * data[y][0];
            }
        }

        float embed_basis[4][8][8]{};
        for (int b = 0; b < BITS_PER_BLOCK; ++b) {
            const auto [u, v] = EMBED_POSITIONS[b];
            const float scale = 0.25f * alpha_f(u) * alpha_f(v)
                                * static_cast<float>(COEFFICIENT_STRENGTH);
            for (int x = 0; x < 8; ++x) {
                for (int y = 0; y < 8; ++y) {
                    embed_basis[b][x][y] = scale * data[x][u] * data[y][v];
                }
            }
        }

        for (int pattern = 0; pattern < PrecomputedBlocks::NUM_PATTERNS; ++pattern) {
            for (int y = 0; y < 8; ++y) {
                for (int x = 0; x < 8; ++x) {
                    float val = dc_image[y][x];
                    for (int b = 0; b < BITS_PER_BLOCK; ++b) {
                        const int bit = (pattern >> (BITS_PER_BLOCK - 1 - b)) & 1;
                        val += (bit ? 1.0f : -1.0f) * embed_basis[b][y][x];
                    }
                    val = std::clamp(val, 0.0f, 255.0f);
                    result.patterns[pattern][y][x] = static_cast<uint8_t>(val);
                }
            }
        }

        return result;
    }();
    return blocks;
}

struct DecoderProjections {
    float vectors[4][64];
};

inline const DecoderProjections &get_decoder_projections() {
    static const DecoderProjections proj = [] {
        DecoderProjections decoder_projections{};
        const auto &[data] = get_cosine_table();
        for (int b = 0; b < BITS_PER_BLOCK; ++b) {
            const auto [u, v] = EMBED_POSITIONS[b];
            for (int x = 0; x < 8; ++x) {
                for (int y = 0; y < 8; ++y) {
                    decoder_projections.vectors[b][x * 8 + y] = data[x][u] * data[y][v];
                }
            }
        }
        return decoder_projections;
    }();
    return proj;
}
