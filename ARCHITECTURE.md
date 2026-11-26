# Arquitetura

Este documento descreve como a aplicação é organizada, os contratos entre as camadas, as políticas de sessão, carrinho, checkout, cache e tempo real, a camada de mocks, as decisões de UX e os desvios do layout do Figma. Instruções de execução e roteiros de reprodução estão no [README.md](./README.md).

## 1. Visão geral e camadas

```
UI (features/*/components, shared/ui)  ->  hooks de feature (useCart, useCheckout...)  ->  features/*/api.ts
                                                       |                                        |
                                              TanStack Query (cache)                  shared/api (Axios + Zod)
                                                       ^                                        |
                                shared/realtime (socket.io-client + EventGuard)          REST  /api/*   Socket.IO
                                                                                               |
                                                      src/mocks  (MSW: handlers REST + servidor Socket.IO simulado)
```

| Camada | Pasta | Responsabilidade |
| --- | --- | --- |
| Contratos | `src/contracts` | Schemas Zod de requisições, respostas, erros e eventos, mais o mapa `endpoints`. É a única fonte de verdade de tipos e é importada pelo app **e** pelos mocks. |
| Transporte | `src/shared/api` | Uma instância Axios (`http.ts`): URL base, token, cabeçalho do carrinho, timeout de 15 s, normalização de qualquer falha em `ApiError` e validação do corpo da resposta contra o schema (`request(schema, config)`). |
| Estado de servidor | TanStack Query | Cache, mutations, otimismo, invalidação; chaves em `shared/api/query-keys.ts`. |
| Roteamento | TanStack Router (`src/routes`) | Rotas por arquivo com code-splitting, search params validados (Zod), guarda `_authenticated`, 404 e fronteira de erro. |
| Tempo real | `src/shared/realtime` | Cliente Socket.IO por sessão, filtragem de duplicatas/versões antigas, aplicação dos eventos no cache, reconciliação com REST. |
| Features | `src/features/*` | Hooks e telas de cada domínio (auth, catalog, nft, cart, checkout, orders, favorites, profile, wallets, account, demo). Nenhuma feature contém respostas fictícias. |
| Mocks | `src/mocks` | Backend simulado na camada de rede (MSW), carregado só quando `VITE_ENABLE_MOCKS=true`, com import dinâmico. |

Princípios: a interface só observa o resultado das operações (REST) e dos eventos (Socket.IO); nada na UI, nos hooks ou no cliente Axios simula negócio; valores monetários nunca viram `number`; os totais exibidos vêm da cotação do servidor.

Rotas: `/` (catálogo), `/nft/$nftId`, `/cart`, `/login`, `/register`; área privada `_authenticated`: `/checkout`, `/orders`, `/orders/$orderId`, `/account/profile`, `/account/wallets`, `/account/favorites`. Rotas inexistentes renderizam a página 404; recurso inexistente (NFT, pedido) tem tela própria; erros de carregamento caem na fronteira de erro com "Tentar novamente". O arquivo `vercel.json` reescreve rotas para `index.html` (acesso direto e refresh) e define cache `immutable` para `/assets/*`.

Search params do catálogo (`/`): `q`, `category` (lista separada por vírgula), `minPrice`, `maxPrice`, `availability`, `featured`, `recent`, `sort`, `page`. Cada valor é validado com fallback (`.catch`) para o padrão, os padrões são removidos da URL (`stripSearchParams`), e a consulta à API é derivada só da URL: mesma URL, mesma chave de cache, mesma requisição. Por isso o histórico do navegador restaura filtros, ordenação e página.

## 2. Contratos REST

Base: `/api` (`VITE_API_URL`). Autenticação: `Authorization: Bearer <token>`. Visitantes enviam `X-Cart-Id: guest_<uuid>`. Todas as respostas 2xx são validadas com os schemas de `src/contracts`; quem não casa vira `ApiError` de tipo `invalid_response`.

### Formato de erro

Toda resposta não-2xx usa o envelope:

```json
{ "error": { "status": 409, "code": "availability_conflict", "message": "...", "fieldErrors": { "email": ["..."] }, "retryable": false, "details": { } } }
```

`fieldErrors` usa notação de ponto (`collector.email`); `retryable` é `true` para 5xx; `details` é específico do código (`issues` em `availability_conflict`; `quote` em `quote_outdated`).

| Status | Códigos | Significado |
| --- | --- | --- |
| 400 | `bad_request`, `idempotency_key_required` | Requisição malformada (JSON inválido, `X-Cart-Id` ausente, chave de idempotência ausente) |
| 401 | `invalid_credentials`, `unauthorized`, `session_expired` | Sessão ausente, inválida ou expirada |
| 403 | `forbidden` | Autenticado, sem permissão (ex.: pedido ou carteira de outro usuário) |
| 404 | `not_found` | Recurso inexistente |
| 409 | `availability_conflict`, `email_conflict`, `idempotency_conflict`, `quote_outdated`, `wallet_conflict`, `wallet_not_connected` | Conflito de estado |
| 422 | `validation_error`, `coupon_invalid`, `coupon_expired`, `wallet_rejected` | Validação semântica (com `fieldErrors`) |
| 5xx | `server_error`, `service_unavailable` | Falha transitória |

No cliente, `ApiError` classifica a falha em `kind`: `http`, `network` (sem resposta), `timeout`, `canceled` (abortada por `AbortSignal`, nunca exibida) e `invalid_response`. `isTransient` = rede, timeout ou 5xx (é isso que habilita retry de consultas).

### Sessão e conta

| Método | Rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | `{ name, email, password, guestCartId? }` | 201 `Session` `{ token, expiresAt, user }` | 409 `email_conflict`; 422 `validation_error` |
| POST | `/auth/login` | `{ email, password, guestCartId? }` | 200 `Session` | 401 `invalid_credentials`; 422 |
| GET | `/session` | , | `{ expiresAt, user }` (sem token) | 401 `unauthorized` / `session_expired` |
| POST | `/auth/logout` | , | 204 | 401 |

### NFTs

| Método | Rota | Corpo / query | Resposta | Erros |
| --- | --- | --- | --- | --- |
| GET | `/nfts` | `q`, `category` (repetido), `minPrice`, `maxPrice`, `availability` (`all` \| `available` \| `sold_out`), `featured`, `recent`, `sort` (`newest`, `oldest`, `price_asc`, `price_desc`, `name_asc`, `name_desc`), `page`, `pageSize` (1 a 48) | `{ items: Nft[], page, pageSize, total, totalPages }` | 422 (consulta inválida) |
| GET | `/nfts/:id` | , | `Nft` | 404 |

`Nft`: `id`, `name`, `description`, `category` (`art`, `gaming`, `music`, `photography`, `collectibles`, `sports`), `creator`, `images[]`, `editions[]` (`id`, `name`, `price`, `supply`, `available`, `maxPerOrder`), `featured`, `minPrice`, `totalAvailable`, `createdAt`, `version`. Filtros combinam por E (categorias por OU); a faixa de preço se aplica a `minPrice`; `recent` considera os últimos 30 dias contados a partir da listagem mais nova (fixtures determinísticas).

### Favoritos (autenticado)

| Método | Rota | Resposta | Erros |
| --- | --- | --- | --- |
| GET | `/favorites` | `{ nftIds: string[] }` | 401, 403 |
| PUT | `/favorites/:nftId` | `{ nftIds }` (idempotente) | 401, 404 |
| DELETE | `/favorites/:nftId` | `{ nftIds }` | 401 |

### Carrinho e cotação

Visitante: `X-Cart-Id`; autenticado: carrinho da conta.

| Método | Rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- | --- |
| GET | `/cart` | , | `Cart` `{ id, items[], updatedAt, version }` | 400 (visitante sem `X-Cart-Id`) |
| POST | `/cart/items` | `{ nftId, editionId, quantity }` (soma à linha existente) | `Cart` | 404; 409 `availability_conflict` |
| PATCH | `/cart/items/:itemId` | `{ quantity }` | `Cart` | 404; 409 `availability_conflict` ao aumentar |
| DELETE | `/cart/items/:itemId` | , | `Cart` | 404 |
| POST | `/quotes` | `{ network, couponCode? }` | `Quote` | 422 `coupon_invalid` / `coupon_expired` |

`CartItem` traz `unitPrice` (preço atual), `addedUnitPrice` (preço quando foi adicionado), `available` e `maxPerOrder`. `Quote`: `id`, `fingerprint`, `cartVersion`, `lines[]`, `coupon`, `network`, `subtotal`, `discount`, `networkFee`, `total`, `issues[]` (`sold_out`, `insufficient_availability`), `createdAt`, `expiresAt` (10 min). A taxa de rede é fixa por rede (Ethereum 0,0025; Polygon 0,0001; Arbitrum 0,0004; Base 0,0003 ETH) e o desconto é percentual sobre o subtotal.

### Pedidos (autenticado)

| Método | Rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- | --- |
| POST | `/orders` | `{ quoteId, quoteFingerprint, walletId, network, collector }` + cabeçalho `Idempotency-Key` | 201 `Order` `pending`; 200 com o mesmo `Order` se a chave já foi usada com o mesmo corpo | 400 `idempotency_key_required`; 409 `idempotency_conflict` (mesma chave, corpo diferente), `wallet_not_connected` (a carteira do pedido não está conectada na rede do pedido nesta sessão), `quote_outdated` (com `details.quote`), `availability_conflict` (com `details.issues` e `details.quote`); 422 (`walletId` que não é do usuário, rede que a carteira não opera) |
| GET | `/orders` | , | `{ items: Order[] }` (mais recentes primeiro) | 401 |
| GET | `/orders/:id` | , | `Order` | 404; 403 (pedido de outro usuário) |

`Order`: `id`, `status` (`pending`, `confirmed`, `rejected`), `receipt`, `transaction` (`hash`, `explorerUrl`, só em confirmados), `rejectionReason`, `createdAt`, `updatedAt`, `version`. `confirmed` e `rejected` são terminais.

### Perfil (autenticado)

| Método | Rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- | --- |
| GET | `/profile` | , | `Profile` (`id`, `name`, `email`, `username`, `ensName`, `bio`, `avatarUrl`) | 401 |
| PATCH | `/profile` | `{ name, email, username, ensName, bio }` | `Profile` | 409 `email_conflict`; 422 |
| PUT | `/profile/avatar` | `{ dataUrl }` (PNG/JPEG/WebP em data URL, até ~1 MB; `null` remove) | `Profile` | 422 |
| POST | `/profile/password` | `{ currentPassword, newPassword }` | 204 (revoga as outras sessões do usuário) | 422 (`fieldErrors.currentPassword`, `newPassword`) |

### Carteiras (autenticado)

| Método | Rota | Corpo | Resposta | Erros |
| --- | --- | --- | --- | --- |
| GET | `/wallets` | , | `{ items: Wallet[] }` (principal primeiro) | 401 |
| POST | `/wallets` | `{ label, address, provider, role, networks }` | 201 `Wallet` | 409 `wallet_conflict` (papel já ocupado ou endereço repetido); 422 |
| PATCH | `/wallets/:id` | campos parciais; promover a `primary` rebaixa a principal atual | `Wallet` | 403/404; 409; 422 |
| POST | `/wallets/:id/connect` | `{ network }` | `{ walletId, network, connectedAt }` (conexão simulada, registrada no servidor) | 422 `wallet_rejected` (recusa na carteira; a sessão fica sem carteira conectada) ou `validation_error` (rede não suportada); 403/404 |
| DELETE | `/wallets/:id/connect` | , | 204 (desconecta, se for a carteira conectada) | 403/404 |

Cada usuário tem uma carteira principal e, no máximo, uma secundária.

**Conexão de carteira.** O servidor guarda **uma conexão por sessão** (token), como uma carteira de navegador, que expõe uma conta em uma rede por vez: conectar outra carteira ou rede substitui a anterior, uma recusa (`wallet_rejected`) ou o `DELETE` a remove, e ela termina com a sessão (logout, expiração, novo login). `POST /orders` só cria o pedido se a carteira do corpo for do usuário, operar na rede escolhida e estiver conectada **nessa rede, nesta sessão**; caso contrário responde 409 `wallet_not_connected`, antes de qualquer outra verificação de estado. O cliente espelha esse estado (`useWalletConnection`): "Desconectar carteira" chama o `DELETE`, e um 409 `wallet_not_connected` (por exemplo, a carteira desconectou do lado dela, simulado por `window.__mocks.disconnectWallets()`) fecha a revisão, marca a carteira como desconectada e mostra a mensagem no campo da carteira. Não há endpoint de leitura da conexão: depois de um refresh o checkout pede para conectar de novo. A recuperação de uma tentativa de compra já enviada (mesma `Idempotency-Key`) não depende da conexão, porque o servidor devolve o pedido existente antes dessa verificação.

## 3. Eventos Socket.IO

Servidor: caminho `/socket.io/`, namespace padrão, transporte `websocket`. A conexão envia `auth: { token }` no pacote CONNECT (`token: null` = visitante, só recebe eventos públicos). Token inválido recebe `connect_error` com a mensagem `unauthorized`, o que dispara o fluxo de sessão expirada.

Todo evento carrega `eventId` (identidade estável, `evt_000123`), `type`, `resource` (`{ type, id }`), `version` (versão do recurso após a mudança), `occurredAt` e `data` (snapshot completo do recurso naquela versão).

| Evento | Destino | Payload | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | Todos os sockets (dados públicos) | `{ eventId, type, resource: { type: 'nft', id }, version, occurredAt, data: Nft }` | Atualiza detalhe e listas em cache; invalida listas (marcadas como obsoletas, sem refetch imediato) e refaz o carrinho/cotações que referenciam o NFT; anuncia a mudança quando há item afetado no carrinho |
| `order.updated` | Só o socket do dono do pedido | `{ eventId, type, resource: { type: 'order', id }, userId, version, occurredAt, data: Order }` | Atualiza `['user', userId, 'orders', orderId]`, invalida a lista de pedidos e, se `confirmed`, o carrinho; anuncia "Pagamento confirmado" ou "Pagamento recusado" |

### Deduplicação e ordenação

Cada payload é validado com Zod (inválidos são descartados com `console.warn`) e passa por um `EventGuard`, um por conexão:

- **Duplicata**: `eventId` já visto (memória limitada a 1.000 ids) é ignorado.
- **Antigo**: `version` menor ou igual à maior já vista para `resource.type:resource.id` é ignorado.
- O guard é criado e descartado junto com a conexão, então uma nova sessão começa limpa.
- Ao escrever no cache, a versão também é comparada com a do dado em cache (`newer()`): o cache nunca regride.
- Em `order.updated`, `userId` diferente do usuário da conexão é descartado (defesa em profundidade além da entrega seletiva do servidor).
- Os efeitos de interface (avisos) são disparados depois da aplicação no cache e só para eventos aceitos, de modo que duplicatas não repetem efeitos.

## 4. Reconciliação REST × Socket.IO

- O socket usa reconexão automática com atraso de 300 ms dobrando até 2 s, sem variação aleatória (`randomizationFactor: 0`), e `timeout` de 4 s por tentativa de conexão (`realtime-client.ts`), de modo que o tempo de recuperação é limitado e reproduzível. O status (`connecting`, `connected`, `reconnecting`, `unauthorized`, `idle`) é exposto no rodapé com texto e ícone (`data-status` para testes); só a conexão mais recente atualiza o status.
- Em cada `reconnect`, o cliente chama `queryClient.invalidateQueries()`: tudo que está ativo (catálogo, detalhe, carrinho, cotação, pedidos) é refeito por REST, o que cobre eventos perdidos enquanto estava offline. Consultas inativas ficam obsoletas e refazem na próxima montagem.
- O pedido (`orders/$orderId`) também é reconciliado por REST na montagem da tela (acesso direto, refresh) e no foco da janela, e, enquanto está `pending`, por polling a cada 3 s (`PENDING_ORDER_POLL_MS` em `use-order.ts`): mesmo que o `order.updated` se perca sem queda perceptível do socket, a tela chega ao estado final. A função de consulta nunca devolve uma versão menor que a já recebida por evento.
- Eventos e REST convergem porque, no mock, toda mutação de NFT ou pedido passa pelo mesmo caminho do banco (`mutateNft`/`mutateOrder`), que incrementa a versão, persiste e emite o evento.
- Listeners e conexões: `RealtimeProvider` cria uma conexão por `(token, userId)` e a destrói (remove listeners, desconecta, limpa o guard) ao trocar de usuário, no logout ou na desmontagem; os hooks de aviso (`onRealtimeNotice`) removem seus listeners ao desmontar.
- Pedido pendente com a conexão interrompida: o estado é recuperado após a reconexão ou recarga, via REST, sem criar nova compra (a tentativa de compra é idempotente, ver seção 7).

## 5. Política de sessão

- **Armazenamento**: apenas o token opaco (`nft.session.token`) e o id do carrinho de visitante (`nft.cart.guestId`) ficam em `localStorage`. O usuário é sempre recuperado por `GET /session`, nunca lido do armazenamento. A consulta da sessão tem a chave `['session', token]`, então um novo login nunca lê a sessão anterior.
- **Duração e expiração**: o servidor simulado emite sessões de 2 h. Um 401 em requisição que enviou token (interceptor do Axios) ou a rejeição do handshake do socket emite `session:expired`. O `SessionProvider` (tratado uma vez por sessão, mesmo com várias requisições falhando) limpa o token e os dados privados, avisa "Sua sessão expirou." e, em rota privada, redireciona para `/login?redirect=<local atual>&reason=expired`; em rotas públicas, a navegação continua como visitante e as consultas são refeitas. Um 401 de login com senha errada não é tratado como expiração.
- **Falha ao validar a sessão**: se `GET /session` falha por rede, timeout ou 5xx, a consulta segue a política geral (até 2 novas tentativas com atraso exponencial). Persistindo a falha, a sessão fica em estado `error` (o token é mantido; só um 401 encerra a sessão): o header troca "Entrar"/menu por "Tentar novamente", o carrinho mostra "Não foi possível carregar o carrinho" com "Tentar novamente" (o dono do carrinho é desconhecido, então nenhum carrinho é exibido) e as rotas privadas caem na fronteira de erro, cujo "Tentar novamente" refaz o `beforeLoad`.
- **Guarda de rota**: `_authenticated` valida a sessão no `beforeLoad` (via cache, no máximo um `GET /session` por token) e redireciona para `/login?redirect=...&reason=required|expired`. `redirect` só aceita caminhos internos (sem `//host`, sem esquema, sem voltar para `/login` ou `/register`), evitando redirecionamento aberto.
- **Retomada**: depois de autenticar, o usuário volta ao destino. O rascunho do formulário de checkout e a tentativa de compra pendente ficam em `sessionStorage` por usuário (`nft.user.<userId>.*`) e são retomados.
- **Login/cadastro**: `startSession` descarta cache privado, carrinhos, avisos e armazenamento de outros usuários, gira o id do carrinho de visitante (o carrinho foi fundido no servidor) e só então publica o novo token.
- **Logout** (e expiração): `endSession` remove o token, gira o id de visitante, limpa as consultas `user`, `cart`, `session` e `checkout`, os estados de mutations e os avisos, e apaga todo o armazenamento por usuário. O socket é recriado como visitante. A revogação no servidor é feita em melhor esforço.
- **Isolamento por usuário**: chaves de cache privadas começam com `['user', userId]`; o carrinho é chaveado por usuário ou por id de visitante; o `SessionProvider` ainda remove consultas do usuário anterior quando o id muda; o socket e o `EventGuard` são por sessão; o cupom aplicado, o rascunho e a tentativa de compra ficam em `sessionStorage` com o id do usuário. O E2E "troca de usuário" verifica que nenhum dado, evento ou armazenamento do usuário anterior vaza.

## 6. Estado do carrinho

- **Servidor como fonte**: o carrinho vive no backend simulado (conta ou visitante por `X-Cart-Id`) e sobrevive a refresh; o cliente só cacheia (`['cart', 'user:<id>' | 'guest:<id>']`). Enquanto uma sessão guardada é validada, o carrinho fica "desconhecido" para não exibir por um instante o carrinho de visitante.
- **Fusão no login/cadastro**: o cliente envia `guestCartId`; o servidor soma as quantidades das linhas iguais (limitadas ao máximo permitido), descarta o carrinho de visitante e o cliente passa a usar um novo id de visitante.
- **Otimista com rollback**: adicionar, alterar a quantidade e remover itens atualizam o cache imediatamente (`onMutate` cancela consultas do carrinho, guarda o snapshot); em erro, o snapshot é restaurado e um aviso explica a falha; ao final, as cotações são invalidadas e o carrinho é refeito quando não há outra mutation do carrinho em andamento. Respostas do servidor só entram no cache se a `version` não for menor que a existente (respostas fora de ordem). Os limites (disponibilidade e máximo por pedido) são verificados antes da chamada.
- **Preço e disponibilidade**: cada item mostra `unitPrice` atual contra `addedUnitPrice`, com ícone e texto quando mudou, e sinaliza esgotado ou acima do disponível. Eventos `nft.updated` refazem o carrinho e uma notificação descreve a mudança.
- **Cupom**: é estado do cliente (a requisição de cotação o carrega), guardado por dono do carrinho em `sessionStorage`. Só é guardado depois que `POST /quotes` o valida; `coupon_invalid` e `coupon_expired` têm mensagens distintas; um cupom que deixa de ser válido é removido com aviso.
- **Cotação** (`POST /quotes`): fonte autoritativa de subtotal, desconto, taxa e total (nunca recalculados no cliente). `staleTime: 0`, invalidada por mutations do carrinho e por eventos; durante o recálculo, a cotação anterior continua visível com `isUpdating` verdadeiro (o checkout não confirma uma cotação em atualização). A cotação contém `fingerprint` (conteúdo: linhas, preços, cupom, rede e taxa).

## 7. Checkout e pedidos

1. **Revisão**: o formulário (dados do colecionador, carteira, rede) é validado com o mesmo schema dos contratos; a carteira precisa estar conectada (`POST /wallets/:id/connect`) para a rede escolhida, regra que o servidor também aplica na criação do pedido (409 `wallet_not_connected`, ver "Conexão de carteira" na seção 2). "Confirmar compra" abre o diálogo de revisão com o total da cotação, e o `fingerprint` exibido vira o aceito pelo usuário.
2. **Bloqueio por cotação desatualizada**: se a cotação mudar depois da revisão (evento `nft.updated`, cupom, rede, revalidação), o botão fica bloqueado até "Aceitar novos valores". Motivos de bloqueio: cotação em atualização, alterada, com problemas (esgotado/insuficiente), carteira desconectada, carrinho vazio.
3. **Revalidação**: ao confirmar, uma nova cotação é pedida (`staleTime: 0`); se o `fingerprint` diferir do aceito, nada é enviado e os novos valores são exibidos. O servidor repete a verificação: cotação expirada ou fingerprint diferente retorna 409 `quote_outdated` com a cotação atual; estoque insuficiente retorna 409 `availability_conflict`; nesses casos a cotação nova entra no cache.
4. **Idempotência**: antes de enviar, a tentativa (`Idempotency-Key` = `order_<uuid>` e o corpo exato) é gravada em `sessionStorage` por usuário. Cliques repetidos durante o envio são ignorados. Em timeout, erro de rede, 5xx ou sessão expirada, a tentativa é mantida e uma ação explícita do usuário reenvia a mesma chave e o mesmo corpo, e o servidor devolve o mesmo pedido (200). Mesma chave com corpo diferente gera 409 `idempotency_conflict`. Mutations nunca sofrem retry automático (`retry: 0`). A tentativa só é apagada quando há resposta definitiva.
5. **Estados do pedido**: o servidor cria o pedido `pending` (201), reserva o estoque e o resolve depois de 2,5 s (ou manualmente, conforme o cenário): `confirmed` (gera hash de transação simulado e remove do carrinho só as quantidades compradas) ou `rejected` (devolve o estoque reservado, mantém o carrinho). A confirmação só aparece quando o servidor simulado responde `confirmed`, por REST ou por `order.updated`; terminais não mudam mais. Pedidos pendentes retomam a resolução quando os mocks reiniciam.
6. **Recibo-snapshot**: `receipt` é gravado na criação (linhas, cupom, subtotal, desconto, taxa, total, rede, endereço da carteira, dados do colecionador) e nunca é alterado por mudanças posteriores do catálogo.
7. **Tela do pedido** (`/orders/$orderId`): acesso direto e refresh funcionam; `/orders` lista os pedidos do usuário (Atividade).

## 8. Estratégia de cache

Valores reais de `src/shared/api/query-client.ts` e dos hooks:

| Item | Valor |
| --- | --- |
| `staleTime` padrão | 30 s (o catálogo é mantido fresco por `nft.updated`; mutations e eventos invalidam explicitamente) |
| `gcTime` padrão | 5 min (voltar/avançar reaproveita dados) |
| Retry de consultas | Nunca em 4xx, cancelamento ou resposta inválida; até 2 tentativas em falhas transitórias (rede, timeout, 5xx), com atraso exponencial `min(500 * 2^n, 4000)` ms |
| Retry de mutations | `0`. Pedido só é reenviado por ação do usuário, com a mesma chave |
| `refetchOnWindowFocus` / `refetchOnReconnect` | ligados (reconciliação barata) |
| Sessão (`['session', token]`) | `staleTime` 5 min |
| Cotação | `staleTime: 0`, `placeholderData: keepPreviousData` |
| Contagem por coleção (filtros do catálogo) | `staleTime` 5 min; uma requisição `pageSize=1` por categoria (não há endpoint de facetas) |
| Lista do catálogo | `placeholderData: keepPreviousData` (página anterior visível durante o carregamento) |
| Detalhe do NFT | `placeholderData` a partir de qualquer página de lista em cache (detalhe instantâneo); `retryOnMount: false`, porque o loader da rota já busca a cada navegação (um 404 é pedido uma única vez) |
| Timeout do Axios | 15 s |

**Chaves**: `['nfts','list',query]`, `['nfts','detail',id]`, `['user',userId,'favorites'|'profile'|'wallets'|'orders'|'orders',orderId]`, `['cart', owner]` e `['cart', owner, 'quote', request]`, `['session', token]`.

**Cancelamento de respostas obsoletas**: toda consulta recebe o `AbortSignal` do TanStack Query e o repassa ao Axios; ao mudar a chave (novo filtro, página), a requisição anterior é abortada e uma resposta tardia não sobrescreve a atual. Antes de atualizações otimistas, `cancelQueries` evita que uma consulta em voo sobrescreva o estado otimista. O cenário `out-of-order` exercita isso.

**Invalidações por mutation**: carrinho (adicionar/alterar/remover) invalida as cotações e o próprio carrinho; favoritos (otimista) invalida a lista quando não há outra alternância pendente; criação de pedido grava o pedido no cache e invalida a lista de pedidos; login e logout limpam tudo que é privado.

**Invalidações por evento**: `nft.updated` grava o snapshot no detalhe e nas listas (se mais novo), marca as listas como obsoletas sem refetch (`refetchType: 'none'`) e refaz carrinho/cotações que referenciam o NFT; `order.updated` grava o pedido, invalida a lista de pedidos e, se confirmado, o carrinho; reconexão invalida todas as consultas.

## 9. Mocks

**Arquitetura.** MSW 3 intercepta REST pelo Service Worker (`public/mockServiceWorker.js`) e WebSocket por interceptação na página. `src/mocks/browser.ts` registra os handlers (`handlers/auth.ts`, `catalog.ts`, `cart.ts`, `orders.ts`, `account.ts`) e o servidor Socket.IO simulado (`realtime.ts`). Todos os handlers passam por `route()` (`handlers/utils.ts`), que aplica os comportamentos transversais dos cenários (latência, offline, 5xx, flaky, sessão expirada, 403), autentica pelo token Bearer e converte `MockHttpError` no envelope de erro. Contratos (schemas e `endpoints`) são os mesmos do app. A ativação é por `VITE_ENABLE_MOCKS=true`, com `import()` dinâmico antes da renderização (o app só cria o cliente Socket.IO depois que o MSW iniciou).

**Persistência e reset.** Um banco único em memória (`db/store.ts`) é persistido em `localStorage` (`nft-mocks:db:v4`), então refresh preserva usuários, carrinhos, pedidos, favoritos e conexões de carteira. `resetDb()` reconstrói o estado semente exato: 48 NFTs determinísticos (gerador com semente fixa, 6 categorias, preços de 0,0042 a 12,5 ETH, 1 a 3 edições, NFTs esgotados e com uma edição esgotada), 2 usuários, carteiras, cupons e favoritos iniciais. Ids são sequenciais e persistidos. Toda mutação de NFT ou pedido passa por `mutateNft`/`mutateOrder`, que incrementam a versão e notificam o servidor Socket.IO: REST e eventos nunca divergem. Reset: `?mocks=reset`, botão do painel Demo ou `window.__mocks.reset()` (volta também ao cenário `default`).

**Cenários.** Lista completa com efeitos no [README.md](./README.md#seleção-e-reset-de-cenários). A seleção persiste em `localStorage` (`nft-mocks:scenario`); cenários de uso único registram o consumo (`nft-mocks:scenario-consumed`). Latências seguem sequências fixas indexadas pelo contador de requisições. `window.__mocks` expõe o controle (alterar NFT, resolver pedido, expirar sessões, desconectar carteiras, repetir evento, emitir evento antigo, derrubar/restaurar o socket); ele só atua no servidor simulado, nunca no cache ou na interface. O painel Demo (`features/demo`, carregado sob demanda e visível só com mocks ativos) usa essa mesma superfície.

**Transporte do Socket.IO simulado e limitações.** O servidor usa `ws.link` do MSW e `@mswjs/socket.io-binding` (codificação Engine.IO/Socket.IO). O cliente é o `socket.io-client` real. Limitações tratadas ou aceitas:

- **Só `websocket`**: sem HTTP long-polling; o cliente força `transports: ['websocket']`.
- **Sem namespaces nem rooms**: apenas o namespace padrão; a entrega por usuário é feita guardando o usuário autenticado de cada conexão (`order.updated` só vai ao dono; `nft.updated` a todos).
- **Ping emulado**: o binding responde ao handshake, mas não envia pings; sem eles o cliente encerraria por "ping timeout" em ~30 s. O mock envia um ping do Engine.IO (`2`) a cada 20 s.
- **Token lido do frame bruto**: o binding confirma o CONNECT imediatamente e só decodifica pacotes EVENT; o `auth` é lido do frame `40{...}`. Token inválido recebe `44{"message":"unauthorized"}`, que gera `connect_error`.
- **Import dinâmico do cliente**: o engine.io-client captura `globalThis.WebSocket` quando o módulo é avaliado; um import estático pegaria o WebSocket nativo antes de o MSW instalar a interceptação. Por isso `socket.io-client` só é importado com `import()` depois de `worker.start()`.
- **Prefixo do caminho**: o MSW remove `/socket.io/` da URL antes de casar, então o `ws.link` aponta para a origem. Conexões sem o parâmetro `EIO` (por exemplo, o HMR do Vite em desenvolvimento) são repassadas ao servidor real.
- O banco e o servidor vivem na aba do navegador (a página que executa o Service Worker e a interceptação): não há eventos entre abas diferentes.
- `peerDependencies`: o binding declara `msw ^2`; funciona com MSW 3 (validado pelo E2E), por isso o `.npmrc` com `legacy-peer-deps`.
- Hashes de senha são SHA-256 com sal (Web Crypto) apenas para fins de simulação; nada disso é segurança real.

## 10. Precisão de ETH

Valores em ETH trafegam como **strings decimais** (regex `^\d+(\.\d{1,18})?$`, até 18 casas, precisão de wei) e nunca viram `number`. Toda aritmética está em `shared/lib/eth.ts` (soma, subtração, multiplicação por inteiro, percentual, comparação) com **big.js** em uma construtora isolada: 18 casas, arredondamento para baixo e sem notação exponencial. A formatação (`formatEth`) trabalha direto sobre a string, trunca (nunca arredonda para cima) e mostra `< 0.0001 ETH` para valores menores que a precisão exibida, em vez de um `0` enganoso. Mocks e cliente usam as mesmas funções.

## 11. Acessibilidade

O que foi feito:

- Link "Pular para o conteúdo" e `<main id="conteudo" tabIndex={-1}>`; navegação completa por teclado com foco visível (anel `focus-visible` em todos os controles).
- Diálogos e gavetas (login/cadastro, revisão da compra, filtros e menu no mobile, painel Demo, imagem ampliada) usam Radix: foco preso, `Esc` fecha, foco devolvido ao gatilho.
- Formulários com React Hook Form e Zod: `label` associado (nos formulários de login/cadastro, rótulos ocultos acessíveis com placeholders visíveis, como no layout), mensagens de erro ligadas ao campo (`aria-describedby`/`aria-invalid`) e erros do servidor mapeados para os campos (`fieldErrors`).
- Feedback assíncrono: avisos (sonner) em região `aria-live`; mudanças de preço/disponibilidade no detalhe e na quantidade anunciadas por regiões `aria-live="polite"`; resultados e contagem do catálogo anunciados; erros com `role="alert"`.
- Estados não dependem só de cor: filtros com semântica de checkbox, esgotado com selo e preço riscado, mudança de preço com ícone e texto, status de pedido com ícone e texto, indicador de conexão com texto.
- Imagens de NFT com `alt` do contrato; ícones decorativos com `aria-hidden`.
- Skeletons com shimmer preservam as dimensões do conteúdo (sem deslocamento de layout) e respeitam `prefers-reduced-motion`.
- Contraste: ver ajuste de cor de erro abaixo; ordem de foco e semântica de landmarks (`header`, `main`, `footer`, `nav`).
- Responsividade verificada em 390, 768, 1024 e 1440 px, sem overflow horizontal e sem elementos flutuantes sobre o conteúdo.

Ajustes em relação ao layout: a cor de erro do Figma (`#ED1B2E`, 4,0:1 sobre `#241612`) foi trocada por `#F0805F` (6,6:1) sempre acompanhada de ícone e texto; foco visível acrescentado onde o layout não o define; rótulos acessíveis ocultos nos campos de login/cadastro; "(em breve)" textual em itens desabilitados.

## 12. Decisões de UX e desvios do Figma

O Figma tem inconsistências. A regra foi **preservar a identidade** (cores, Roboto Mono, espaçamentos, composição, marca KURIO, tema escuro único) e **corrigir defeitos evidentes**, registrando cada desvio.

### Geral e layout base

- Card de NFT: usa o frame 206 do grid do Início como padrão único (os frames 230 e 231 eram inconsistentes entre si); nome e valor sempre alinhados. Elementos sem função (retângulos soltos, círculos, imagem indevida no mobile) foram removidos e desalinhamentos corrigidos; contêineres centralizados em 1440 px.
- Header idêntico em todas as telas a partir de 768 px (abaixo disso, ver o item "Mobile"); logado, "Entrar" dá lugar ao menu do usuário (perfil, carteiras, sair). Abaixo de 1024 px a navegação vai para um menu lateral; "Criadores" e "Aprenda" ficam visíveis, porém desabilitados com "(em breve)" por estarem fora do escopo. A lupa abre uma busca que leva ao catálogo filtrado.
- Mobile (< 768 px): como nos frames, Início, Detalhe, Carrinho, Pagamento, Login e Cadastro não têm header (`NO_MOBILE_HEADER` em `routes/__root.tsx`); Carrinho e Pagamento têm só o cabeçalho "voltar + título" da tela. As telas sem frame mobile (pedido, atividade, conta) mantêm um header compacto (logo, busca, carrinho, menu). A barra inferior do frame ganhou rótulos visíveis (Início, Favoritos, Carrinho, Conta; a aba "Conta" abre o menu de navegação e de conta) e perdeu o botão central de "scan" (sem função). Ela não aparece no Detalhe, no Carrinho e no Pagamento (`NO_TAB_BAR`): no Detalhe e no Pagamento dá lugar à barra fixa de ação da tela; no Carrinho o resumo fica no painel arredondado do frame.
- Tablet (768): adaptação fluida entre os frames desktop e mobile. Confirmação, Perfil e Carteiras em mobile derivados do desktop em coluna única.
- Login e Cadastro são modais sobre o conteúdo no Figma: implementados como rotas `/login` e `/register`, que funcionam em acesso direto, com backdrop escuro (~60%) e foco preso; no mobile, tela cheia.
- Telas sem frame (Favoritos e Atividade/pedidos) derivadas do menu da conta, com os cards do catálogo e linhas de pedido com status em texto e ícone.
- Rodapé: blog "Diário da Cunhagem" e links editoriais sem destino ficam como "Em breve"; a newsletter valida o e-mail e informa que não está disponível (não finge sucesso); redes sociais abrem os sites oficiais em nova aba; coleções do rodapé apontam ao catálogo filtrado (Arte 3D/Utilidade trocadas por Jogos/Colecionáveis, que existem nos dados).
- Painel Demo: acréscimo fora do layout, visível só com mocks ativos. A partir de 1440 px é um botão flutuante no canto inferior esquerdo, na margem vazia ao lado do conteúdo de 1200 px; abaixo disso é um botão comum depois do rodapé, para nunca cobrir cards, campos, totais ou a barra de ação.
- Resumos (carrinho, pagamento): desconto zero aparece como `(-) 0 ETH`, no formato dos demais valores, em vez do texto fixo `(-) 00.00` do frame.

### Início

- Ordenação: A→Z, Z→A, menor preço, maior preço e "Listados recentemente". Coleções em ordem alfabética e correspondentes às categorias da API (Arte digital, Colecionáveis, Esportes, Fotografia, Jogos, Música), com contagem real.
- O filtro "Rede" (Ethereum/Polygon/Solana) não existe nos dados: substituído por "Disponibilidade" (todos/disponíveis/esgotados) no mesmo estilo de lista. Filtros combináveis com semântica de checkbox. Faixa de preço: o slider do layout mais campos mínimo/máximo.
- Abas "Todos os NFTs", "Novos lançamentos" (listados nos últimos 30 dias) e "Em alta" (destaques) como filtros da URL.
- Busca acrescentada acima das abas no desktop (o frame não tinha); no mobile/tablet a barra "Explorar coleções" com botão de filtros fica acima do hero e os filtros abrem em gaveta inferior. Acrescentados "N NFTs encontrados", "Limpar filtros" e o indicador "Atualizando…". Paginação com "anterior" a partir da página 2 e total de resultados.
- Card: botão de favorito (coração do mobile) também no desktop; selo "ESGOTADO" no estilo do selo "RARO"; preço de esgotado riscado. Hero: os pontos selecionam destaques reais, sem autoplay. Ícones informativos (lucide) no lugar das letras dos destaques.

### Detalhe do NFT

- Estrelas, avaliações e a aba de avaliações removidas: não há dados de avaliação e não inventamos números. "Atributos" virou "Edições" (não há atributos nos dados).
- Miniaturas são a galeria do mesmo NFT (4 vistas geradas do mesmo arquivo: inteira, rosto, tronco/acessório e um enquadramento alternativo); a edição é um seletor separado que altera preço e disponibilidade, exibindo nome e tiragem (`Padrão · 1/146`); edição esgotada fica riscada e desabilitada. A lupa abre a imagem ampliada em diálogo.
- Acrescentados o botão "Adicionar ao carrinho" ao lado de "COMPRAR" e "por <criador>" na linha de preço. Quantidade: "diminuir" desabilitado no mínimo e "aumentar" no limite da edição. ID do token e demais dados vêm das fixtures (o Figma era inconsistente entre carrinho e pagamento).
- No mobile a descrição é o primeiro parágrafo da área de compra e não se repete em "Detalhes do NFT" (no desktop as duas seções ficam distantes e ela aparece nas duas). Em "Detalhes do NFT", os textos de "Contrato" e "Direitos autorais", trocados no frame, ficam sob o título correto.

### Carrinho

- Nome do NFT em até 2 linhas (sem reticências); preço alterado e falta de estoque na linha, com ícone e texto; cupom aplicado vira selo removível e o desconto mostra o código; "Colecionadores também viram" usa NFTs em destaque. No mobile, o mesmo stepper do desktop (quadrado escuro do frame) com espaço para o botão de remover; o resumo fica no painel arredondado, sem barra fixa.

### Pagamento

- Primeira opção de carteira é WalletConnect (como no mobile); "Carteira e rede" lista as carteiras cadastradas com a marca do provedor, em vez de provedores genéricos, e a conexão simulada é explícita ("Conectar carteira"). "Rede" lista só as redes da carteira selecionada.
- "Endereço da carteira" e "Tipo de carteira" são somente leitura (vêm da carteira cadastrada). "Usar outra carteira?" equivale a escolher a secundária.
- "Nome ENS" e "Código de indicação", obrigatórios no Figma, ficam **opcionais** (validados só quando preenchidos): exigi-los bloquearia compradores sem ENS ou sem indicação. O slot "ENS ou carteira secundária" virou "Nome ENS (opcional)" com sufixo `.eth`; o segundo "Nome ENS" (duplicado) foi removido.
- "Confirmar compra" abre um diálogo de revisão com o total da cotação (substitui um passo "Revisar pedido" separado); se a cotação mudar, o botão fica bloqueado até "Aceitar novos valores". "Tem um código promocional? Aplique aqui" abre o campo de cupom. Mobile: a ordem do frame ("Carteira e rede", depois os dados do colecionador, itens e resumo) e barra fixa com total e "Confirmar compra" (a barra de navegação some nessa rota).

### Pedido (confirmação)

- É a rota `/orders/$orderId` (acesso direto e refresh), com o cartão do modal do frame centralizado; o X volta ao início. "Carteira" mostra o endereço abreviado; o ID da transação é abreviado, com o hash completo em `title`; subtotal e desconto entram no resumo; "Ver no Etherscan" informa que o link é simulado.
- Pendente e recusado usam o mesmo padrão visual (ícone, texto e ações próprios); o recibo só aparece no confirmado.

### Login e cadastro

- Os campos mantêm só placeholders visíveis, como no frame, com rótulos acessíveis ocultos; o olho mostra/oculta a senha; login social e "Esqueceu a senha?" ficam desabilitados com "(em breve)". Atrás do modal desktop fica o hero do Início escurecido. No mobile, o título do cadastro é "Criar conta" (o frame diz "Criar perfil de colecionador"), igual ao botão.

### Perfil e carteiras

- Perfil: "Nome ENS" é opcional e o `.eth` é um sufixo fixo; "Apelido da carteira" edita a carteira principal; avatar com pré-visualização antes de "Enviar avatar"; um único "Salvar" grava dados, apelido e senha (a senha só é validada se preenchida). No menu "Meu perfil": "Atividade" = pedidos, "Lista de interesse" = favoritos; Ofertas, Arquivos baixados e Suporte ficam "(em breve)". Abaixo de 1024 px o menu vira uma linha de abas roláveis.
- Carteiras: os campos de perfil repetidos no frame (Nome de exibição, Nome do perfil, E-mail, Código de indicação, Nome ENS) saíram; "Rede" virou "Redes" (seleção múltipla, como no contrato); "Igual à carteira principal" foi removido (a API recusa endereço repetido). A secundária é editável e pode ser promovida ("Tornar principal").

### Substituição de assets

- As 4 artes do Figma (PNG de 1254 px, cerca de 2 MB cada) foram convertidas para AVIF e WebP em 256/512/800 px (`scripts/optimize-assets.mjs`) e distribuídas entre os 48 NFTs das fixtures; cada NFT tem 4 vistas na galeria (inteira, rosto, tronco/acessório e enquadramento alternativo), recortadas do mesmo arquivo pelo mesmo script.
- Os ícones SVG do Figma viram componentes React (`scripts/generate-icons.mjs`, `shared/ui/icons.tsx`); as letras W/C/D do rodapé foram trocadas por ícones lucide; ícones informativos do Início, idem.
- Fonte Roboto Mono (a do layout) servida localmente (`public/fonts`, com preload), sem dependência de CDN.

## 13. Testes

Os testes E2E (Playwright, Chromium desktop 1440×900 e mobile Pixel 7) rodam contra o build de produção com mocks, partem de um banco limpo (`?mocks=reset&scenario=...`) e observam a interface e os resultados das operações; os de tempo real passam pelo `socket.io-client` (eventos emitidos pelo servidor simulado via `window.__mocks`) e os de REST pelos handlers do MSW.

Cobertura atual (`e2e/`):

| Arquivo | Cenários cobertos |
| --- | --- |
| `smoke.spec.ts` | Listagem por REST e `nft.updated` recebido pelo `socket.io-client` |
| `session-cart.spec.ts` | Carrinho de visitante persiste no refresh e é fundido no login; diálogo de login (foco preso, erros da API, volta à página); favorito otimista com rollback na falha; troca de usuário sem vazamento de dados, eventos e armazenamento; sessão expirando durante o checkout e retomada após novo login; perfil e carteiras persistem após refresh, com erros da API nos campos |
| `checkout.spec.ts` | Compra completa pelo detalhe (pendente, depois confirmada; só as unidades compradas saem do carrinho); pagamento recusado mantém o carrinho; cliques repetidos e resposta perdida recuperam o mesmo pedido; recuperação da tentativa pendente após refresh; mudança de preço por socket bloqueia a confirmação até aceitar os novos valores; 409 `quote_outdated` ao confirmar; resumo do carrinho segue a cotação da API e cupons são validados pela API; o servidor recusa o pedido sem a carteira conectada na rede (409 `wallet_not_connected`) e aceita depois de reconectar; "Desconectar carteira" desconecta no servidor |
| `catalog.spec.ts` | Busca (nome, criador, descrição, vazio e limpar), filtros combinados (coleções, faixa de preço, disponibilidade) conferidos com os dados, validação da faixa de preço, ordenação, paginação pelos 48 NFTs com reset e página fora do intervalo, histórico (voltar/avançar restauram busca, filtros, ordenação e página; voltar do detalhe devolve à mesma página filtrada); detalhe por link direto com edição, edição desconhecida, NFT inexistente (tela própria, um único `GET`) e rota inexistente (404) |
| `auth-favorites.spec.ts` | Cadastro (sucesso, validação com foco no primeiro erro, e-mail repetido, cenário `register-conflict`); login, página privada com retorno, sessão expirada com destino preservado e logout; favoritos (visitante volta após o login, persistência no backend simulado e após refresh, mutação com falha reverte e nova tentativa funciona) |
| `account.spec.ts` | Perfil (dados e avatar com pré-visualização, validação no cliente e no servidor, troca de senha com a senha nova passando a valer) e carteiras (adicionar secundária, redes, endereço repetido, regra do servidor, editar apelido e tornar principal) |
| `realtime.spec.ts` | `nft.updated` (carrinho explica a mudança, eventos duplicados e antigos não regridem, item esgotado, revisão do checkout bloqueada, detalhe ao vivo), `order.updated` (confirmação duplicada aplicada uma vez, recusa), perda de conexão (conciliação por REST e por polling, tentativa de reconexão durante a queda, recarga com pedido pendente, pedido confirmado com a página fechada, preços do catálogo perdidos offline) e indicador "conectado" |
| `a11y.spec.ts` | Teclado (link de pular, cartão por Tab/Enter com foco visível, favorito, filtros e ordenação, menu da conta com Escape), diálogos e gavetas (foco preso e devolvido: login, revisão da compra, filtros e "Conta" no mobile) e validação que move o foco ao primeiro erro (checkout e faixa de preço) |
| `resilience.spec.ts` | Skeletons com carregamento lento sem salto de layout (catálogo, detalhe, páginas privadas), latência variável (respostas fora de ordem ignoradas) e falhas (HTTP 500, sem conexão, 503 transitório absorvido, resultado vazio, requisição travada com timeout, erros do detalhe, do perfil e do carrinho, falha ao validar a sessão com o carrinho em estado de erro, sempre com "Tentar novamente" ou reversão) |
| `visual.spec.ts` | Regressão visual de Início, Detalhe, Carrinho e Pagamento (`toHaveScreenshot`, baselines por projeto em `e2e/__screenshots__/`; `npm run test:visual` e `npm run test:visual:update`) |

Cada arquivo roda nos dois projetos (`chromium-desktop` e `chromium-mobile`). Há 93 testes por projeto (186 no total), dos quais 8 são de regressão visual. Quatro testes de acessibilidade são específicos de um viewport (filtros na lateral só no desktop, sheet e drawer só no mobile) e são ignorados no outro projeto.

Resultado da última execução (26/11/2026, `npx playwright test --reporter=line --grep-invert visual`, build de produção): **174 passaram, 0 falharam, 4 ignorados** (os específicos de viewport), somando os dois projetos. A regressão visual (`npm run test:visual`) é executada à parte: **8 de 8 baselines conferem** (as duas do Detalhe foram regeneradas depois da mudança na seção "Detalhes do NFT").

Relatório HTML: `playwright-report/index.html`; traces e capturas das falhas: `test-results/`.

## 14. Performance (Lighthouse)

Alvos: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90, em Início e Detalhe do NFT, nos perfis mobile e desktop, com build otimizado e cenário `default` dos mocks; três medições por página e perfil, com a mediana de cada categoria.

- Configuração e script: `lighthouse/config.mjs` (páginas, perfis e throttling) e `lighthouse/run.mjs` (`npm run lighthouse`; `npm run lighthouse -- --url <base>` audita um ambiente publicado). Páginas: Início (`/`) e Detalhe do NFT (`/nft/nft-001`, do cenário `default`). Cada execução usa um Chrome novo, sem estado salvo; mediana de 3 execuções por página e perfil.
- Relatórios: `lighthouse/reports/` (local) e `lighthouse/reports/production/` (Vercel). Só o HTML e o JSON da execução mediana de cada combinação são versionados; `summary.md` e `summary.json` trazem as três execuções de cada uma.
- Ferramentas e máquina (iguais nas duas medições): Lighthouse 13.6.0, Chrome 159.0.8154.6 (Chromium do Playwright, headless), Node v22.23.5, Windows 11 (10.0.26200, x64), AMD Ryzen 5 5500 (12 threads), 31,9 GB de RAM. Throttling simulado padrão do Lighthouse: mobile com 4x de CPU, RTT 150 ms e 1,6 Mbps; desktop com 1x de CPU, RTT 40 ms e 10 Mbps.

### Medição em produção (Vercel, Brotli, HTTP/2), a entrega real

URL `https://nft-marketplace-challenge-ivory.vercel.app` (mesmo código do commit auditado), cenário `default`.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 90 | 100 | 100 | 100 | 2,74 s | 0 | 281 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0,59 s | 0 | 0 ms |
| Detalhe do NFT | Mobile | 92 | 100 | 100 | 100 | 2,75 s | 0 | 217 ms |
| Detalhe do NFT | Desktop | 100 | 100 | 100 | 100 | 0,60 s | 0 | 0 ms |

Todas as metas foram atingidas. A Performance do Início mobile é a mais justa: 90, 91 e 88 nas três execuções (mediana 90; a execução de 88 teve TBT de 363 ms), então fica no limite da meta e pode oscilar abaixo dela em uma medição isolada.

### Medição local (build servido por `lighthouse/server.mjs`: HTTP/2 sobre TLS, Brotli, cabeçalhos do `vercel.json`, fallback de SPA)

26/11/2026, mesmo código desta entrega, `npm run lighthouse` completo (3 execuções × 2 páginas × 2 perfis).

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 92 | 100 | 100 | 100 | 2,41 s | 0 | 251 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0,54 s | 0 | 0 ms |
| Detalhe do NFT | Mobile | 94 | 100 | 100 | 100 | 2,43 s | 0 | 214 ms |
| Detalhe do NFT | Desktop | 100 | 100 | 100 | 100 | 0,53 s | 0 | 0 ms |

Todas as metas são atingidas. Execuções individuais de Performance mobile: Início 92, 93 e 92; Detalhe 94, 94 e 91 (a de 91 teve TBT de 318 ms). O servidor local fala HTTP/2 sobre TLS, o transporte do ambiente publicado (Vercel), com um certificado autoassinado para `localhost` gerado na hora pelo `openssl` (o Chrome da auditoria roda com `--ignore-certificate-errors`); o conteúdo servido, os mocks, as imagens e as fontes são os mesmos da entrega, e nada na aplicação detecta a auditoria. `LH_HTTP1=1` reproduz a medição antiga em HTTP/1.1.

**Por que o transporte decide a nota mobile.** Até a medição anterior, o servidor local usava HTTP/1.1 e a Performance mobile ficava em 81 (Início, LCP 4,34 s) e 83 (Detalhe, LCP 4,08 s), abaixo da meta, com o mesmo build. O LCP mobile é uma imagem cujo endereço só existe depois de uma resposta da API (card do catálogo, foto do NFT), e a API é a camada de mocks, que precisa estar de pé antes de qualquer requisição. O caminho crítico é HTML, JavaScript de inicialização (vendor ~164 kB, app 17 kB, MSW e handlers ~47 + 39 kB, gzip, em ~30 arquivos), execução com 4x de CPU, requisições à API, chunk da rota e a imagem. No grafo que o Lighthouse simula (Lantern), HTTP/1.1 limita a origem a 6 conexões, e as ~30 requisições de script entram em fila, cada uma pagando RTT de 150 ms; com HTTP/2 elas são multiplexadas em uma conexão. Trocar só o protocolo do servidor local, sem mudar uma linha da aplicação, levou o LCP mobile de 4,3 s para 2,4 s e a Performance para 92/94, coerente com a medição em produção (90/92, LCP 2,7 s) feita antes desta troca.

Tentativas que não mudaram a nota de forma mensurável (não mantidas):
- buscar os dados do catálogo no `loader` da rota (`prefetchQuery`, em paralelo com o download do chunk da página) junto com um `modulepreload` do chunk da rota escolhido pela URL: em HTTP/1.1, Início 78 (LCP 4,24 s, TBT maior) e Detalhe 85; em HTTP/2, Início 91 (LCP 2,55 s) contra 92 (2,40 s) sem a mudança e Detalhe igual (94): os bytes a mais competem com o vendor pela banda simulada;
- importar só o locale `pt` do Zod em vez de `z.locales.pt()`: o chunk vendor saiu byte a byte idêntico (os demais idiomas já eram eliminados pelo tree-shaking);
- antes: mover as duas rotas para o chunk principal (mais bytes antes do conteúdo, TBT pior), remover o preload da fonte, adiar as 6 requisições de contagem por coleção, servir com Brotli em vez de gzip. Uma versão que juntava todo o `node_modules` em um único chunk quebrou o `socket.io-client` (o engine.io capturou o `WebSocket` antes do MSW, com erro no console e Best Practices 96); por isso o agrupamento atual é uma lista de permissão que deixa o `socket.io-client` no chunk carregado por `import()`.

O build ainda avisa que o chunk `vendor` passa de 500 kB sem compressão (164 kB gzip): é proposital (React, Router, Query, Axios, Zod e tailwind-merge, todos necessários para pintar a primeira tela, em uma requisição).

Otimizações aplicadas (efeito medido no mesmo ambiente):

- **Chunk de entrada de 738 kB (235 kB gzip) para 2,3 kB (1,2 kB gzip).** `src/main.tsx` só dispara, em paralelo, `import('./app')` (React, Router, Query, rotas) e `import('./mocks/browser')` (MSW, handlers, fixtures, banco, Socket.IO simulado) e renderiza quando os dois terminam: os mocks continuam de pé antes da primeira requisição e antes do `import()` do `socket.io-client`, que só acontece depois da renderização. O painel Demo segue em chunk próprio e as rotas continuam divididas pelo TanStack Router. O JavaScript carregado no Início (31 arquivos, já com os mocks) soma 905 kB (294 kB gzip); antes, entrada + mocks somavam 1189 kB (407 kB gzip).
- **MSW sem o cookie jar:** `tough-cookie` e `tldts` (~290 kB, tabela de sufixos públicos) são apontados para um substituto mínimo (`src/mocks/shims/tough-cookie.ts`, alias em `vite.config.ts`), porque a API simulada autentica por token e não usa cookies; o chunk dos mocks caiu de 451 kB (171 kB gzip) para 147 kB (47 kB gzip).
- **Chunk `vendor` por lista de permissão** (React, Router, Query, Axios, Zod, tailwind-merge) e `modulepreload` dos chunks de `app` e dos mocks no HTML (plugin em `vite.config.ts`), para baixar em paralelo com a entrada e reduzir a quantidade de requisições pequenas.
- **Imagem do LCP:** os dois primeiros cards do catálogo carregam com `loading="eager"` e `fetchpriority="high"` (antes eram `lazy`); o hero e a foto do detalhe já eram prioritários. Imagens com `srcset`/`sizes` AVIF e WebP em 256/512/800 px e largura e altura reservadas (CLS 0).
- **SEO:** `public/robots.txt` (antes a rota caía no fallback do SPA e o Lighthouse o lia como inválido: SEO 92 para 100); `lang="pt-BR"`, meta description, viewport e `theme-color` no `index.html`.
- **Fontes:** Roboto Mono local em WOFF2 variável com `font-display: swap`, apenas o subconjunto latino em preload.
- **Cache (`vercel.json`):** `/assets/*` e `/fonts/*` `immutable` por um ano, `/images/*` por 7 dias com `stale-while-revalidate`, Service Worker do MSW sem cache. O regex do rewrite tinha escapes inválidos em JSON (`\.`) e foi corrigido.
- Dependências sem uso removidas do `package.json` (devtools do React Query, entre outras); a fonte de origem (`@fontsource-variable/roboto-mono`) é só dependência de desenvolvimento, copiada para `public/fonts` por `scripts/optimize-assets.mjs`. O Tailwind ignora `lighthouse/` ao varrer classes.
- Não há shell estático no `index.html`: o CSS bloqueante já pinta o fundo no primeiro frame (FCP de 0,6 s no mobile) e um esqueleto estático teria de reproduzir três layouts (mobile, tablet e desktop) sem gerar CLS.

## 15. Limitações conhecidas

- Não há backend real: tudo roda no navegador; dados, sessões e pedidos vivem em `localStorage` da origem e não são compartilhados entre navegadores ou abas (o Socket.IO simulado é por aba).
- Limitações do Socket.IO simulado listadas na seção 9 (só `websocket`, sem namespaces/rooms, ping emulado, token lido do frame bruto, import dinâmico obrigatório, `legacy-peer-deps`).
- O ID de transação e o link do Etherscan são simulados; a "conexão" de carteira é uma chamada simulada, sem blockchain.
- Autenticação simulada: o token fica em `localStorage` (em produção, preferir cookie `HttpOnly`); senhas com SHA-256 e sal apenas para simulação.
- Cupom, rascunho de checkout e tentativa de compra ficam em `sessionStorage`: não atravessam abas nem sobrevivem ao fechamento da aba.
- Não há endpoint de facetas: as contagens por coleção são uma requisição pequena por categoria.
- Itens fora do escopo do enunciado ficam desabilitados com "(em breve)": Criadores, Aprenda, Ofertas, Arquivos baixados, Suporte, login social, recuperação de senha, blog e newsletter.
- Imagens: as 4 artes originais são reaproveitadas pelos 48 NFTs das fixtures.
- Os cenários de uso único se rearmam ao reaplicar o cenário (painel/`setScenario`) ou com `?mocks=reset`; selecionar pela URL o cenário já ativo não os rearma.
- A localização é pt-BR (mensagens de validação do Zod e textos da interface); a aplicação não oferece troca de idioma.
