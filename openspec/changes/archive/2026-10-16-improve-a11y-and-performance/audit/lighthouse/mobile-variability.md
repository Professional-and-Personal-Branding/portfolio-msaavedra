# Variabilidad de Performance mobile (4 corridas por página)

Lighthouse 13.5.0, throttling simulado (moto g power, 4x CPU, 150 ms RTT, 1,6 Mbps). La corrida base es la de la tabla principal; `run1..3` están en `mobile-repeat/`.

| Página | Corrida | Perf | FCP (ms) | LCP (ms) | TBT (ms) | CLS |
|---|---|---|---|---|---|---|
| home | home.mobile | 94 | 2270 | 2659 | 76 | 0.008 |
| home | home.mobile-run1 | 87 | 2311 | 3201 | 194 | 0.008 |
| home | home.mobile-run2 | 88 | 2411 | 3409 | 57 | 0.001 |
| home | home.mobile-run3 | 94 | 2412 | 2644 | 44 | 0.008 |
| tech-lead | tech-lead.mobile | 90 | 2264 | 3217 | 81 | 0.002 |
| tech-lead | tech-lead.mobile-run1 | 95 | 2259 | 2483 | 39 | 0.002 |
| tech-lead | tech-lead.mobile-run2 | 89 | 2411 | 3364 | 43 | 0.002 |
| tech-lead | tech-lead.mobile-run3 | 94 | 2259 | 2643 | 48 | 0.002 |
| tech-lead-en-dark-sidebar | tech-lead-en-dark-sidebar.mobile | 93 | 2411 | 2651 | 66 | 0.001 |
| tech-lead-en-dark-sidebar | tech-lead-en-dark-sidebar.mobile-run1 | 94 | 2411 | 2633 | 33 | 0.005 |
| tech-lead-en-dark-sidebar | tech-lead-en-dark-sidebar.mobile-run2 | 94 | 2412 | 2636 | 30 | 0.005 |
| tech-lead-en-dark-sidebar | tech-lead-en-dark-sidebar.mobile-run3 | 95 | 2262 | 2488 | 37 | 0.005 |

| Página | Mínimo | Mediana | Máximo |
|---|---|---|---|
| home | 87 | 91 | 94 |
| tech-lead | 89 | 92 | 95 |
| tech-lead-en-dark-sidebar | 93 | 94 | 95 |

