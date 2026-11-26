# Lighthouse: medianas

## Local, build servido com compressão (Brotli) e cabeçalhos do vercel.json

Gerado em 2026-11-26T18:32:57.094Z. Mediana de 3 execuções por página e perfil.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 80 | 100 | 100 | 100 | 4.38 s | 0 | 259 ms |
| Início | Desktop | 97 | 100 | 100 | 100 | 1.22 s | 0 | 0 ms |
| Detalhe do NFT | Mobile | 81 | 100 | 100 | 100 | 4.08 s | 0 | 265 ms |
| Detalhe do NFT | Desktop | 98 | 100 | 100 | 100 | 1.13 s | 0 | 0 ms |

Execuções individuais (o relatório HTML/JSON é o da execução mediana):

| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | Mobile | 1 | 79 | 100 | 100 | 100 | 4397 | 0.000 | 259 |  |
| Início | Mobile | 2 | 81 | 100 | 100 | 100 | 4384 | 0.000 | 232 |  |
| Início | Mobile | 3 | 80 | 100 | 100 | 100 | 4379 | 0.000 | 272 | [html](./inicio-mobile-run3.html), [json](./inicio-mobile-run3.json) |
| Início | Desktop | 1 | 97 | 100 | 100 | 100 | 1219 | 0.000 | 0 | [html](./inicio-desktop-run1.html), [json](./inicio-desktop-run1.json) |
| Início | Desktop | 2 | 99 | 100 | 100 | 100 | 927 | 0.000 | 0 |  |
| Início | Desktop | 3 | 97 | 100 | 100 | 100 | 1222 | 0.000 | 0 |  |
| Detalhe do NFT | Mobile | 1 | 81 | 100 | 100 | 100 | 4082 | 0.000 | 265 | [html](./detalhe-mobile-run1.html), [json](./detalhe-mobile-run1.json) |
| Detalhe do NFT | Mobile | 2 | 83 | 100 | 100 | 100 | 4083 | 0.000 | 232 |  |
| Detalhe do NFT | Mobile | 3 | 81 | 100 | 100 | 100 | 4096 | 0.000 | 282 |  |
| Detalhe do NFT | Desktop | 1 | 99 | 100 | 100 | 100 | 867 | 0.000 | 0 |  |
| Detalhe do NFT | Desktop | 2 | 98 | 100 | 100 | 100 | 1139 | 0.000 | 0 |  |
| Detalhe do NFT | Desktop | 3 | 98 | 100 | 100 | 100 | 1125 | 0.000 | 0 | [html](./detalhe-desktop-run3.html), [json](./detalhe-desktop-run3.json) |

### Ambiente e condições

- Lighthouse: 13.6.0
- Chrome: Chrome/159.0.8154.6
- Node: v22.23.5
- Sistema: Windows_NT 10.0.26200 (win32 x64)
- Hardware: AMD Ryzen 5 5500, 12 threads, 31.9 GB RAM
- Alvo: npm run build (production, mocks on) served by lighthouse/server.mjs on localhost, HTTP/1.1, Brotli
- Cenário: default (fresh browser profile per run, no ?scenario)
- Throttling: simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps

## Produção (https://nft-marketplace-challenge-ivory.vercel.app)

Gerado em 2026-11-26T18:34:52.261Z. Mediana de 3 execuções por página e perfil.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 90 | 100 | 100 | 100 | 2.73 s | 0 | 281 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0.59 s | 0 | 0 ms |
| Detalhe do NFT | Mobile | 92 | 100 | 100 | 100 | 2.76 s | 0 | 217 ms |
| Detalhe do NFT | Desktop | 100 | 100 | 100 | 100 | 0.60 s | 0 | 0 ms |

Execuções individuais (o relatório HTML/JSON é o da execução mediana):

| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | Mobile | 1 | 90 | 100 | 100 | 100 | 2738 | 0.000 | 281 | [html](./production/inicio-mobile-run1.html), [json](./production/inicio-mobile-run1.json) |
| Início | Mobile | 2 | 91 | 100 | 100 | 100 | 2735 | 0.000 | 254 |  |
| Início | Mobile | 3 | 88 | 100 | 100 | 100 | 2731 | 0.000 | 363 |  |
| Início | Desktop | 1 | 100 | 100 | 100 | 100 | 596 | 0.000 | 0 |  |
| Início | Desktop | 2 | 100 | 100 | 100 | 100 | 587 | 0.000 | 0 |  |
| Início | Desktop | 3 | 100 | 100 | 100 | 100 | 589 | 0.000 | 0 | [html](./production/inicio-desktop-run3.html), [json](./production/inicio-desktop-run3.json) |
| Detalhe do NFT | Mobile | 1 | 92 | 100 | 100 | 100 | 2758 | 0.000 | 217 | [html](./production/detalhe-mobile-run1.html), [json](./production/detalhe-mobile-run1.json) |
| Detalhe do NFT | Mobile | 2 | 93 | 100 | 100 | 100 | 2749 | 0.000 | 207 |  |
| Detalhe do NFT | Mobile | 3 | 91 | 100 | 100 | 100 | 2764 | 0.000 | 268 |  |
| Detalhe do NFT | Desktop | 1 | 100 | 100 | 100 | 100 | 608 | 0.000 | 0 |  |
| Detalhe do NFT | Desktop | 2 | 100 | 100 | 100 | 100 | 602 | 0.000 | 0 | [html](./production/detalhe-desktop-run2.html), [json](./production/detalhe-desktop-run2.json) |
| Detalhe do NFT | Desktop | 3 | 100 | 100 | 100 | 100 | 596 | 0.000 | 0 |  |

### Ambiente e condições

- Lighthouse: 13.6.0
- Chrome: Chrome/159.0.8154.6
- Node: v22.23.5
- Sistema: Windows_NT 10.0.26200 (win32 x64)
- Hardware: AMD Ryzen 5 5500, 12 threads, 31.9 GB RAM
- Alvo: https://nft-marketplace-challenge-ivory.vercel.app
- Cenário: default (fresh browser profile per run, no ?scenario)
- Throttling: simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps
