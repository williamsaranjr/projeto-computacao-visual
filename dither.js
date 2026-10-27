/*
 * Algoritmos de dithering - Projeto 2 de Computação Visual
 * Implementação original em JavaScript puro, sem bibliotecas externas.
 */
(function (root) {
  'use strict';

  const BAYER_4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ];

  const FLOYD = [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16], [0, 1, 5 / 16], [1, 1, 1 / 16]
  ];

  const JARVIS = [
    [1, 0, 7 / 48], [2, 0, 5 / 48],
    [-2, 1, 3 / 48], [-1, 1, 5 / 48], [0, 1, 7 / 48], [1, 1, 5 / 48], [2, 1, 3 / 48],
    [-2, 2, 1 / 48], [-1, 2, 3 / 48], [0, 2, 5 / 48], [1, 2, 3 / 48], [2, 2, 1 / 48]
  ];

  function clamp(v, lo = 0, hi = 255) {
    return Math.min(hi, Math.max(lo, v));
  }

  function quantize(value, levels) {
    const step = 255 / (levels - 1);
    return Math.round(clamp(value) / step) * step;
  }

  function makeLuminance(rgba, pixels, brightness, contrast) {
    const values = new Float32Array(pixels);
    for (let i = 0; i < pixels; i++) {
      const p = i * 4;
      const alpha = rgba[p + 3] / 255;
      // Pixels transparentes são compostos sobre fundo branco.
      const r = rgba[p] * alpha + 255 * (1 - alpha);
      const g = rgba[p + 1] * alpha + 255 * (1 - alpha);
      const b = rgba[p + 2] * alpha + 255 * (1 - alpha);
      const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      values[i] = clamp((gray - 128) * contrast / 100 + 128 + brightness);
    }
    return values;
  }

  function apply(imageData, options = {}) {
    const { width, height, data } = imageData;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        !data || data.length !== width * height * 4) {
      throw new Error('A imagem informada é inválida.');
    }

    const method = options.method || 'floyd';
    const levels = Number(options.levels || 2);
    const brightness = Number(options.brightness || 0);
    const contrast = Number(options.contrast ?? 100);
    if (!['bayer', 'floyd', 'jarvis'].includes(method)) {
      throw new Error('Algoritmo desconhecido.');
    }
    if (![2, 4, 8].includes(levels)) {
      throw new Error('A quantidade de tons deve ser 2, 4 ou 8.');
    }

    const values = makeLuminance(data, width * height, brightness, contrast);
    const out = new Uint8ClampedArray(data.length);
    const kernel = method === 'floyd' ? FLOYD : method === 'jarvis' ? JARVIS : null;
    const step = 255 / (levels - 1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        let old = values[index];
        if (method === 'bayer') {
          // Deslocamento de limiar ordenado em uma matriz Bayer 4x4.
          const threshold = (BAYER_4[y % 4][x % 4] + 0.5) / 16 - 0.5;
          old += threshold * step;
        }
        const chosen = quantize(old, levels);
        const p = index * 4;
        out[p] = out[p + 1] = out[p + 2] = chosen;
        out[p + 3] = 255;

        if (kernel) {
          const error = values[index] - chosen;
          for (const [dx, dy, weight] of kernel) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              values[ny * width + nx] += error * weight;
            }
          }
        }
      }
    }
    return { data: out, width, height };
  }

  const api = { apply, BAYER_4, FLOYD, JARVIS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.Dither = api;
})(typeof window === 'undefined' ? globalThis : window);
