# ImageToGLB

Conversor gratuito de imagem para **GLB 2.5D**, executado inteiramente no navegador.

## O que funciona sem API

- Upload de PNG, JPG e WebP.
- Processamento local: a imagem não é enviada para servidor.
- Geração de malha com frente texturizada, espessura, parte traseira e relevo por luminosidade.
- Três níveis de detalhamento da geometria.
- Remoção opcional de fundo claro.
- Visualização 3D no navegador.
- Download do GLB pronto para Blender, editores 3D e engines.
- Publicação automática no GitHub Pages pelo GitHub Actions.

## Limitação real

Esta versão cria um objeto 2.5D, semelhante a um recorte com volume e relevo. Uma única imagem não contém informações suficientes para reconstruir corretamente costas, laterais e partes escondidas de um personagem. Uma reconstrução 3D completa exige um modelo de IA pesado executado em GPU ou um serviço externo.

O GLB gerado pode ser editado no Blender, mas não é um personagem humanoide volumétrico adequado para rig automático no AccuRig.

## Produção

O workflow `.github/workflows/pages.yml` valida e publica o conteúdo estático do branch `main` no GitHub Pages.

Para a primeira publicação, o repositório deve usar **Settings → Pages → Source → GitHub Actions**.
