const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';
const TASK_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

function safeFileName(value) {
  const clean = String(value || 'modelo-3d.glb')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean.toLowerCase().endsWith('.glb') ? clean : `${clean}.glb`;
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) return response.status(503).json({ error: 'A chave TRIPO_API_KEY não foi configurada.' });

  const taskId = String(request.query?.id || '');
  if (!TASK_ID_PATTERN.test(taskId)) return response.status(400).json({ error: 'Identificador de tarefa inválido.' });

  try {
    const taskResponse = await fetch(`${TRIPO_BASE_URL}/task/${encodeURIComponent(taskId)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    });
    const payload = await taskResponse.json();
    const output = payload?.data?.output || {};
    const modelUrl = output.pbr_model || output.model || output.base_model;
    if (!taskResponse.ok || payload?.code !== 0 || !modelUrl) {
      return response.status(409).json({ error: payload?.message || 'O arquivo GLB ainda não está disponível.' });
    }

    const parsed = new URL(modelUrl);
    if (parsed.protocol !== 'https:') return response.status(502).json({ error: 'O provedor retornou um link de arquivo inválido.' });

    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Disposition', `attachment; filename="${safeFileName(request.query?.name)}"`);
    return response.redirect(302, modelUrl);
  } catch (error) {
    console.error('download_error', error);
    return response.status(500).json({ error: 'Erro interno ao preparar o download.' });
  }
}
