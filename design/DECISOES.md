# Decisões de design (líder)

O Figma tem inconsistências (apontadas nos 70 comentários do arquivo original, ver `COMMENTS.md`; nenhum foi respondido pela empresa). Regra geral: **preservar a identidade** (cores, tipografia Roboto Mono, espaçamentos, composição, marca KURIO, tema escuro único) e **corrigir defeitos evidentes**, registrando cada desvio para o `ARCHITECTURE.md`. Quem implementar uma tela acrescenta aqui os desvios que fizer (tela, o que mudou, por quê).

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
- Pagamento: primeira opção de carteira é WalletConnect (como no mobile). No mobile, os dados do colecionador também são exigidos, em seção anterior à carteira.
- Pedido pendente e recusado: mesmo padrão visual da confirmação, com ícone, texto e ações próprios; o recibo só aparece no confirmado.
- Ícones informativos no lugar das letras dos destaques do Início (lucide, equivalente aos sugeridos).
