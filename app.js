import * as THREE from 'https://esm.sh/three@0.180.0';
import { GLTFExporter } from 'https://esm.sh/three@0.180.0/examples/jsm/exporters/GLTFExporter.js';

const $ = (selector) => document.querySelector(selector);
const elements = {
  dropZone: $('#dropZone'), dropEmpty: $('#dropEmpty'), imageInput: $('#imageInput'), imagePreview: $('#imagePreview'), imageOverlay: $('#imageOverlay'),
  resetButton: $('#resetButton'), generateButton: $('#generateButton'), regenerateButton: $('#regenerateButton'), removeBackgroundInput: $('#removeBackgroundInput'),
  backgroundRange: $('#backgroundRange'), backgroundInput: $('#backgroundInput'), backgroundOutput: $('#backgroundOutput'), depthInput: $('#depthInput'), depthOutput: $('#depthOutput'),
  thicknessInput: $('#thicknessInput'), thicknessOutput: $('#thicknessOutput'), viewerPlaceholder: $('#viewerPlaceholder'), generationProgress: $('#generationProgress'),
  progressTitle: $('#progressTitle'), progressMessage: $('#progressMessage'), progressFill: $('#progressFill'), progressPercent: $('#progressPercent'), modelViewer: $('#modelViewer'),
  resultSummary: $('#resultSummary'), resultMeta: $('#resultMeta'), actionGrid: $('#actionGrid'), downloadButton: $('#downloadButton'), errorCard: $('#errorCard'),
  errorMessage: $('#errorMessage'), retryButton: $('#retryButton'),
};

const state = { file: null, imageName: 'modelo-2-5d', previewUrl: '', modelUrl: '', modelBlob: null, running: false };
const qualityMap = { light: 48, balanced: 96, detailed: 160 };
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function selectedQuality() { return document.querySelector('input[name="quality"]:checked')?.value || 'balanced'; }
function updateQualityCards() { document.querySelectorAll('.quality-card').forEach((card) => card.classList.toggle('selected', card.querySelector('input').checked)); }
document.querySelectorAll('input[name="quality"]').forEach((input) => input.addEventListener('change', updateQualityCards));

function updateOutputs() {
  elements.depthOutput.value = `${elements.depthInput.value}%`;
  elements.thicknessOutput.value = `${elements.thicknessInput.value}%`;
  elements.backgroundOutput.value = `${elements.backgroundInput.value}%`;
}
[elements.depthInput, elements.thicknessInput, elements.backgroundInput].forEach((input) => input.addEventListener('input', updateOutputs));
elements.removeBackgroundInput.addEventListener('change', () => { elements.backgroundRange.hidden = !elements.removeBackgroundInput.checked; });

function cleanupModelUrl() {
  if (state.modelUrl) URL.revokeObjectURL(state.modelUrl);
  state.modelUrl = '';
  state.modelBlob = null;
}

function resetResult() {
  cleanupModelUrl();
  elements.viewerPlaceholder.hidden = false;
  elements.generationProgress.hidden = true;
  elements.modelViewer.hidden = true;
  elements.modelViewer.removeAttribute('src');
  elements.resultSummary.hidden = true;
  elements.actionGrid.hidden = true;
  elements.errorCard.hidden = true;
  setProgress(0, 'Preparando imagem…', 'Lendo os pixels no navegador.');
}

function resetAll() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = '';
  state.file = null;
  state.imageName = 'modelo-2-5d';
  elements.imageInput.value = '';
  elements.imagePreview.removeAttribute('src');
  elements.imagePreview.hidden = true;
  elements.imageOverlay.hidden = true;
  elements.dropEmpty.hidden = false;
  elements.resetButton.hidden = true;
  elements.generateButton.disabled = true;
  resetResult();
}

function validateFile(file) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 15 MB.');
}

async function setImage(file) {
  try {
    validateFile(file);
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.file = file;
    state.imageName = (file.name.replace(/\.[^.]+$/, '') || 'modelo-2-5d').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'modelo-2-5d';
    state.previewUrl = URL.createObjectURL(file);
    elements.imagePreview.src = state.previewUrl;
    elements.imagePreview.hidden = false;
    elements.imageOverlay.hidden = false;
    elements.dropEmpty.hidden = true;
    elements.resetButton.hidden = false;
    elements.generateButton.disabled = false;
    resetResult();
  } catch (error) { showError(error.message); }
}

elements.imageInput.addEventListener('change', (event) => { const file = event.target.files?.[0]; if (file) setImage(file); });
['dragenter', 'dragover'].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.add('dragging'); }));
['dragleave', 'drop'].forEach((name) => elements.dropZone.addEventListener(name, (event) => { event.preventDefault(); elements.dropZone.classList.remove('dragging'); }));
elements.dropZone.addEventListener('drop', (event) => { const file = event.dataTransfer?.files?.[0]; if (file) setImage(file); });
elements.resetButton.addEventListener('click', resetAll);

function setRunning(running) {
  state.running = running;
  elements.generateButton.disabled = running || !state.file;
  elements.regenerateButton.disabled = running;
  elements.generateButton.querySelector('.button-label').textContent = running ? 'Criando GLB…' : 'Criar GLB local';
}
function setProgress(percent, title, message) {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  elements.progressFill.style.width = `${value}%`;
  elements.progressPercent.textContent = `${Math.round(value)}%`;
  if (title) elements.progressTitle.textContent = title;
  if (message) elements.progressMessage.textContent = message;
}
function showProgress(title, message) {
  elements.viewerPlaceholder.hidden = true; elements.modelViewer.hidden = true; elements.generationProgress.hidden = false;
  elements.resultSummary.hidden = true; elements.actionGrid.hidden = true; elements.errorCard.hidden = true;
  setProgress(3, title, message);
}
function showError(message) {
  elements.errorMessage.textContent = message || 'O navegador não conseguiu criar o arquivo.';
  elements.errorCard.hidden = false; elements.generationProgress.hidden = true;
  if (!state.modelUrl) elements.viewerPlaceholder.hidden = false;
  setRunning(false);
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

async function prepareCanvas(file) {
  const source = await loadBitmap(file);
  const maxSide = selectedQuality() === 'detailed' ? 1400 : 1100;
  const sourceWidth = source.width || source.naturalWidth;
  const sourceHeight = source.height || source.naturalHeight;
  const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(2, Math.round(sourceWidth * scale));
  canvas.height = Math.max(2, Math.round(sourceHeight * scale));
  const context = canvas.getContext('2d', { alpha: true, willReadFrequently: true });
  if (!context) throw new Error('Seu navegador não liberou o processamento da imagem.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (typeof source.close === 'function') source.close();

  if (elements.removeBackgroundInput.checked) {
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    const threshold = Number(elements.backgroundInput.value) / 100;
    const edge = Math.max(0.035, (1 - threshold) * 0.65);
    for (let index = 0; index < pixels.length; index += 4) {
      const r = pixels[index] / 255, g = pixels[index + 1] / 255, b = pixels[index + 2] / 255;
      const brightness = Math.max(r, g, b);
      const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);
      const neutralLight = brightness - colorSpread * 0.45;
      const alphaFactor = 1 - THREE.MathUtils.smoothstep(neutralLight, threshold - edge, threshold);
      pixels[index + 3] = Math.round(pixels[index + 3] * alphaFactor);
    }
    context.putImageData(imageData, 0, 0);
  }
  return { canvas, context };
}

function samplePixel(data, width, height, u, v) {
  const x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
  const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * (height - 1))));
  const index = (y * width + x) * 4;
  const r = data[index] / 255, g = data[index + 1] / 255, b = data[index + 2] / 255, a = data[index + 3] / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { luminance, alpha: a };
}

function buildReliefGeometry(imageData, widthPixels, heightPixels) {
  const segmentsY = qualityMap[selectedQuality()];
  const aspect = widthPixels / heightPixels;
  const height = 2;
  const width = height * aspect;
  const segmentsX = Math.max(8, Math.round(segmentsY * aspect));
  const relief = Number(elements.depthInput.value) / 100;
  const thickness = Number(elements.thicknessInput.value) / 100;
  const frontZBase = thickness / 2;
  const backZ = -thickness / 2;
  const row = segmentsX + 1;
  const layerSize = row * (segmentsY + 1);
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let layer = 0; layer < 2; layer += 1) {
    for (let y = 0; y <= segmentsY; y += 1) {
      const v = y / segmentsY;
      for (let x = 0; x <= segmentsX; x += 1) {
        const u = x / segmentsX;
        const sample = samplePixel(imageData, widthPixels, heightPixels, u, v);
        const detail = Math.pow(1 - sample.luminance, 1.25) * sample.alpha;
        const z = layer === 0 ? frontZBase + detail * relief : backZ;
        positions.push((u - .5) * width, (v - .5) * height, z);
        uvs.push(layer === 0 ? u : 1 - u, 1 - v);
      }
    }
  }

  for (let y = 0; y < segmentsY; y += 1) {
    for (let x = 0; x < segmentsX; x += 1) {
      const a = y * row + x, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, b, d, a, d, c);
      const ab = layerSize + a, bb = layerSize + b, cb = layerSize + c, db = layerSize + d;
      indices.push(ab, db, bb, ab, cb, db);
    }
  }

  const perimeter = [];
  for (let x = 0; x <= segmentsX; x += 1) perimeter.push(x);
  for (let y = 1; y <= segmentsY; y += 1) perimeter.push(y * row + segmentsX);
  for (let x = segmentsX - 1; x >= 0; x -= 1) perimeter.push(segmentsY * row + x);
  for (let y = segmentsY - 1; y >= 1; y -= 1) perimeter.push(y * row);
  for (let i = 0; i < perimeter.length; i += 1) {
    const current = perimeter[i], next = perimeter[(i + 1) % perimeter.length];
    const currentBack = layerSize + current, nextBack = layerSize + next;
    indices.push(current, nextBack, next, current, currentBack, nextBack);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

async function exportGlb(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const geometry = buildReliefGeometry(imageData.data, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.needsUpdate = true;
  let containsAlpha = false;
  for (let index = 3; index < imageData.data.length; index += 4) {
    if (imageData.data[index] < 250) { containsAlpha = true; break; }
  }
  const transparent = elements.removeBackgroundInput.checked || containsAlpha;
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: .72, metalness: 0, transparent, alphaTest: transparent ? .03 : 0, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = state.imageName;
  const scene = new THREE.Scene();
  scene.name = 'ImageToGLB_Local';
  scene.add(mesh);
  const exporter = new GLTFExporter();
  const result = await exporter.parseAsync(scene, { binary: true, embedImages: true, onlyVisible: true, maxTextureSize: selectedQuality() === 'detailed' ? 2048 : 1024 });
  geometry.dispose(); texture.dispose(); material.dispose();
  return new Blob([result], { type: 'model/gltf-binary' });
}

async function generateModel() {
  if (!state.file || state.running) return;
  resetResult(); setRunning(true); showProgress('Preparando imagem…', 'Lendo os pixels no seu dispositivo.');
  try {
    await nextFrame();
    const { canvas } = await prepareCanvas(state.file);
    setProgress(32, 'Criando relevo…', 'Montando a geometria a partir de cor, luz e transparência.');
    await nextFrame();
    setProgress(65, 'Aplicando textura…', 'Incorporando a imagem dentro do arquivo GLB.');
    const blob = await exportGlb(canvas);
    setProgress(92, 'Finalizando arquivo…', 'Preparando visualização e download.');
    await nextFrame();
    cleanupModelUrl();
    state.modelBlob = blob;
    state.modelUrl = URL.createObjectURL(blob);
    elements.modelViewer.src = state.modelUrl;
    elements.modelViewer.hidden = false;
    elements.viewerPlaceholder.hidden = true;
    elements.generationProgress.hidden = true;
    elements.resultSummary.hidden = false;
    elements.actionGrid.style.display = 'grid';
    elements.actionGrid.hidden = false;
    elements.downloadButton.href = state.modelUrl;
    elements.downloadButton.download = `${state.imageName}.glb`;
    const kb = Math.max(1, Math.round(blob.size / 1024));
    elements.resultMeta.textContent = `GLB 2.5D com textura · ${kb.toLocaleString('pt-BR')} KB`;
    setRunning(false);
  } catch (error) { console.error(error); showError(error instanceof Error ? error.message : String(error)); }
}

elements.generateButton.addEventListener('click', generateModel);
elements.regenerateButton.addEventListener('click', generateModel);
elements.retryButton.addEventListener('click', generateModel);
window.addEventListener('beforeunload', () => { if (state.previewUrl) URL.revokeObjectURL(state.previewUrl); cleanupModelUrl(); });
updateOutputs(); updateQualityCards();
