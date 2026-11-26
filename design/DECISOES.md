# Decisões de design

O Figma tem inconsistências (várias delas apontadas nos comentários do próprio arquivo público). Regra geral: **preservar a identidade** (cores, tipografia Roboto Mono, espaçamentos, composição, marca KURIO, tema escuro único) e **corrigir defeitos evidentes**, registrando cada desvio (tela, o que mudou, por quê); o resumo está no `ARCHITECTURE.md`.

## Layout
- Card de NFT: usar o frame 206 do grid do Início como padrão único (230 e 231 são inconsistentes). Nome e valor sempre alinhados; o fundo do card é mantido.
- Remover elementos sem função (retângulos 30–32, círculos soltos, imagem indevida no Mobile/Início) e corrigir desalinhamentos, margens e centralizações apontados; contêineres centralizados em 1440.
- Header idêntico em todas as telas (com a borda inferior do Início). Logado: "Entrar" dá lugar ao menu do usuário (perfil, carteiras, sair).
- Login e Cadastro são modais sobre o conteúdo no Figma: implementar como rotas `/login` e `/register` que funcionam em acesso direto, com backdrop escuro (~60%) e foco preso.
- Tablet (768): adaptação fluida entre os frames desktop e mobile. Confirmação, Perfil e Carteiras em mobile: derivar do desktop em coluna única.

## Comportamento
- Ordenação: A→Z, Z→A, menor preço, maior preço, listados recentemente.
- Filtros combináveis com estado selecionado inequívoco (semântica de checkbox, não só cor). Faixa de preço: manter o slider do layout e acrescentar campos mínimo/máximo.
- Coleções em ordem alfabética. Paginação com "anterior" a partir da página 2 e total de resultados.
- Detalhe: miniaturas são a galeria do mesmo NFT; a edição é um seletor separado que altera preço/disponibilidade. Botão de diminuir desabilitado na quantidade mínima; aumentar desabilitado no limite da edição.
- ID do token e demais dados vêm das fixtures (o Figma é inconsistente entre carrinho e pagamento).
- Carrinho mobile: mesmo stepper do desktop e espaço para o botão de remover.
- Pagamento: primeira opção de carteira é WalletConnect (como no mobile). No mobile segue a ordem do frame: "Carteira e rede" primeiro; os dados do colecionador continuam obrigatórios, logo abaixo.
- Pedido pendente e recusado: mesmo padrão visual da confirmação, com ícone, texto e ações próprios; o recibo só aparece no confirmado.
- Ícones informativos no lugar das letras dos destaques do Início (lucide, equivalente aos sugeridos).
- Pagamento (fluxos): "Nome ENS" e "Código de indicação" marcados como obrigatórios no Figma ficam **opcionais** (validados só quando preenchidos): exigi-los bloquearia compradores sem ENS ou sem indicação. "Endereço da carteira" e "Tipo de carteira" vêm da carteira cadastrada selecionada (requisito de usar as carteiras cadastradas), não de digitação livre; "Usar outra carteira?" = escolher a carteira secundária.
- Pagamento: a confirmação tem um passo de revisão ("Revisar pedido" → "Confirmar compra"); se a cotação mudar depois da revisão, o botão fica bloqueado até "Aceitar novos valores".

## Desvios de interface (Início, Detalhe, layout base)
- Design system: tokens do Figma em `src/index.css` (`bg-ink`, `bg-surface`, `bg-surface-raised`, `bg-surface-dark`, `border-line`, `border-line-soft`, `bg-brand`, `text-brand-accent`, `text-text-secondary`, `text-text-muted`, `text-coral`, `shadow-card/raised/bar`). Cor de erro: `#ED1B2E` tem contraste 4,0:1 sobre `#241612`, então usamos o Text/Coral `#F0805F` (6,6:1) acompanhado de ícone e texto. Inputs sem preenchimento, com borda Color/Border de 1 px e raio de 5 px, como nos nós. Foco visível único (contorno sólido de 2 px em `#E89B55`) em todos os controles, o que não existe no layout.
- Header: em < 1024 px a navegação vai para um menu lateral. "Criadores" e "Aprenda" aparecem com um selo visível "em breve" e não são clicáveis (fora do escopo; o estado não fica só na cor). "Mercado" leva ao catálogo e fica ativo no detalhe. A lupa abre uma busca em popover.
- Mobile (< 768 px): no Início e no Detalhe não há header, como nos frames. A aba "Conta" da barra inferior abre o menu de navegação e de conta (entrar ou perfil, carteiras, pedidos, sair). Telas sem frame mobile mantêm um header compacto. A barra inferior tem rótulos visíveis (ganho de a11y) e não tem o botão central de "scan" (sem função no escopo).
- Início: as 3 abas do frame foram mantidas. "Novos lançamentos" filtra os NFTs listados até 30 dias antes da listagem mais recente (`recent=true`) e "Em alta" filtra os destaques (`featured`). O filtro "Rede" (Ethereum/Polygon/Solana) não existe nos dados e virou "Disponibilidade", no mesmo estilo de lista. Coleções = categorias da API em português, com contagem real.
- Início: a busca é obrigatória pelo enunciado, mas a linha das abas não tem espaço (abas 376 px + ordenação 315 px em 842 px). Por isso o campo "Buscar" fica no topo da lateral de filtros no desktop, e grid e abas ficam na posição do frame (abas y=647, grid y≈701). No mobile/tablet, a barra "Explorar coleções" + filtros fica acima do hero, como no frame, e a ordenação vai para a sheet de filtros. A linha "N NFTs encontrados · Limpar filtros" só aparece com filtros ativos (a contagem é sempre anunciada por aria-live). O indicador "Atualizando…" é uma pílula sobreposta, fora do fluxo.
- Início: 9 por página (grid 3×3 do frame; 48 NFTs = 6 páginas). Coração de favorito também nos cards desktop (vem do card mobile). Selo "ESGOTADO" no estilo do selo "RARO", com preço riscado. O nome do NFT nunca é cortado: cabe numa linha, como no frame, e só quebra quando não cabe (o número do token fica junto da última palavra); apenas aquela linha da grade cresce, sem espaço reservado nos outros cards. Pontos do hero: o ativo é uma pílula, como no detalhe mobile do próprio Figma, para o estado não depender só de cor.
- URL legível: `?category=art,music&minPrice=0.5` (serialização própria em `shared/lib/search-serialization.ts`) em vez do JSON padrão do router.
- Blog "Diário da Cunhagem" e itens editoriais do footer ("Estúdio do criador", "Central de ajuda"): fora do escopo, exibidos sem link com o selo "em breve" (na coluna "Central de ajuda" o selo fica no título, sem a linha extra). "Atividade" leva a `/orders` e "Lista de interesse" a `/account/favorites`; "Minha coleção" (NFTs possuídos) não tem página no escopo e aparece como "em breve", em vez de repetir o destino de "Atividade". O e-mail e o telefone do rodapé são os exemplos do layout: ficam como texto, sem `mailto:`/`tel:`, para não abrir o app de e-mail ou de telefone com um contato fictício. A newsletter valida o e-mail e informa que não está disponível (não finge sucesso). As coleções do footer apontam para o catálogo filtrado (Arte 3D e Utilidade, que não existem nos dados, trocadas por Jogos e Colecionáveis). O indicador "Tempo real: conectado" dá feedback do canal Socket.IO (A11Y-12): fica na borda direita da linha do copyright (que continua centralizada, como no frame) e, abaixo de 1024 px, numa linha própria. As letras W/C/D foram trocadas por ícones.
- Detalhe: as estrelas, as avaliações e a aba "Avaliações de colecionadores" foram removidas (não há dados de avaliação e não inventamos números). No mobile, o selo do criador ("por …") ocupa o lugar do selo de avaliação. As pílulas de edição mostram o nome (Padrão/Rara/Lendária), e a tiragem e a disponibilidade vêm na linha abaixo. A edição esgotada aparece riscada e desabilitada. "Atributos" virou "Edições" (não há atributos nos dados). Foi acrescentado o botão "Adicionar ao carrinho" (ícone do frame mobile) ao lado de "COMPRAR" no desktop. A lupa abre a imagem ampliada em diálogo.
- Detalhe: 4 vistas por NFT geradas do mesmo arquivo do Figma (inteira, rosto, tronco/acessório, enquadramento alternativo) via `scripts/optimize-assets.mjs`. "Mais desta coleção" é um carrossel com scroll nativo e os pontos do frame. O número de páginas depende da coleção (8 NFTs por categoria resultam em 2 páginas, não 3).
- Imagens: as 4 artes do Figma (PNG de 1254 px, ~2 MB) foram convertidas para AVIF/WebP em 256/512/800 px e distribuídas entre as 48 fixtures. Os ícones SVG do Figma viraram componentes (`scripts/generate-icons.mjs`).

## Desvios dos fluxos (carrinho, pagamento, pedido, auth, conta)
- Carrinho: nome do NFT em até 2 linhas (sem corte com reticências); preço alterado e falta de estoque aparecem na linha com ícone e texto (não só cor); cupom aplicado vira um selo removível e o desconto mostra o código; "Colecionadores também viram" mostra os 15 NFTs listados mais recentemente que não estão no carrinho, em carrossel de 3 páginas de 5 com os pontos do frame (em todas as larguras a partir de 768 px); no mobile o stepper é o par de círculos escuros de 24 px do frame e o resumo fica no painel arredondado, sem barra fixa. Como nos frames mobile, Carrinho e Pagamento não têm o header compacto, a barra de abas, as recomendações nem o rodapé abaixo de 768 px: a tela termina no painel de resumo/CTA (o botão "Demo" continua depois dele).
- Pagamento: "Rede" lista só as redes da carteira selecionada; "Endereço da carteira" e "Tipo de carteira" são somente leitura (vêm da carteira cadastrada); o slot "ENS ou carteira secundária" virou o "Nome ENS (opcional)" com sufixo `.eth` e o segundo campo "Nome ENS" foi removido (duplicado). "Carteira e rede" lista as carteiras cadastradas com a marca do provedor (W/M/Coinbase), em vez de provedores genéricos; a conexão simulada é explícita ("Conectar carteira"). "Confirmar compra" abre um diálogo de revisão com o total da cotação, e a confirmação final acontece nele (substitui o passo "Revisar pedido"). "Tem um código promocional? Aplique aqui" abre o campo de cupom. Mobile: ordem do frame ("Carteira e rede", depois os dados do colecionador, depois itens e resumo) e barra fixa com total e "Confirmar compra" (a barra de abas some nessa rota). Campos sem preenchimento (como o `Input`), passo de 81 px entre linhas. "Seus NFTs": quantidade "(x n)" abaixo do subtotal, para o nome caber.
- Confirmação: é a rota `/orders/$orderId` (acesso direto e refresh), com o cartão do modal do frame centralizado; o X volta ao início. "Carteira" mostra o endereço curto (o recibo guarda o endereço, não o provedor); o ID da transação é abreviado com o hash completo no `title`; subtotal e desconto entram no resumo; "Ver no Etherscan" informa que o link é simulado. Pendente e recusado usam o mesmo cartão sem recibo.
- Login/Cadastro: os campos mantêm só placeholders visíveis, como no frame, com rótulos acessíveis ocultos; o olho mostra/oculta a senha; login social e "Esqueceu a senha?" ficam desabilitados com "(em breve)". Atrás do modal desktop fica o hero do Início escurecido. No mobile o título e o botão do cadastro são "Criar conta" (o frame diz "Criar perfil de colecionador" e "Criar perfil"), iguais à aba e ao botão do modal desktop.
- Perfil: "Nome ENS" é opcional e o `.eth` é um sufixo fixo (não um select); "Apelido da carteira" edita a carteira principal; avatar com pré-visualização antes de "Enviar avatar"; um único "Salvar" grava dados, apelido e senha (a senha só é validada se preenchida). Menu "Meu perfil": "Atividade" = pedidos (`/orders`), "Lista de interesse" = favoritos; Ofertas, Arquivos baixados e Suporte ficam "(em breve)". Abaixo de 1024 px o menu vira uma linha de abas roláveis.
- Carteiras: os campos de perfil repetidos no frame (Nome de exibição, Nome do perfil, E-mail, Código de indicação, Nome ENS) saíram; "Rede" virou "Redes" (seleção múltipla, como no contrato); "Igual à carteira principal" foi removido (a API recusa endereço repetido). A secundária é editável e pode ser promovida ("Tornar principal").
- Favoritos e Atividade (pedidos) não têm frame: derivados do menu da conta, com os cards do catálogo e linhas de pedido com status em texto e ícone.
- Painel "Demo" (botão discreto → sheet) para cenários, reset e mudanças no servidor simulado; aparece só com os mocks ativos. A partir de 1440 px fica flutuante no canto inferior esquerdo (na margem vazia ao lado do conteúdo de 1200 px); abaixo disso é um botão comum depois do footer (nunca sobre cards, CTA, total ou campos, inclusive em tablet e em 1024-1439 px).
- Perfil: dicas de formato (ENS sem `.eth`, avatar PNG/JPEG/WebP até 1 MB) ficam acessíveis mas não visíveis; a regra da nova senha fica num placeholder curto ("Mín. 8, letras e números") e, completa, ligada ao campo por `aria-describedby` e mostrada sob o erro, para manter a grade do frame; Salvar com 131 px.
- Carteiras: o "Adicionar" do topo aparece só enquanto não há carteira secundária (com as duas cadastradas, não há o que adicionar).
- Header: "Mercado" não fica sublinhado no Carrinho e no Pagamento (o sublinhado indica a seção atual, e essas telas não são o catálogo).
- Resumo (carrinho, pagamento): o desconto zero aparece como `(-) 0 ETH`, no mesmo formato dos demais valores da cotação, em vez do texto fixo `(-) 00.00` do Figma.
- Detalhe, mobile: a descrição do NFT já é o primeiro parágrafo da área de compra; em "Detalhes do NFT" ela não é repetida (só no desktop, onde as duas seções ficam distantes). Em "Detalhes do NFT", os textos de "Contrato" e "Direitos autorais" estavam trocados no layout e foram colocados sob o título correto.
- Rodapé: as colunas fixas do frame (265/211 px) só valem a partir de 1280 px; entre 768 e 1279 px os blocos ficam em 2 colunas, para não estourar a largura em 1024 px.

## Início, Detalhe e layout base: o que ainda difere do Figma

Medido no app (Chromium, área útil de 1440 e 414 px, dados das fixtures) contra `design/nodes`. Tudo o que não está aqui segue o valor do frame (diferença ≤ 2 px de posição/tamanho, ≤ 1 px de fonte, mesma cor, peso, raio e sombra). Diferenças que são só consequência de outra (um bloco acima mais alto empurra os de baixo) não são repetidas.

### Acessibilidade e responsividade (todas as telas)
- **Campos**: a borda é a Color/Border do layout (#3F2319, 1,34:1 sobre o fundo). O campo nunca é identificado só pela borda: todos têm rótulo ou placeholder visível (≥ 6:1), borda mais clara no hover e contorno de foco de 2 px (8,5:1). Com `prefers-contrast: more` a borda passa a #8B6A50 (3,9:1), atendendo ao WCAG 1.4.11; no tema padrão fica a cor do layout.
- **Barras fixas no mobile** (< 768 px): `scroll-padding-bottom` igual à altura da barra de abas (76 px), da barra de compra do detalhe (~166 px) ou da barra do pagamento, para o elemento focado ou rolado nunca ficar escondido (WCAG 2.4.11).
- **Alvos de toque**: pontos de carrossel/galeria e botões do stepper mantêm o desenho do frame, mas a área clicável tem pelo menos 24 px (WCAG 2.5.8). Por isso os pontos ficam a 24 px de passo em vez de 13–20 px (ver cada tela). O polegar do slider de preço tem 15 px como no frame, com área invisível de 31 px.
- **Ícones**: os do próprio Figma (Iconly, `design/assets`) viram componentes em `src/shared/ui/icons.tsx` (`scripts/generate-icons.mjs`): X dos diálogos e da sheet, lupa, carrinho, logout, usuário, carteira, atividade, coração, seta do select, setas da paginação e do voltar, mensagem e alerta. Continuam no lucide só ícones sem equivalente nos frames: menu (hambúrguer), carregamento, busca sem resultado, check do checkbox, página 404 e os três serviços do rodapé.
- **X dos diálogos**: ícone de 18 px #D28A4C a 11 px do topo e 12 px da direita, sem caixa, como no frame; a área de toque invisível tem 40 px e o nome acessível é "Fechar". O fundo do diálogo é só escurecido (sem desfoque), como no layout.

### Início desktop (1440)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Pontos do hero | 3 círculos de 8 px, 8 px entre eles | pílula de 20 px no ativo; passo de 24 px | estado não só por cor; alvo de 24 px |
| Texto da faixa de preço | "Preço: 0,02 - 12,30 ETH" | "Preço: 0 - 13+ ETH" | mostra os limites do filtro (o frame mostra preços de exemplo) |
| Sublinhado da aba ativa | 101 px (mais curto que o texto de 118) | largura do texto | o traço mais curto que a palavra é defeito do frame |
| "Ordenar por:" | x 1020, valor sobreposto à seta | x 987, valor e seta alinhados à direita | corrige a sobreposição do frame |
| Preço secundário do card 3 ("2.29 ETH") | presente | ausente | a API tem um preço por edição, sem preço anterior |
| Paginação | 1 2 3 4 › | 1 2 … 6 › | a última página fica sempre a um clique; o total vem dos dados |
| Promoção 2: margem direita | 35 px (card 1: 30) | 30 px nos dois | alinha os dois cards |
| Botão "Explorar" das promoções | +164 do topo, sobre o parágrafo | +180 (30 px da base) | corrige a sobreposição do frame; abaixo de 1280 px o card cresce em vez de cortar o texto |
| Cards do blog | 268 px, meta em 2 linhas, card 369 px | 282 px (ocupam os 1200), meta em 1 linha, card 351 px | alinhamento à grade (decisão de layout acima) |
| Rodapé: coluna "Central de ajuda" | itens #F5F1EB | itens #CFB28C + selo "em breve" no título | itens sem destino não parecem links |

### Início mobile (414)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Pontos do hero | 3 × 7 px, 6 px entre eles | pílula de 20 px no ativo; passo de 24 px | estado não só por cor; alvo de 24 px |
| Abaixo de 360 px | artes de 138/58 px | 112/48 px, título em 16 px | o título continua legível em 320 px; o banner cresce em vez de cortar |
| Abas | 4 px entre "Todos os NFTs" e "Novos lançamentos", 16 px depois | 16 px entre todas | espaçamento uniforme |
| Nome longo no card | 1 linha (nomes curtos no frame) | quebra em 2 linhas quando não cabe (card 264 px) | nada cortado em 320–414 px |
| Coração do card | sempre preenchido | contorno quando não favoritado, preenchido quando favoritado | o estado precisa ser visível |
| Selo "RARO" | no card P-3 | ausente | as fixtures não têm raridade por NFT (as edições têm nome próprio no detalhe) |
| Barra inferior | já registrada acima (rótulos, sem "scan") | — | — |

### Detalhe desktop (1440)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Pontos de "Mais desta coleção" | 12 px, 8 px entre eles | 12 px, 12 px entre eles (passo de 24) | alvo de 24 px |
| Linha "Tiragem… disponíveis… máx." e selo do criador | — | presentes | já registrados acima; empurram stepper, botões e seções ~50 px para baixo |

### Detalhe mobile (414)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Pontos da galeria | atrás da arte (invisíveis), 3 pontos, 7 px entre eles | sobre a arte, 4 pontos, passo de 24 px | a galeria precisa ser visível e operável (4 vistas); alvo de 24 px |
| "Compartilhar este NFT" | ausente | ausente no mobile (só desktop/tablet) | igual ao frame |

## Fluxos (carrinho, pagamento, pedido, login, cadastro, conta): o que ainda difere do Figma

Medido no app (Chromium, área útil de 1440 e 414 px, mesmos itens e quantidades dos frames) contra `design/nodes`. Tudo o que não está aqui segue o valor do frame (diferença ≤ 2 px de posição/tamanho, ≤ 1 px de fonte, mesma cor, peso, raio e sombra): por exemplo o modal de login 500×600 e o de cadastro 500×656 com raio 8, os blocos do login mobile a 256/312/592/756 px, os raios de 3 px dos campos e botões do pagamento, do perfil e das carteiras, e o preço do recibo numa linha só. Diferenças que são consequência de outra não são repetidas.

### Regras comuns dos fluxos
- **Valores em ETH**: carrinho, pagamento, recibo e pedidos mostram o valor exato devolvido pela API (todas as casas decimais, sem arredondar nem truncar; só os zeros à direita saem), por exemplo `0.6703701 ETH`. Subtotal, desconto, taxa e total são sempre os da cotação; o total da linha do carrinho é o `lineTotal` da cotação (enquanto ela não chega, preço × quantidade com aritmética decimal exata). Os valores do Figma (`26.846 ETH`, `0.016 ETH`) são exemplos.
- **Campos**: raio de 3 px no pagamento, perfil e carteiras e de 5 px no modal de login/cadastro (10 px no mobile), como nos nós; a frase "raio de 5 px" do design system vale para o primitivo `Input`.
- **Botões nunca apagados em repouso**: "Aplicar" (cupom) e "Salvar carteira" ficam com a cor do frame mesmo sem nada para enviar; o envio vazio responde com uma mensagem ("Digite um código promocional.", "Nenhuma alteração para salvar.") em vez de um botão desabilitado, que no layout pareceria outro componente.
- **Header nas telas de conta**: nenhum item da navegação fica ativo em Perfil, Carteiras, Atividade e Lista de interesse. O frame copia o header do Início com "Início" ativo, mas o sublinhado indica a seção atual, e essas telas não são o Início (mesma regra do Carrinho e do Pagamento).
- **Rodapé**: aparece em Perfil, Carteiras, Confirmação e nas telas sem frame (os frames de 1080 px cortam a página no fim do conteúdo); só sai no Carrinho e no Pagamento mobile, cujos frames terminam no resumo.
- **Carregando**: rotas privadas mostram header, rodapé e o esqueleto da tela pedida enquanto a sessão é validada (antes ficava tudo vazio); os esqueletos têm as alturas finais (CLS medido com o cenário `slow`: 0 em perfil, pedidos e carrinho; 0,0099 no pagamento desktop).

### Carrinho desktop (1440)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Nome longo na linha | 1 linha | até 2 linhas, o ID desce | nomes das fixtures são maiores; não cortamos o nome |
| Desconto sem cupom | `(-) 00.00` | `(-) 0 ETH` | mesmo formato dos outros valores da cotação |
| "Colecionadores também viram" | 5 cards fixos | carrossel de 15 (3 páginas de 5) com os 3 pontos | os pontos passam a ter função; NFTs que não estão no carrinho |
| Pontos do carrossel | 12 px, 8 px entre eles | 12 px, passo de 28 px | alvo de toque de 24 px |
| Card recomendado | nome 15 px, preço 16 px | nome 16 px, preço 18 px | card único do catálogo (Layout, 1º item) |
| "Conectar e finalizar" antes da cotação | — | mesmo botão com `aria-disabled` | não leva ao pagamento sem totais |

### Carrinho mobile (414)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Linha da edição | "Edição: 1/50" | "Edição: Padrão" | o item do carrinho não tem número de série nem tiragem |
| Título | x 124 (14 px à direita do centro) | centralizado | o deslocamento é defeito do frame |
| Remover | só no item 3, sobre o "+" | em todos os cards, 24 px acima do stepper | remover é obrigatório e não pode sobrepor outro controle |
| Nome longo | 1 linha | até 2 linhas antes do stepper; o card cresce até ~6 px | o nome nunca passa por baixo do stepper |
| Em 320 px | — | arte de 80 px | o texto cabe sem encostar no stepper |
| Botão "Demo" | — | depois do painel de resumo | ferramenta da demonstração (ver "Painel Demo") |

### Pagamento desktop (1440)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| "ENS ou carteira secundária" + "Nome ENS" | dois campos, ambos obrigatórios | um "Nome ENS (opcional)" com sufixo `.eth` (78 px) e placeholder "seunome" | campo duplicado; ENS não pode ser exigido |
| Endereço e Tipo de carteira | digitáveis | somente leitura, da carteira selecionada (endereço completo no `title`) | requisito de usar as carteiras cadastradas |
| Opções de "Carteira e rede" | selo de marcas, MetaMask, Coinbase | as carteiras cadastradas: apelido + endereço curto, 45 px, raio 3 | o pagamento usa a carteira do usuário |
| Caixa "Carteira desconectada / Conectar carteira" | ausente | entre as opções e o CTA (o CTA desce ~140 px) | a conexão simulada é obrigatória e explícita |
| 2ª linha de "Seus NFTs" | "ID do token: #0042" | igual, mais " · Rara/Lendária" quando a edição não é a padrão | linhas do mesmo NFT em edições diferentes |
| "(x n)" | à esquerda do valor | abaixo do valor | o nome cabe na linha |
| Observação | textarea 350×152 | igual, sem alça de redimensionar | — |

### Pagamento mobile (414)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| "Carteira conectada" + cards + "Carteira e rede" com provedores | duas listas | uma lista "Carteira e rede" com as carteiras cadastradas (cards de 93 px do frame) | as carteiras vêm do cadastro; não há provedor genérico |
| Menu ⋮ dos cards | presente | ausente | sem ação no escopo (editar carteira fica em Carteiras, via "Trocar carteira") |
| Total + CTA | soltos no fim da tela | barra fixa com "Total:" 16/18 px e o CTA de 358×60 com o gradiente do frame | o total e a confirmação ficam sempre à vista; o foco nunca fica sob a barra |
| Dados do colecionador, itens e resumo | fora do frame (896 px) | abaixo de "Carteira e rede" | dados obrigatórios do pedido |

### Confirmação de pedido (1440)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Fundo | página coberta, só o modal | rota com header e rodapé, cartão em y 166 | acesso direto e refresh |
| Data | "29 Jul, 2026" | "26 nov. 2026" | formato pt-BR |
| Carteira | "MetaMask" | endereço curto | o recibo guarda o endereço |
| Totais | Taxa + Total | Subtotal, Desconto (se houver), Taxa, Total | o recibo mostra a cotação inteira |
| Abaixo de "Ver no Etherscan" | — | "Referência simulada…" | o hash não existe na rede real |
| Altura do cartão | 821 | ~860 (uma linha a mais nos totais e a nota) | consequência das duas linhas acima |
| Mobile (sem frame) | — | o mesmo cartão em coluna, quantidade e valor sob o nome | derivado do desktop |

### Login e Cadastro (1440 e 414)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Fundo do modal desktop | Início inteiro, sem escurecer | hero do Início escurecido 60% | foco no diálogo (Layout) |
| Estado inicial | senha preenchida e focada | e-mail focado, campos vazios | estado real de abertura |
| "Esqueceu a senha?" e login social | ativos | opacidade 70% + "(em breve)" | fora do escopo |
| Olho em "Confirmar senha" (cadastro desktop) | ausente | presente | igual ao frame mobile; mostrar a senha vale para os dois campos |
| Dica da senha | ausente | lida por leitores de tela; visível só sob o erro | regra conhecida sem deslocar a grade |
| Botão X no mobile | ausente | glifo de 18 px no canto | saída por toque (Esc só existe com teclado) |
| Link "Crie uma conta" / "Entre" | linha inteira #CFB28C | mesma cor, link sublinhado | link identificável sem depender de cor |
| Cadastro mobile: título/botão | "Criar perfil de colecionador" / "Criar perfil" | "Criar conta" nos dois | igual à aba e ao botão do desktop |
| Cadastro mobile: placeholder "Nome de usuário" | centralizado | à esquerda | o centralizado é defeito (os outros campos são à esquerda) |

### Perfil do colecionador (1440; mobile derivado)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Nome ENS | label com *, select ".eth" com seta | "(opcional)", sufixo fixo ".eth" de 78 px | ENS opcional; só existe `.eth` |
| Apelido da carteira | com * | sem * | só é editável quando há carteira principal |
| Ícone do avatar vazio | Iconly "Image 2" | lucide "image-plus" de 24 px | o asset não foi exportado do arquivo |
| "Remover" | sempre | só com avatar enviado | não há o que remover |
| Placeholder da nova senha | vazio | "Mín. 8, letras e números" | regra visível antes do erro |
| Menu: itens "em breve" | opacidade 100% | 60% + "(em breve)" | sem destino no escopo |
| Abaixo de 1024 px | — | menu em abas roláveis, campos em 1 coluna | derivado do desktop |

### Carteiras (1440; mobile derivado)
| Elemento | Figma | Adotado | Motivo |
| --- | --- | --- | --- |
| Campos | 10 (repete o perfil) | Apelido, Tipo, Endereço, Redes | dados do perfil ficam no Perfil; "ENS ou carteira secundária" vira a carteira secundária própria |
| Rede | select | "Redes": 4 caixas de seleção | a carteira tem várias redes no contrato |
| "Igual à carteira principal" | rádio | ausente | a API recusa endereço repetido |
| "Adicionar" do topo | sempre | só sem carteira secundária | com as duas, não há o que adicionar |
| Secundária cadastrada | — | formulário próprio + "Tornar principal" | requisito de editar e promover |

### Atividade (`/orders`) e Lista de interesse (sem frame)
- Derivadas do menu da conta. Pedidos: em < 640 px o texto ocupa a linha inteira e total e status vão para a linha de baixo. Favoritos: cards do catálogo.
