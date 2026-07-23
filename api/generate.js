const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';
const MAX_IMAGE_BYTES = 3_600_000;

const MODEL_BY_QUALITY = {
  fast: 'Turbo-v1.0-20250506',
  balanced: 'v3.1-20260211',
  game: 'P1-20260311',
};

function sendError(response, status, message, details) {
  response.status(status).json({ error: message, details });
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return sendError(response, 405, 'Método não permitido.');
  }

  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) {
    return sendError(response, 503, 'A chave TRIPO_API_KEY ainda não foi configurada no servidor.');
  }

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const image = body?.image;
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image || '');
    if (!match) return sendError(response, 400, 'Imagem inválida. Envie PNG, JPG ou WebP.');

    const mimeType = match[1];
    const buffer = Buffer.from(match[2], 'base64');
    if (!buffer.length) return sendError(response, 400, 'A imagem enviada está vazia.');
    if (buffer.length > MAX_IMAGE_BYTES) {
      return sendError(response, 413, 'A imagem processada ficou grande demais. Use uma imagem menor.');
    }

    const extension = mimeType === 'image/jpeg' ? 'jpeg' : mimeType.split('/')[1];
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), `reference.${extension}`);

    const uploadResponse = await fetch(`${TRIPO_BASE_URL}/upload/sts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    const uploadPayload = await readJson(uploadResponse);
    const imageToken = uploadPayload?.data?.image_token;
    if (!uploadResponse.ok || uploadPayload?.code !== 0 || !imageToken) {
      return sendError(response, uploadResponse.status || 502, uploadPayload?.message || 'Falha ao enviar a imagem ao gerador 3D.', uploadPayload);
    }

    const quality = MODEL_BY_QUALITY[body?.quality] ? body.quality : 'balanced';
    const taskPayload = {
      type: 'image_to_model',
      model_version: MODEL_BY_QUALITY[quality],
      file: {
        type: extension,
        file_token: imageToken,
      },
      texture: true,
      pbr: body?.pbr !== false,
      texture_quality: quality === 'fast' ? 'standard' : 'detailed',
    };

    const taskResponse = await fetch(`${TRIPO_BASE_URL}/task`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(taskPayload),
    });
    const taskResult = await readJson(taskResponse);
    const taskId = taskResult?.data?.task_id;
    if (!taskResponse.ok || taskResult?.code !== 0 || !taskId) {
      return sendError(response, taskResponse.status || 502, taskResult?.message || 'O gerador 3D recusou a tarefa.', taskResult);
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(202).json({ taskId, provider: 'tripo', quality });
  } catch (error) {
    console.error('generate_error', error);
    return sendError(response, 500, 'Erro interno ao iniciar a geração.', error instanceof Error ? error.message : String(error));
  }
}
