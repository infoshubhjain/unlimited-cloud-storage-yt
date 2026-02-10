#pragma once

#include "configuration.h"

#include <cmath>
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
        for (int i = 0; i < 8; ++i)
            for (int j = 0; j < 8; ++j)
                cosine_table.data[i][j] = std::cos(
                    (2.0f * static_cast<float>(i) + 1.0f) * static_cast<float>(j) * PI_F / 16.0f);
        return cosine_table;
    }();
    return table;
}

constexpr float alpha_f(const int u) {
    return u == 0 ? 0.70710678118654752f : 1.0f;
}

struct EncoderBasisTables {
    float dc_image[8][8];
    float embed_basis[4][8][8];
};

inline const EncoderBasisTables &get_encoder_basis_tables() {
    static const EncoderBasisTables tables = [] {
        EncoderBasisTables encoder_basis_tables{};
        const auto &[data] = get_cosine_table();
        constexpr float dc_value = 0.25f * alpha_f(0) * alpha_f(0) * 64.0f * 128.0f;
        for (int x = 0; x < 8; ++x) {
            for (int y = 0; y < 8; ++y) {
                encoder_basis_tables.dc_image[x][y] = 0.25f * alpha_f(0) * alpha_f(0) * dc_value
                                                      * data[x][0] * data[y][0];
            }
        }
        for (int b = 0; b < BITS_PER_BLOCK; ++b) {
            const auto [u, v] = EMBED_POSITIONS[b];
            const float scale = 0.25f * alpha_f(u) * alpha_f(v)
                                * static_cast<float>(COEFFICIENT_STRENGTH);
            for (int x = 0; x < 8; ++x) {
                for (int y = 0; y < 8; ++y) {
                    encoder_basis_tables.embed_basis[b][x][y] = scale * data[x][u] * data[y][v];
                }
            }
        }
        return encoder_basis_tables;
    }();
    return tables;
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

inline void forward_dct_8x8(const float input[8][8], float output[8][8]) {
    const auto &[data] = get_cosine_table();
    float temp[8][8];
    for (int x = 0; x < 8; ++x) {
        for (int v = 0; v < 8; ++v) {
            float sum = 0.0f;
            for (int y = 0; y < 8; ++y) {
                sum += input[x][y] * data[y][v];
            }
            temp[x][v] = sum;
        }
    }
    for (int u = 0; u < 8; ++u) {
        const float au = alpha_f(u);
        for (int v = 0; v < 8; ++v) {
            float sum = 0.0f;
            for (int x = 0; x < 8; ++x) {
                sum += temp[x][v] * data[x][u];
            }
            output[u][v] = 0.25f * au * alpha_f(v) * sum;
        }
    }
}
