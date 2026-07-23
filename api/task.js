const TRIPO_BASE_URL = 'https://api.tripo3d.ai/v2/openapi';
const TASK_ID_PATTERN = /^[a-zA-Z0-9-]{8,80}$/;

function normalizeOutput(output = {}) {
  return {
    model: output.model || null,
    baseModel: output.base_model || null,
    pbrModel: output.pbr_model || null,
    renderedImage: output.rendered_image || output.generated_image || null,
    riggable: output.riggable ?? null,
    rigType: output.rig_type || null,
  };
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
    const task = payload?.data;
    if (!taskResponse.ok || payload?.code !== 0 || !task) {
      return response.status(taskResponse.status || 502).json({ error: payload?.message || 'Não foi possível consultar a tarefa.', details: payload });
    }

    response.setHeader('Cache-Control', 'no-store');
    return response.status(200).json({
      taskId: task.task_id,
      type: task.type,
      status: task.status,
      progress: task.progress ?? 0,
      output: normalizeOutput(task.output),
      consumedCredit: task.consumed_credit ?? null,
    });
  } catch (error) {
    console.error('task_error', error);
    return response.status(500).json({ error: 'Erro interno ao consultar a tarefa.' });
  }
}
