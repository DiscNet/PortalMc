# PortalMc v0.2.0 — Bedrock / Pocket Edition 1.20.80

Add-on experimental para Minecraft Bedrock 1.20.80 (API `@minecraft/server` 1.10.0).

## Instalação Android
1. Em **Actions → Build PortalMc**, baixe o artefato `PortalMc-1.20.80` do workflow aprovado.
2. Extraia `PortalMc-1.20.80-v0.2.0.mcaddon` do arquivo ZIP e abra no Minecraft.
3. Ative **PortalMc | Behavior** e **PortalMc | Visuals** no mundo.

## Usar a única arma
A **Portal Gun** aparece na aba **Equipamentos**, agrupada com armas (grupo espadas). Obtenha via Criativo ou `/give @s portalmc:portal_gun`.
- **Usar**: dispara o portal azul.
- **Agachar + usar**: dispara o portal laranja, sem trocar de item.
- Para limpar ambos: `/scriptevent portalmc:clear` (com permissão de comandos).

A arma tem geometria 3D de múltiplas peças, mandíbulas metálicas, dois canais luminosos e punho dedicado, exibida ao segurá-la via attachable.

## Teletransporte
O sistema verifica a proximidade **a cada tick**, reconhece jogador olhando para a parede mesmo após o movimento ser bloqueado e evita teletransporte repetitivo por cooldown curto. A chegada é deslocada do plano de destino; o impulso é aproximado. **A execução é imediata quando as condições são reconhecidas**, mas atrasos por chunks não carregados ou FPS/ticks do aparelho ainda podem ocorrer.

## Visão de outro ambiente — protótipo
**Prévia com raycasting** somente em pares de portais **nas paredes**, a até 9 blocos do observador:
- A Script API amostra o espaço do portal de saída em uma grade de **4×6** pontos.
- Para cada ponto escolhe uma cor aproximada do tipo de bloco encontrado em até 12 blocos.
- Exibe pequenas entidades com texturas do mesmo pacote, escolhidas por propriedades sincronizadas e render controller.
- Atualiza a cada 8 ticks, somente quando um jogador está próximo. Sem observador, remove as entidades da prévia para reduzir custo.
- Não é uma segunda câmera: tem **baixa resolução, sem texturas reais dos blocos, sem mobs, recorte de câmera ou renderização perfeita**. Pisos e tetos exibem a textura padrão. Portais com destino em chunks descarregados podem apresentar céu/fallback.

A prévia será aperfeiçoada após testes no cliente. O empacotamento por GitHub Actions valida sintaxe JS, estrutura JSON e integridade do `.mcaddon`; não executa o Minecraft.

## Código
- `behavior_pack/scripts/main.js`: disparo, teletransporte, amostragem visual.
- `resource_pack/attachables/` e `models/entity/portal_gun.geo.json`: modelo 3D.
- `resource_pack/entity/portal_pixel.entity.json`: renderização da prévia.
- `scripts/package_addon.py`: valida e empacota os dois `.mcpack` no `.mcaddon`.
