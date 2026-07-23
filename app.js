const $ = (selector) => document.querySelector(selector);

const elements = {
  providerStatus: $('#providerStatus'),
  dropZone: $('#dropZone'),
  dropEmpty: $('#dropEmpty'),
  imageInput: $('#imageInput'),
  imagePreview: $('#imagePreview'),
  imageOverlay: $('#imageOverlay'),
  resetButton: $('#resetButton'),
  generateButton: $('#generateButton'),
  pbrInput: $('#pbrInput'),
  viewerPlaceholder: $('#viewerPlaceholder'),
  generationProgress: $('#generationProgress'),
  progressTitle: $('#progressTitle'),
  progressMessage: $('#progressMessage'),
  progressFill: $('#progressFill'),
  progressPercent: $('#progressPercent'),
  modelViewer: $('#modelViewer'),
  resultSummary: $('#resultSummary'),
  resultMeta: $('#resultMeta'),
  actionGrid: $('#actionGrid'),
  downloadButton: $('#downloadButton'),
  rigButton: $('#rigButton'),
  errorCard: $('#errorCard'),
  errorMessage: $('#errorMessage'),
  retryButton: $('#retryButton'),
};

const state = {
  imageDataUrl: '',
  imageName: '',
  generationTaskId: '',
  rigTaskId: '',
  running: false,
  lastMode: 'generation',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function apiErrorMessage(payload, fallback) {
  return payload?.error || payload?.message || fallback;
}

async function checkProvider() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    const data = await response.json();
    elements.providerStatus.classList.remove('online', 'offline');
    if (data.configured) {
      elements.providerStatus.classList.add('online');
      elements.providerStatus.querySelector('span:last-child').textContent = 'Gerador 3D conectado';
    } else {
      elements.providerStatus.classList.add('offline');
      elements.providerStatus.querySelector('span:last-child').textContent = 'Configure a chave da API';
    }
  } catch {
    elements.providerStatus.classList.add('offline');
    elements.providerStatus.querySelector('span:last-child').textContent = 'Servidor indisponível';
  }
}

function selectedQuality() {
  return document.querySelector('input[name="quality"]:checked')?.value || 'balanced';
}

function updateQualityCards() {
  document.querySelectorAll('.quality-card').forEach((card) => {
    const input = card.querySelector('input');
    card.classList.toggle('selected', input.checked);
  });
}

document.querySelectorAll('input[name="quality"]').forEach((input) => {
  input.addEventListener('change', updateQualityCards);
});

function resetResult() {
  state.generationTaskId = '';
  state.rigTaskId = '';
  elements.viewerPlaceholder.hidden = false;
  elements.generationProgress.hidden = true;
  elements.modelViewer.hidden = true;
  elements.modelViewer.removeAttribute('src');
  elements.resultSummary.hidden = true;
  elements.actionGrid.hidden = true;
  elements.errorCard.hidden = true;
  setProgress(0, 'Preparando imagem…', 'Iniciando a geração do modelo.');
}

function resetAll() {
  state.imageDataUrl = '';
  state.imageName = '';
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
  const accepted = ['image/png', 'image/jpeg', 'image/webp'];
  if (!accepted.includes(file.type)) throw new Error('Use uma imagem PNG, JPG ou WebP.');
  if (file.size > 10 * 1024 * 1024) throw new Error('A imagem deve ter no máximo 10 MB.');
}

async function imageToDataUrl(file, maxSide = 1600, quality = 0.9) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d', { alpha: true });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const result = canvas.toDataURL('image/webp', quality);
  if (result.length > 4_000_000 && maxSide > 900) {
    return imageToDataUrl(file, Math.round(maxSide * 0.78), Math.max(0.72, quality - 0.08));
  }
  return result;
}

async function setImage(file) {
  try {
    validateFile(file);
    state.imageDataUrl = await imageToDataUrl(file);
    state.imageName = file.name.replace(/\.[^.]+$/, '') || 'modelo-3d';
    elements.imagePreview.src = state.imageDataUrl;
    elements.imagePreview.hidden = false;
    elements.imageOverlay.hidden = false;
    elements.dropEmpty.hidden = true;
    elements.resetButton.hidden = false;
    elements.generateButton.disabled = false;
    resetResult();
  } catch (error) {
    showError(error.message);
  }
}

elements.imageInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) setImage(file);
});

['dragenter', 'dragover'].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add('dragging');
  });
});
['dragleave', 'drop'].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove('dragging');
  });
});
elements.dropZone.addEventListener('drop', (event) => {
  const file = event.dataTransfer?.files?.[0];
  if (file) setImage(file);
});

elements.resetButton.addEventListener('click', resetAll);
elements.retryButton.addEventListener('click', () => generateModel());

function setRunning(running, label = 'Gerar modelo GLB') {
  state.running = running;
  elements.generateButton.disabled = running || !state.imageDataUrl;
  elements.generateButton.querySelector('.button-label').textContent = running ? 'Gerando modelo…' : label;
}

function setProgress(percent, title, message) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  elements.progressFill.style.width = `${safePercent}%`;
  elements.progressPercent.textContent = `${Math.round(safePercent)}%`;
  if (title) elements.progressTitle.textContent = title;
  if (message) elements.progressMessage.textContent = message;
}

function showProgress(title, message) {
  elements.viewerPlaceholder.hidden = true;
  elements.modelViewer.hidden = true;
  elements.generationProgress.hidden = false;
  elements.resultSummary.hidden = true;
  elements.actionGrid.hidden = true;
  elements.errorCard.hidden = true;
  setProgress(3, title, message);
}

function showError(message) {
  elements.errorMessage.textContent = message || 'O serviço de geração retornou um erro inesperado.';
  elements.errorCard.hidden = false;
  elements.generationProgress.hidden = true;
  if (!elements.modelViewer.src) elements.viewerPlaceholder.hidden = false;
  setRunning(false);
}

function progressCopy(status, mode) {
  if (mode === 'rig') {
    if (status === 'queued') return ['Na fila para rig', 'Preparando o esqueleto do personagem.'];
    return ['Criando esqueleto', 'Aplicando ossos e pesos ao modelo 3D.'];
  }
  if (status === 'queued') return ['Modelo na fila', 'Aguardando o serviço iniciar a reconstrução.'];
  return ['Reconstruindo em 3D', 'Gerando geometria, volume e textura a partir da imagem.'];
}

async function pollTask(taskId, mode = 'generation') {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 12 * 60 * 1000) {
    const response = await fetch(`/api/task?id=${encodeURIComponent(taskId)}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(data, 'Falha ao consultar a geração.'));

    const [title, message] = progressCopy(data.status, mode);
    setProgress(data.progress ?? 0, title, message);

    if (data.status === 'success') return data;
    if (['failed', 'banned', 'expired', 'cancelled', 'unknown'].includes(data.status)) {
      throw new Error(data.error || `A tarefa terminou com o status “${data.status}”.`);
    }
    await sleep(2500);
  }
  throw new Error('A geração excedeu o tempo de acompanhamento. Tente consultar novamente.');
}

function showModel(task, mode = 'generation') {
  const modelUrl = task.output?.pbrModel || task.output?.model || task.output?.baseModel;
  if (!modelUrl) throw new Error('O gerador concluiu a tarefa, mas não entregou um arquivo GLB.');

  elements.generationProgress.hidden = true;
  elements.viewerPlaceholder.hidden = true;
  elements.modelViewer.src = modelUrl;
  elements.modelViewer.hidden = false;
  elements.resultSummary.hidden = false;
  elements.actionGrid.style.display = 'grid';
  elements.actionGrid.hidden = false;

  const taskId = mode === 'rig' ? state.rigTaskId : state.generationTaskId;
  const fileName = `${state.imageName || 'modelo-3d'}${mode === 'rig' ? '-rigado' : ''}.glb`;
  elements.downloadButton.href = `/api/download?id=${encodeURIComponent(taskId)}&name=${encodeURIComponent(fileName)}`;
  elements.resultMeta.textContent = mode === 'rig'
    ? 'GLB com esqueleto humanoide pronto para baixar'
    : 'GLB sem rig, indicado para importar no AccuRig';
  elements.rigButton.hidden = mode === 'rig';
}

async function generateModel() {
  if (!state.imageDataUrl || state.running) return;
  resetResult();
  state.lastMode = 'generation';
  setRunning(true);
  showProgress('Enviando imagem…', 'Otimizando e enviando sua referência com segurança.');

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: state.imageDataUrl,
        quality: selectedQuality(),
        pbr: elements.pbrInput.checked,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(data, 'Não foi possível iniciar a geração.'));

    state.generationTaskId = data.taskId;
    const task = await pollTask(data.taskId, 'generation');
    showModel(task, 'generation');
    setRunning(false);
  } catch (error) {
    showError(error.message);
  }
}

elements.generateButton.addEventListener('click', generateModel);

elements.rigButton.addEventListener('click', async () => {
  if (!state.generationTaskId || state.running) return;
  state.lastMode = 'rig';
  state.running = true;
  elements.rigButton.disabled = true;
  elements.rigButton.querySelector('span').textContent = 'Gerando rig…';
  showProgress('Preparando rig…', 'Verificando a malha e criando um esqueleto humanoide.');

  try {
    const response = await fetch('/api/rig', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: state.generationTaskId }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(apiErrorMessage(data, 'Não foi possível iniciar o rig automático.'));

    state.rigTaskId = data.taskId;
    const task = await pollTask(data.taskId, 'rig');
    showModel(task, 'rig');
  } catch (error) {
    showError(error.message);
  } finally {
    state.running = false;
    elements.rigButton.disabled = false;
    elements.rigButton.querySelector('span').textContent = 'Gerar versão rigada';
  }
});

checkProvider();
updateQualityCards();
