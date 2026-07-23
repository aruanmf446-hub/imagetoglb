const TRIPO_TASK_URL = 'https://api.tripo3d.ai/v2/openapi/task';
const TASK_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Método não permitido.' });
  }

  const apiKey = process.env.TRIPO_API_KEY;
  if (!apiKey) return response.status(503).json({ error: 'A chave TRIPO_API_KEY não foi configurada.' });

  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const taskId = String(body?.taskId || '');
    if (!TASK_ID_PATTERN.test(taskId)) return response.status(400).json({ error: 'Identificador do modelo inválido.' });

    const rigResponse = await fetch(TRIPO_TASK_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'animate_rig',
        original_model_task_id: taskId,
        out_format: 'glb',
        model_version: 'v2.5-20260210',
        rig_type: 'biped',
        spec: 'mixamo',
      }),
    });
    const payload = await rigResponse.json();
    const rigTaskId = payload?.data?.task_id;
    if (!rigResponse.ok || payload?.code !== 0 || !rigTaskId) {
      return response.status(rigResponse.status || 502).json({ error: payload?.message || 'O modelo não pôde ser enviado para rig automático.', details: payload });
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(202).json({ taskId: rigTaskId });
  } catch (error) {
    console.error('rig_error', error);
    return response.status(500).json({ error: 'Erro interno ao iniciar o rig automático.' });
  }
}
