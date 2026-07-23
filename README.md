# ImageToGLB

Aplicativo web para transformar uma imagem em um modelo 3D **GLB**, acompanhar a geração, visualizar o resultado no navegador e baixar uma versão pronta para edição ou rig.

## O que já está implementado

- Upload por clique ou arrastar e soltar.
- Otimização da imagem no navegador antes do envio.
- Geração real de modelo 3D por imagem usando a API da Tripo AI.
- Modos rápido, equilibrado e low-poly para jogos.
- Textura PBR opcional.
- Progresso da geração em tempo real por consulta da tarefa.
- Visualizador 3D interativo com rotação, zoom e iluminação.
- Download do GLB sem rig, indicado para importação no AccuRig.
- Geração opcional de uma segunda versão com rig humanoide.
- Chave da API protegida no servidor.
- Layout responsivo para computador e celular.

## Configuração

1. Crie uma chave de API na plataforma Tripo AI.
2. No projeto da Vercel, abra **Settings → Environment Variables**.
3. Adicione:

```env
TRIPO_API_KEY=tsk_sua_chave_aqui
```

4. Faça um novo deploy.

A chave nunca é enviada ao navegador. A imagem é encaminhada pelo servidor diretamente ao provedor de geração 3D.

## Desenvolvimento local

O projeto usa arquivos estáticos e funções serverless da Vercel. Com a Vercel CLI instalada:

```bash
vercel dev
```

Crie um `.env.local` com `TRIPO_API_KEY` para testar a geração.

## Estrutura

```text
index.html          Interface principal
styles.css          Design responsivo
app.js              Upload, progresso, preview e download
api/generate.js     Upload da imagem e criação da tarefa 3D
api/task.js         Consulta de progresso e resultado
api/rig.js          Criação opcional de rig humanoide
api/download.js     Atualiza o link temporário e redireciona o download
api/status.js       Verifica se o servidor está configurado
```

## Limitações reais

A reconstrução usa uma única imagem. Partes escondidas, costas, laterais e detalhes cobertos precisam ser estimados pela IA e podem não ficar idênticos à referência. Para personagens destinados ao AccuRig, a melhor entrada é uma imagem frontal de corpo inteiro, com braços afastados, pernas separadas, fundo simples e poucos acessórios.

Os arquivos gerados e o consumo de créditos dependem da conta configurada no provedor 3D.
