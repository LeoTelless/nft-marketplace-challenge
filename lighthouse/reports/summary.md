# Lighthouse: medianas

## Local, build servido com compressão (Brotli), cabeçalhos do vercel.json e HTTP/2 (TLS)

Gerado em 2026-11-26T21:40:25.457Z. Mediana de 3 execuções por página e perfil.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 81 | 100 | 100 | 100 | 2.61 s | 0 | 386 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0.55 s | 0 | 3 ms |
| Detalhe do NFT | Mobile | 90 | 100 | 100 | 100 | 2.63 s | 0 | 314 ms |
| Detalhe do NFT | Desktop | 100 | 100 | 100 | 100 | 0.57 s | 0 | 21 ms |

Execuções individuais. Todas têm relatório HTML e JSON; o da execução mediana está completo e os demais
foram gravados sem as capturas de tela (filmstrip, captura final e da página inteira), que não entram em
nenhuma nota ou métrica e ocupam cerca de metade de cada arquivo.

| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | Mobile | 1 | 78 | 100 | 100 | 100 | 2744 | 0.000 | 383 | [html](./inicio-mobile-run1.html), [json](./inicio-mobile-run1.json) (sem capturas) |
| Início | Mobile | 2 | 87 | 100 | 100 | 100 | 2612 | 0.000 | 386 | [html](./inicio-mobile-run2.html), [json](./inicio-mobile-run2.json) (sem capturas) |
| Início | Mobile | 3 | 81 | 100 | 100 | 100 | 2608 | 0.000 | 464 | [html](./inicio-mobile-run3.html), [json](./inicio-mobile-run3.json) (mediana, completo) |
| Início | Desktop | 1 | 100 | 100 | 100 | 100 | 554 | 0.000 | 3 | [html](./inicio-desktop-run1.html), [json](./inicio-desktop-run1.json) (mediana, completo) |
| Início | Desktop | 2 | 89 | 100 | 100 | 100 | 597 | 0.000 | 160 | [html](./inicio-desktop-run2.html), [json](./inicio-desktop-run2.json) (sem capturas) |
| Início | Desktop | 3 | 100 | 100 | 100 | 100 | 542 | 0.000 | 3 | [html](./inicio-desktop-run3.html), [json](./inicio-desktop-run3.json) (sem capturas) |
| Detalhe do NFT | Mobile | 1 | 90 | 100 | 100 | 100 | 2620 | 0.000 | 280 | [html](./detalhe-mobile-run1.html), [json](./detalhe-mobile-run1.json) (sem capturas) |
| Detalhe do NFT | Mobile | 2 | 90 | 100 | 100 | 100 | 2625 | 0.000 | 314 | [html](./detalhe-mobile-run2.html), [json](./detalhe-mobile-run2.json) (mediana, completo) |
| Detalhe do NFT | Mobile | 3 | 88 | 100 | 100 | 100 | 2661 | 0.000 | 353 | [html](./detalhe-mobile-run3.html), [json](./detalhe-mobile-run3.json) (sem capturas) |
| Detalhe do NFT | Desktop | 1 | 99 | 100 | 100 | 100 | 574 | 0.000 | 24 | [html](./detalhe-desktop-run1.html), [json](./detalhe-desktop-run1.json) (sem capturas) |
| Detalhe do NFT | Desktop | 2 | 100 | 100 | 100 | 100 | 549 | 0.000 | 0 | [html](./detalhe-desktop-run2.html), [json](./detalhe-desktop-run2.json) (sem capturas) |
| Detalhe do NFT | Desktop | 3 | 100 | 100 | 100 | 100 | 579 | 0.000 | 21 | [html](./detalhe-desktop-run3.html), [json](./detalhe-desktop-run3.json) (mediana, completo) |

### Ambiente e condições

- Lighthouse: 13.6.0
- Chrome: Chrome/159.0.8154.6
- Node: v22.23.5
- Sistema: Windows_NT 10.0.26200 (win32 x64)
- Hardware: AMD Ryzen 5 5500, 12 threads, 31.9 GB RAM
- Alvo: npm run build (production, mocks on) served by lighthouse/server.mjs on localhost, HTTP/2 over TLS (self-signed certificate), Brotli
- Cenário: default (fresh browser profile per run, no ?scenario)
- Throttling: simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps

## Produção (https://nft-marketplace-challenge-ivory.vercel.app)

Gerado em 2026-11-26T19:19:15.294Z. Mediana de 3 execuções por página e perfil.

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | Mobile | 87 | 100 | 100 | 100 | 2.73 s | 0 | 376 ms |
| Início | Desktop | 100 | 100 | 100 | 100 | 0.59 s | 0 | 0 ms |
| Detalhe do NFT | Mobile | 91 | 100 | 100 | 100 | 2.76 s | 0 | 241 ms |
| Detalhe do NFT | Desktop | 100 | 100 | 100 | 100 | 0.59 s | 0 | 0 ms |

Execuções individuais. Todas têm relatório HTML e JSON; o da execução mediana está completo e os demais
foram gravados sem as capturas de tela (filmstrip, captura final e da página inteira), que não entram em
nenhuma nota ou métrica e ocupam cerca de metade de cada arquivo.

| Página | Perfil | # | Perf | A11y | BP | SEO | LCP (ms) | CLS | TBT (ms) | Relatório |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Início | Mobile | 1 | 85 | 100 | 100 | 100 | 2995 | 0.000 | 378 |  |
| Início | Mobile | 2 | 87 | 100 | 100 | 100 | 2726 | 0.000 | 376 | [html](./production/inicio-mobile-run2.html), [json](./production/inicio-mobile-run2.json) (mediana, completo) |
| Início | Mobile | 3 | 88 | 100 | 100 | 100 | 2728 | 0.000 | 346 |  |
| Início | Desktop | 1 | 100 | 100 | 100 | 100 | 582 | 0.000 | 0 |  |
| Início | Desktop | 2 | 100 | 100 | 100 | 100 | 586 | 0.000 | 0 | [html](./production/inicio-desktop-run2.html), [json](./production/inicio-desktop-run2.json) (mediana, completo) |
| Início | Desktop | 3 | 100 | 100 | 100 | 100 | 589 | 0.000 | 0 |  |
| Detalhe do NFT | Mobile | 1 | 91 | 100 | 100 | 100 | 2792 | 0.000 | 241 |  |
| Detalhe do NFT | Mobile | 2 | 92 | 100 | 100 | 100 | 2755 | 0.000 | 213 |  |
| Detalhe do NFT | Mobile | 3 | 91 | 100 | 100 | 100 | 2761 | 0.000 | 261 | [html](./production/detalhe-mobile-run3.html), [json](./production/detalhe-mobile-run3.json) (mediana, completo) |
| Detalhe do NFT | Desktop | 1 | 100 | 100 | 100 | 100 | 587 | 0.000 | 0 | [html](./production/detalhe-desktop-run1.html), [json](./production/detalhe-desktop-run1.json) (mediana, completo) |
| Detalhe do NFT | Desktop | 2 | 100 | 100 | 100 | 100 | 590 | 0.000 | 0 |  |
| Detalhe do NFT | Desktop | 3 | 100 | 100 | 100 | 100 | 586 | 0.000 | 0 |  |

### Ambiente e condições

- Lighthouse: 13.6.0
- Chrome: Chrome/159.0.8154.6
- Node: v22.23.5
- Sistema: Windows_NT 10.0.26200 (win32 x64)
- Hardware: AMD Ryzen 5 5500, 12 threads, 31.9 GB RAM
- Alvo: https://nft-marketplace-challenge-ivory.vercel.app
- Cenário: default (fresh browser profile per run, no ?scenario)
- Throttling: simulated (Lighthouse default). Mobile: 4x CPU, 150 ms RTT, 1.6 Mbps. Desktop: 1x CPU, 40 ms RTT, 10 Mbps
