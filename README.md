# KURIO — Marketplace de NFTs

Aplicação front-end de um marketplace de NFTs (catálogo, detalhe, carrinho, checkout com cotação, pedidos, conta, carteiras e favoritos), com **tempo real via Socket.IO** e um **backend totalmente simulado na camada de rede com MSW**. Não existe servidor real: REST e WebSocket são interceptados no navegador, também no build publicado.

- Aplicação publicada: https://nft-marketplace-challenge-ivory.vercel.app
- Repositório: https://github.com/LeoTelless/nft-marketplace-challenge
- Arquitetura, contratos, cache, sessão, tempo real e decisões de UX: [ARCHITECTURE.md](./ARCHITECTURE.md)

## Stack

React 19, TypeScript, Vite 8, TanStack Router (rotas, search params, guardas, code-splitting), TanStack Query (cache, mutations, otimismo), Axios (todas as chamadas REST), Zod (contratos), React Hook Form, Tailwind CSS 4 + shadcn/ui (Radix), Socket.IO Client, MSW 3 + `@mswjs/socket.io-binding` (simulação de REST e Socket.IO), big.js (aritmética de ETH), Playwright (E2E), oxlint, Lighthouse.

## Requisitos e setup

Requisitos: **Node.js 20.19+ ou 22.12+** e npm 10+. Nenhum serviço externo é necessário.

```bash
git clone https://github.com/LeoTelless/nft-marketplace-challenge.git
cd nft-marketplace-challenge
npm ci
npm run dev
```

Abra a URL exibida pelo Vite (por padrão `http://localhost:5173`). O `Service Worker` do MSW é registrado automaticamente (`public/mockServiceWorker.js`).

### Por que existe um `.npmrc`

O arquivo `.npmrc` contém `legacy-peer-deps=true`. O pacote `@mswjs/socket.io-binding` (0.2) declara `msw ^2` como peer dependency, mas funciona com o MSW 3 usado aqui (validado pelos testes E2E de tempo real). Sem a flag, `npm ci` falharia com `ERESOLVE`. Use sempre `npm ci` (respeita o `package-lock.json`).

### Para rodar os testes E2E

```bash
npx playwright install chromium
```

## Variáveis de ambiente

Todas são opcionais fora da ativação dos mocks. Ficam em `.env.development` e `.env.production` (versionados, sem segredos).

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` em `.env.development` e `.env.production` | Ativa MSW (REST + Socket.IO simulado), o painel Demo e `window.__mocks`. Qualquer valor diferente de `"true"` desativa os mocks e a aplicação passa a falar com `VITE_API_URL`. |
| `VITE_API_URL` | `/api` (mesma origem) | URL base da API REST. Os handlers do MSW usam o mesmo valor. |
| `VITE_SOCKET_URL` | origem da página | Origem do servidor Socket.IO (caminho `/socket.io/`). |

O build público é uma **build de demonstração**: não há backend, então os mocks permanecem ligados (`.env.production`).

## Credenciais fictícias e cupons

| Usuário | E-mail | Senha |
| --- | --- | --- |
| Ana Souza | `ana@nftmarket.test` | `Jungle@2026` |
| Bruno Lima | `bruno@nftmarket.test` | `Market@2026` |

Qualquer outro e-mail pode ser cadastrado em `/register` (senha com 8+ caracteres, uma letra e um número). A sessão simulada dura 2 horas.

| Cupom | Efeito |
| --- | --- |
| `JUNGLE10` | 10% de desconto sobre o subtotal |
| `WELCOME25` | 25% de desconto sobre o subtotal |
| `EXPIRED20` | Expirado (resposta `coupon_expired`) |
| Qualquer outro código | Inválido (`coupon_invalid`) |

Carteiras de Ana: MetaMask principal (Ethereum, Polygon, Arbitrum) e WalletConnect secundária (Ethereum, Base). Bruno: Coinbase Wallet (Ethereum, Base).

## Comandos

| Objetivo | Comando |
| --- | --- |
| Desenvolvimento com mocks | `npm run dev` |
| Build de produção (typecheck + Vite) | `npm run build` |
| Servir o build localmente | `npm run preview` (porta 4173 com `-- --port 4173`) |
| Verificação de tipos | `npm run typecheck` |
| Lint | `npm run lint` |
| Testes unitários (aritmética e formatação de ETH; runner do Playwright, sem navegador nem servidor) | `npm run test:unit` |
| Testes E2E (Playwright, Chromium desktop e mobile, inclui a regressão visual) | `npm run test:e2e` |
| Testes E2E sem a regressão visual (o que a CI roda) | `npx playwright test --grep-invert "visual: "` |
| Testes E2E com a UI do Playwright | `npm run test:e2e:ui` |
| Regressão visual (início, detalhe, carrinho e pagamento) | `npm run test:visual`; regenerar as baselines (`e2e/__screenshots__/`) com `npm run test:visual:update` |
| Auditoria Lighthouse (build + servidor local + 3 execuções por página e perfil; `-- --url <base>` para um ambiente publicado) | `npm run lighthouse` |

Notas sobre o Playwright (`playwright.config.ts`): os testes rodam contra o **build de produção** (com mocks ligados, como no deploy), servido por `npm run build && npm run preview --port 4173`; se já houver um servidor na porta 4173, ele é reaproveitado (fora de CI). Projetos: `chromium-desktop` (1440×900) e `chromium-mobile` (Pixel 7). Toda execução (`npm run test:e2e` ou `npx playwright test ...`) grava:

- o relatório HTML em `playwright-report/index.html` (abrir com `npx playwright show-report`);
- de cada teste que falhou, o trace (`trace.zip`, abrir com `npx playwright show-trace <arquivo>`), a captura de tela e o contexto do erro em `test-results/<teste>-<projeto>/`.

As duas pastas ficam fora do git. Os testes unitários (`playwright.unit.config.ts`, arquivos `src/**/*.test.ts`) usam só o reporter de linha.

**Baselines visuais dependem do sistema operacional.** As 8 imagens de `e2e/__screenshots__/` foram geradas no Windows 11 com o Chromium do Playwright, e a tolerância é de 0,1% dos pixels. A rasterização de fontes muda entre Windows, Linux e macOS, então `npm run test:visual` só é confiável no Windows; em outro sistema, gere baselines próprias com `npm run test:visual:update` antes de comparar. Por isso a CI não roda a regressão visual.

### Integração contínua

`.github/workflows/ci.yml` (GitHub Actions, Ubuntu, Node 22), em push para `main`, pull request ou execução manual: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit`, instalação do Chromium do Playwright e `npx playwright test --grep-invert "visual: "` (desktop e mobile, com 1 nova tentativa em CI). O relatório HTML é publicado como artefato `playwright-report` em toda execução; os traces e capturas das falhas, como `playwright-test-results` quando algo falha.

## Seleção e reset de cenários

Os cenários são determinísticos (latências seguem sequências fixas, sem aleatoriedade) e ficam em `src/mocks/scenarios.ts`. Três formas de usá-los:

1. **URL**: `?scenario=<id>` seleciona e persiste o cenário (em `localStorage`). `?mocks=reset` restaura o banco simulado e volta ao cenário `default`. Os dois parâmetros são removidos da URL depois de aplicados, então atualizar a página não zera o banco de novo. Exemplo: `http://localhost:5173/?mocks=reset&scenario=payment-declined`.
2. **Painel Demo**: botão discreto "Demo" (flutuante no canto inferior esquerdo a partir de 1440 px; abaixo disso, um botão comum logo depois do rodapé, para não cobrir o conteúdo) abre um painel com: seletor de cenário, "Aplicar cenário", "Recarregar página" e "Restaurar dados iniciais (reset)"; botões para alterar preço/estoque de um item do carrinho (emite `nft.updated`); resolução manual de pedidos pendentes (emite `order.updated`); "Expirar sessão", "Derrubar Socket.IO" e "Restaurar Socket.IO". O painel só aparece com os mocks ativos.
3. **Console**: `window.__mocks` (`setScenario(id)`, `reset()`, `updateNft(...)`, `resolveOrder(id, 'confirmed' | 'rejected')`, `expireSessions()`, `disconnectWallets()`, `replayLastEvent()`, `replayEvent(evento)`, `emitStaleNftEvent(id)`, `dropSocket()`, `restoreSocket()`, `getState()`...). É a superfície usada pelos testes E2E.

`__mocks.reset()` também funciona sem recarregar a página: o banco volta ao estado semente (mesmos NFTs, preços, estoques, usuários, carteiras e cupons; carrinhos, pedidos e sessões apagados) e o servidor Socket.IO simulado envia `system.resync` aos clientes conectados, que refazem por REST tudo o que está na tela. Ids, ids de evento e versões não recomeçam: continuam a partir dos já emitidos (como num servidor real cujos dados são restaurados), então o cliente nunca confunde um evento posterior ao reset com um antigo. Partindo de um navegador limpo (como nos testes), o resultado é exatamente a semente. O botão do painel Demo chama o mesmo `reset()` e recarrega a página; como as sessões são apagadas, é preciso entrar de novo.

Cenários de "uso único" disparam uma vez por ativação e depois se comportam como `default`, para que o caminho de recuperação possa ser exercitado. Aplicar o cenário pelo painel ou por `setScenario` os rearma; pela URL, apenas se o cenário for diferente do ativo (`?mocks=reset` sempre rearma).

| Cenário | O que provoca |
| --- | --- |
| `default` | Sucesso com latência pequena e determinística (120 a 300 ms). Pagamentos são confirmados após 2,5 s. |
| `instant` | Sucesso sem latência. |
| `empty` | O catálogo não retorna resultados (e o detalhe responde 404). |
| `slow` | Toda requisição leva 2,5 s (skeletons e atualizações em segundo plano). |
| `variable-latency` | Latência cíclica de 900/150/1800/400/60/1200 ms. |
| `out-of-order` | Listagens do catálogo alternam 1600 ms e 150 ms: a resposta mais nova chega antes da antiga. |
| `request-timeout` | Leituras (GET) ficam penduradas por 20 s, acima do timeout do cliente (10 s): o skeleton fica ~10 s na tela e dá lugar ao erro com "Tentar novamente" (timeout não é repetido automaticamente). |
| `offline` | Toda requisição falha em nível de rede e o Socket.IO recusa conexões. |
| `server-error` | Toda requisição à API responde 500. |
| `flaky` | As 2 primeiras tentativas de cada endpoint (método + caminho) respondem 503; depois funcionam. |
| `session-expired` | Uso único: a próxima requisição autenticada responde 401 `session_expired`. |
| `forbidden` | Endpoints privados (favoritos, pedidos, perfil, carteiras) respondem 403. |
| `register-conflict` | O cadastro sempre responde 409 `email_conflict`. |
| `validation-error` | Cadastro, perfil, senha, carteiras e criação de pedido respondem 422 com erros por campo. |
| `coupon-invalid` | Qualquer cupom responde 422 `coupon_invalid`. |
| `coupon-expired` | Qualquer cupom responde 422 `coupon_expired`. |
| `price-changed` | Uso único: na primeira tentativa de pedido o preço do primeiro item sobe 15% (emite `nft.updated`) e o pedido responde 409 `quote_outdated`. |
| `sold-out` | Uso único: na primeira tentativa de pedido o primeiro item esgota (emite `nft.updated`) e o pedido responde 409 `availability_conflict`. |
| `order-timeout` | Uso único: o primeiro pedido é criado, mas a resposta se perde (erro de rede); repetir com a mesma chave o recupera. |
| `payment-declined` | Pedidos são resolvidos como recusados. |
| `order-pending` | Pedidos ficam pendentes até serem resolvidos pelo painel Demo ou por `window.__mocks.resolveOrder()`. |
| `wallet-declined` | A conexão simulada da carteira responde 422 `wallet_rejected` (e a sessão fica sem carteira conectada). |

Cenários que valem sem seleção: o cupom `EXPIRED20` sempre expira e códigos desconhecidos sempre são inválidos; e-mails já cadastrados (`ana@...`, `bruno@...`) sempre geram 409 no cadastro.

## Roteiros para reproduzir os fluxos de falha

Todos partem de um estado limpo: abra `/?mocks=reset&scenario=<id>`. Para compras, entre como `ana@nftmarket.test` / `Jungle@2026`. Abreviação: "Demo" = painel Demo.

**Latência variável e respostas fora de ordem.** Cenário `out-of-order` (ou `variable-latency`). No catálogo, troque rapidamente de página, ordenação ou filtro. A interface mostra "Atualizando…" mantendo a página anterior; a resposta antiga é cancelada (`AbortSignal`) e nunca sobrescreve a mais recente. Em `slow`, observe skeletons com shimmer no catálogo, no detalhe e no resumo do carrinho.

**Falha de conexão e erros 4xx/5xx.** `offline`, `server-error` ou `request-timeout`: abra o catálogo. Aparece o estado de erro com "Tentar novamente": em `offline` e `server-error` depois de 2 novas tentativas automáticas (~1,5 s), em `request-timeout` depois de ~10 s (o timeout do cliente, sem nova tentativa). Troque para `default` no painel Demo e clique em "Tentar novamente": a lista carrega. `flaky` demonstra a recuperação sozinha (503, 503, sucesso). `forbidden` + `/account/profile` mostra o estado de erro com "Tentar novamente" (a sessão continua válida; não há redirecionamento ao login).

**Sessão expirada e acesso não autorizado.** (a) Sem login, abra `/checkout` ou `/account/profile`: redireciona para `/login?redirect=...` e, após entrar, volta ao destino. (b) Entre como Ana, adicione um item ao carrinho e vá a `/checkout`; no Demo clique "Expirar sessão" e interaja (ex.: "Recarregar página" ou navegar). A aplicação avisa "Sua sessão expirou.", leva a `/login?reason=expired&redirect=...`, descarta o cache privado e, ao entrar de novo, retoma o checkout com o rascunho do formulário. O cenário `session-expired` faz o mesmo na primeira requisição autenticada seguinte.

**Conflito de cadastro e validação de formulário.** Em `/register`, cadastre `ana@nftmarket.test` (conflito natural) ou use o cenário `register-conflict` com qualquer e-mail: o erro 409 aparece associado ao campo e-mail. Com `validation-error`, salvar o perfil, trocar a senha ou cadastrar carteira devolve erros 422 por campo. Validações do cliente (senha fraca, confirmação diferente, endereço de carteira inválido) aparecem antes de enviar.

**Cupom inválido ou expirado.** No carrinho, aplique `XYZ` (inválido) e `EXPIRED20` (expirado): mensagens distintas. `JUNGLE10` e `WELCOME25` aplicam o desconto e o resumo é recalculado pela cotação da API. Os cenários `coupon-invalid` e `coupon-expired` forçam o erro para qualquer código, inclusive um cupom já aplicado (que é removido com aviso).

**Preço alterado durante a compra.** Cenário `price-changed`. Entre, adicione um NFT, vá ao checkout, preencha os dados, conecte a carteira e confirme (revisão e "Confirmar compra"). O servidor sobe o preço (o evento `nft.updated` chega pelo Socket.IO) e responde 409 `quote_outdated` com a cotação nova: nada é comprado, os valores novos são exibidos e a confirmação fica bloqueada até "Aceitar novos valores". Confirmar de novo cria o pedido.

**Edição esgotada durante a compra.** Cenário `sold-out`, mesmo caminho: 409 `availability_conflict`, o item aparece como esgotado/insuficiente no resumo e o checkout fica bloqueado até ajustar o carrinho.

**Timeout após a criação do pedido (idempotência).** Cenário `order-timeout`. No checkout, confirme a compra: o pedido é criado no servidor, mas a resposta se perde e a tela informa que não houve resposta, preservando a tentativa. Clique em confirmar novamente (ou atualize a página e repita): o cliente reenvia a mesma `Idempotency-Key` e o mesmo corpo e o servidor devolve o **mesmo pedido**, sem cobrança duplicada. Conferir em `/orders`: um único pedido.

**Cliques repetidos.** Em qualquer cenário com latência (ex.: `slow`), clique várias vezes em "Confirmar compra": só uma requisição é enviada.

**Pagamento confirmado e recusado.** `default`: o pedido nasce `pending` e vira `confirmed` em ~2,5 s (recibo com hash simulado; só as quantidades compradas saem do carrinho). `payment-declined`: vira `rejected`, o carrinho é mantido e o estoque reservado é devolvido. Estados confirmado e recusado são terminais.

**Falha de mutation com rollback (favoritos).** Em um cenário com erro (`server-error`) ou com a conta em `forbidden`, favoritar um NFT: o coração muda na hora (otimista), volta ao estado anterior e um aviso explica a falha. No carrinho, alterar a quantidade ou remover itens também é otimista com rollback.

**Conexão da carteira recusada ou perdida.** Cenário `wallet-declined`: em "Conectar carteira" no checkout a conexão é recusada e o botão de confirmar permanece bloqueado. A conexão é registrada no servidor simulado (uma por sessão) e `POST /orders` a exige: com a revisão aberta, rode `__mocks.disconnectWallets()` no console (a carteira "desconectou do lado dela") e confirme; o servidor responde 409 `wallet_not_connected`, nada é comprado, a carteira aparece desconectada com a mensagem no campo e, depois de "Conectar carteira", a compra segue. "Desconectar carteira" no checkout também desconecta no servidor.

### Cenário de tempo real (preço/disponibilidade mudando com o item no carrinho)

1. Entre como Ana e adicione um NFT ao carrinho (detalhe → "Adicionar ao carrinho").
2. Abra `/cart` (ou `/checkout`, depois de revisar o pedido) e abra o painel Demo.
3. Em "Catálogo (nft.updated)", escolha o item e clique "Preço +15%" (ou "Esgotar"/"Deixar 1 unidade"). O servidor simulado altera o NFT e emite `nft.updated` pelo servidor Socket.IO simulado, consumido pelo `socket.io-client` real.
4. A interface informa (aviso e região `aria-live`) "O preço de ... mudou", e o resumo é atualizado pela nova cotação.
5. Se o checkout já estava em revisão, a confirmação fica bloqueada até "Aceitar novos valores"; mesmo se o clique ocorresse, o servidor responderia 409 `quote_outdated`.
6. Eventos duplicados ou antigos são ignorados, sem aviso nem nova requisição: no console, `__mocks.replayLastEvent()` e `__mocks.emitStaleNftEvent('<id do NFT>')` não alteram a tela. Vale também depois de recarregar a página ou de sair e entrar de novo: guarde o evento (`const e = __mocks.replayLastEvent()`), recarregue ou troque de sessão e reenvie com `__mocks.replayEvent(e)`.

**Interrupção de conexão com pedido pendente.** Cenário `order-pending`. Confirme uma compra (o pedido fica pendente na tela do pedido). No Demo clique "Derrubar Socket.IO" (o indicador de tempo real, no rodapé, passa a "reconectando"), depois "Confirmar" no pedido pendente e "Restaurar Socket.IO". Ao reconectar, o cliente reconcilia com a API REST e a tela mostra o pedido confirmado, sem criar outra compra. Alternativa: com o pedido pendente, atualize a página (`/orders/<id>`): o estado é recuperado por REST.

## Estrutura de pastas

```
.github/workflows/   CI (GitHub Actions): typecheck, lint, build, testes unitários e E2E sem a regressão visual
e2e/                 Testes Playwright (specs, support/mocks.ts com o acesso tipado a window.__mocks)
lighthouse/          Configuração, runner, servidor local e relatórios da auditoria Lighthouse
design/              Tokens e assets do Figma, INDEX.md e DECISOES.md (frames e medidas por nó são regeráveis com scripts/figma-dump.mjs e não são versionados)
docs/                Enunciado do desafio
public/              Fonte Roboto Mono, imagens otimizadas, favicon e mockServiceWorker.js
scripts/             Otimização de imagens (AVIF/WebP) e geração dos ícones a partir dos SVGs do Figma
src/
  contracts/         Schemas Zod de REST, erros e eventos; mapa de endpoints (compartilhado com os mocks)
  shared/
    api/             Axios, ApiError, QueryClient (política de cache), queryKeys
    session/         Token, id do carrinho de visitante, armazenamento por usuário, redirect seguro
    realtime/        Cliente Socket.IO, EventGuard, aplicação dos eventos no cache
    feedback/        Avisos (sonner) e regiões aria-live
    layout/ ui/ flow-ui/ lib/   Header, rodapé, primitivos shadcn, campos de fluxo, ETH (big.js, com testes unitários em eth.test.ts), formulários
  features/          auth, catalog, nft, cart, checkout, orders, favorites, profile, wallets, account, demo
  mocks/             MSW: db (localStorage), fixtures, handlers REST, servidor Socket.IO simulado, cenários, window.__mocks
  routes/            Rotas do TanStack Router (arquivo = rota); _authenticated = área privada
```

## Relatórios de testes e auditoria

- Relatório HTML dos testes E2E: `playwright-report/index.html` (gerado por `npm run test:e2e`); traces e capturas das falhas em `test-results/`. Na CI, os dois são artefatos da execução (`playwright-report`, `playwright-test-results`).
- Relatórios Lighthouse: `lighthouse/reports/` (build local) e `lighthouse/reports/production/` (Vercel). Cada execução de cada página e perfil grava o HTML e o JSON (`<página>-<perfil>-run<N>`, 12 execuções por ambiente): o da execução mediana completo e os demais sem as capturas de tela (filmstrip, captura final e da página inteira, cerca de metade do arquivo, sem efeito em notas ou métricas). `summary.md` (duas tabelas de medianas rotuladas, execuções individuais com links, versões, sistema, hardware e condições) e `summary.json` cobrem as três execuções. Configuração: `lighthouse/config.mjs` (páginas, perfis mobile/desktop, throttling simulado padrão, 3 execuções); script: `lighthouse/run.mjs`.
- `npm run lighthouse` faz o `npm run build`, serve `dist/` com `lighthouse/server.mjs` (HTTP/2 sobre TLS, como na Vercel, com um certificado autoassinado para `localhost` gerado pelo `openssl` numa pasta temporária; Brotli/gzip, cabeçalhos de cache do `vercel.json`, fallback de SPA; porta 4180; sem `openssl` no PATH, no Windows ele é procurado na instalação do Git, e sem ele ou com `LH_HTTP1=1` o servidor usa HTTP/1.1 e o resumo registra isso), audita Início (`/`) e Detalhe (`/nft/nft-001`) nos perfis mobile e desktop, cada um em um Chrome novo (cenário `default`, sem estado salvo), e sobrescreve os relatórios locais. `npm run lighthouse -- --url https://nft-marketplace-challenge-ivory.vercel.app` audita o ambiente publicado e grava em `lighthouse/reports/production/`. Usa o Chrome instalado ou, se não houver, o Chromium do Playwright (`CHROME_PATH` força outro). Variáveis opcionais: `LH_RUNS`, `LH_ONLY=inicio:mobile,...`, `LH_SKIP_BUILD=1`, `LH_HTTP1=1`. A auditoria usa o mesmo build, os mesmos mocks, imagens e fontes da entrega.
- Resultado resumido (mediana de 3): no servidor local (HTTP/2), Performance mobile 93 (Início; execuções 90, 93 e 94) e 95 (Detalhe; 94, 95 e 96), LCP 2,40/2,41 s, TBT 244/179 ms, CLS 0, desktop 100, e 100 em Accessibility, Best Practices e SEO em todas as combinações. A medição de produção (Vercel) versionada é anterior às últimas otimizações de inicialização: mobile 87 (Início, abaixo da meta) e 91 (Detalhe), desktop 100. Em HTTP/1.1 (`LH_HTTP1=1`), na última medição feita assim (build anterior), a Performance mobile local ficava em 81-83; a análise está no [ARCHITECTURE.md](./ARCHITECTURE.md).
- Resultados e análise: seções "Testes" e "Performance (Lighthouse)" do [ARCHITECTURE.md](./ARCHITECTURE.md).
