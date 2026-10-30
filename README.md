# PortalMc — Portal Gun para Minecraft Bedrock

**Versão-alvo:** Bedrock/Pocket Edition **1.20.80** (Android ou Windows) · **Script API:** `@minecraft/server` **1.10.0** · **Add-on:** 0.1.0 (experimental)

Dois portais conectados, com superfícies azuis/laranjas e teletransporte de entidades próximas. Usa um Behavior Pack e um Resource Pack independentes (ambos inclusos no .mcaddon).

## Como instalar no Android

1. Abra **Actions → Build PortalMc** e baixe o artefato `PortalMc-1.20.80` (ou use a Release de uma tag `v*`).
2. Extraia o arquivo `.mcaddon` do ZIP do artefato, toque no .mcaddon e abra com Minecraft.
3. Ative **PortalMc | Behavior** e **PortalMc | Visuals** no mundo; em builds antigas, confirme as opções experimentais de Script API se necessário.
4. Obtenha os itens por comandos (com cheats): `/give @s portalmc:portal_gun_blue`, `/give @s portalmc:portal_gun_orange`, `/give @s portalmc:portal_reset`.
5. Use cada item mirando em uma face de bloco até 28 blocos de distância. Ao criar azul e laranja, caminhe em direção a um deles para atravessar.

## Limitações conhecidas da v0.1

- **Não é uma janela 3D**: o interior do portal é uma textura estática, não renderiza o destino.
- O disparador é implementado com **uso de item consumível e reposição automática**, uma solução de compatibilidade com 1.20.80. A resposta exata do controle por toque precisa de teste em dispositivo.
- Portais ocupam aproximadamente **1×1 bloco**; a colisão é por proximidade, não há uma abertura real nos blocos.
- A velocidade e a direção de saída são **aproximadas**, sem física completa de Portal 2.
- Um par de portais é compartilhado por **todo o mundo**. Se o chunk for descarregado, a aparência visual pode precisar de reentrada.
- Portais nas dimensões Overworld/Nether/End são experimentais; teste primeiramente no mesmo mundo/dimensão.
- Não foi validado dentro do cliente Minecraft durante a geração; revisão estática no CI não substitui testes no jogo.

## Estrutura

- `behavior_pack/` — itens, entidades sem colisão e JavaScript de teleporte.
- `resource_pack/` — ícones, modelos, texturas e render controller.
- `scripts/package_addon.py` — valida JSON e estrutura e empacota os dois packs em `.mcaddon`.
- `.github/workflows/build.yml` — gera o instalador em Actions; tags `v*` também publicam GitHub Release.

**Nota:** o recurso de ver através do portal não é suportado pela API convencional dessa versão. A v0.1 não anuncia nem simula câmera remota.
