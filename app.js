'use strict';

const $ = (id) => document.getElementById(id);
const originalCanvas = $('originalCanvas');
const resultCanvas = $('resultCanvas');
const originalCtx = originalCanvas.getContext('2d', { willReadFrequently: true });
const resultCtx = resultCanvas.getContext('2d');
let loaded = false;
let currentName = 'imagem';
let pending = false;
const MAX_SIDE = 1600;
const DESCRIPTIONS = {
  bayer: 'Usa uma matriz Bayer 4×4 para organizar o padrão de pontos.',
  floyd: 'Distribui o erro de quantização para quatro pixels vizinhos.',
  jarvis: 'Distribui o erro de quantização para até doze pixels vizinhos.'
};
const LABELS = { bayer: 'Bayer', floyd: 'Floyd–Steinberg', jarvis: 'Jarvis–Judice–Ninke' };

function setStatus(message, ready = false) {
  $('status').textContent = message;
  $('status').classList.toggle('ready', ready);
}

function fitSize(width, height) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

function useSource(source, width, height, label) {
  const [w, h] = fitSize(width, height);
  originalCanvas.width = resultCanvas.width = w;
  originalCanvas.height = resultCanvas.height = h;
  originalCtx.clearRect(0, 0, w, h);
  originalCtx.drawImage(source, 0, 0, w, h);
  $('originalStage').classList.add('has-image');
  $('resultStage').classList.add('has-image');
  loaded = true;
  currentName = label;
  $('imageInfo').textContent = `${label} · ${w} × ${h} px` +
    (w !== width || h !== height ? ' (reduzida para processamento)' : '');
  scheduleProcess();
}

function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    setStatus('Selecione um arquivo de imagem.');
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setStatus('Arquivo acima de 20 MB. Use uma imagem menor.');
    return;
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    useSource(img, img.naturalWidth, img.naturalHeight, file.name.replace(/\.[^.]+$/, ''));
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('Não foi possível abrir a imagem.');
  };
  img.src = url;
}

function makeExample() {
  const sample = document.createElement('canvas');
  sample.width = 960;
  sample.height = 720;
  const c = sample.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, '#1d4669'); g.addColorStop(.52, '#f9aa79'); g.addColorStop(1, '#f6deae');
  c.fillStyle = g;
  c.fillRect(0, 0, 960, 720);
  c.fillStyle = '#ffe8ae'; c.beginPath(); c.arc(694, 266, 115, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#75848b';
  c.beginPath(); c.moveTo(0, 475); c.lineTo(180, 340); c.lineTo(367, 473); c.lineTo(546, 400); c.lineTo(960, 540); c.lineTo(960, 720); c.lineTo(0, 720); c.fill();
  c.fillStyle = '#355866';
  c.beginPath(); c.moveTo(0, 545); c.lineTo(270, 438); c.lineTo(490, 542); c.lineTo(790, 462); c.lineTo(960, 549); c.lineTo(960, 720); c.lineTo(0, 720); c.fill();
  c.fillStyle = '#16343e';
  c.beginPath(); c.moveTo(0, 617); c.bezierCurveTo(240, 560, 550, 640, 960, 580); c.lineTo(960, 720); c.lineTo(0, 720); c.fill();
  c.fillRect(130, 355, 20, 300);
  for (const [cx, cy, r] of [[150, 358, 85], [98, 405, 70], [195, 395, 65], [133, 300, 62]]) {
    c.beginPath(); c.arc(cx, cy, r, 0, 2 * Math.PI); c.fill();
  }
  for (let x = 355; x <= 930; x += 90) {
    c.globalAlpha = 0.28;
    c.fillStyle = '#fff8d4'; c.fillRect(x, 635 + Math.sin(x) * 7, 70, 3);
  }
  c.globalAlpha = 1;
  useSource(sample, sample.width, sample.height, 'paisagem-exemplo');
}

function processImage() {
  pending = false;
  if (!loaded) return;
  setStatus('Processando…');
  try {
    const options = {
      method: $('method').value,
      levels: Number($('levels').value),
      contrast: Number($('contrast').value),
      brightness: Number($('brightness').value)
    };
    const input = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
    const start = performance.now();
    const output = Dither.apply(input, options);
    const elapsed = performance.now() - start;
    const result = new ImageData(output.data, output.width, output.height);
    resultCtx.putImageData(result, 0, 0);
    $('metricMethod').textContent = LABELS[options.method];
    $('metricLevels').textContent = String(options.levels);
    $('metricSize').textContent = `${output.width} × ${output.height}`;
    $('metricTime').textContent = `${elapsed.toFixed(0)} ms`;
    $('downloadBtn').disabled = false;
    setStatus('✓ Pronto para baixar', true);
  } catch (error) {
    console.error(error);
    setStatus(`Erro: ${error.message}`);
  }
}

function scheduleProcess() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(processImage);
}

$('fileInput').addEventListener('change', (event) => loadFile(event.target.files[0]));
$('exampleBtn').addEventListener('click', makeExample);
$('method').addEventListener('change', () => {
  $('methodDescription').textContent = DESCRIPTIONS[$('method').value];
  scheduleProcess();
});
$('levels').addEventListener('change', scheduleProcess);
for (const id of ['contrast', 'brightness']) {
  $(id).addEventListener('input', () => {
    $(id + 'Value').textContent = $(id).value + (id === 'contrast' ? '%' : '');
    scheduleProcess();
  });
}
$('resetBtn').addEventListener('click', () => {
  $('method').value = 'floyd'; $('levels').value = '2';
  $('contrast').value = 100; $('brightness').value = 0;
  $('contrastValue').textContent = '100%'; $('brightnessValue').textContent = '0';
  $('methodDescription').textContent = DESCRIPTIONS.floyd;
  scheduleProcess();
});
$('downloadBtn').addEventListener('click', () => {
  if (!loaded) return;
  resultCanvas.toBlob((blob) => {
    if (!blob) { setStatus('Não foi possível criar o PNG.'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.download = `${currentName}-${$('method').value}-${$('levels').value}tons.png`;
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});
const dropzone = $('dropzone');
for (const type of ['dragenter', 'dragover']) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault(); dropzone.classList.add('drag-over');
  });
}
for (const type of ['dragleave', 'drop']) {
  dropzone.addEventListener(type, (event) => {
    event.preventDefault(); dropzone.classList.remove('drag-over');
  });
}
dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));
