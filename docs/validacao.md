# Validação do Doser 0.4

## Base real — 20/10/2026

Download HTTPS da fonte oficial `https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv` respondeu HTTP 200. Tamanho: **45.920.138 bytes**; última modificação informada pelo servidor: **13/10/2026**. Arquivo em Windows-1252, delimitado por ponto e vírgula.

SHA-256: `f0b546e2d3a737a90fbc866348356cd766344bd2f4b8f488a43d66a0d7a30877`.

| Tratamento                                                  | Quantidade |
| ----------------------------------------------------------- | ---------: |
| Linhas na fonte                                             |    228.869 |
| Registros ativos únicos incluídos                           |     10.326 |
| Linhas excluídas (inativas ou sem registro numérico aceito) |    156.100 |
| Duplicatas removidas                                        |     62.443 |
| Registros incluídos sem princípio ativo                     |         13 |

As duplicatas da fonte real tinham nome, princípio ativo e classe consistentes por registro. O importador agora rejeita conflitos futuros em vez de escolher uma versão arbitrária. Uma associação observada excedia o limite anterior de 300 caracteres de princípio ativo; o limite foi aumentado para 1.000 sem truncar o dado original.

Registro ativo é a situação cadastral informada na fonte. Não certifica comercialização, estoque, validade de uma prescrição ou conteúdo clínico.

## Verificações

TypeScript estrito e build de produção passaram. Os 57 testes unitários e de serviço passaram e cobrem domínio, importação, rastreabilidade, doses estruturadas, agenda, TLS sem relaxamento de verificação, limites, ETag, conflitos, substituição atômica e proteções da API. Os 18 testes de interface em desktop/celular passaram com transporte controlado e fixtures isoladas.

`npm run test:release` foi executado com a distribuição HTML e a base real:

- Em 1440 × 1000 e 390 × 844, carregou os 10.326 registros, pesquisou Dorflex e Tylenol, abriu a ficha e o link de consulta por registro, persistiu favorito após recarregar e comparou Tylenol e Tylenol Sinus.
- O arquivo portátil executou sem chamadas de API e sem erros JavaScript nesses fluxos. Foi servido isoladamente em loopback para teste do navegador. A navegação `file://` é bloqueada pelo navegador administrado deste ambiente; não foi apresentada como testada aqui.
- Uma base embutida propositalmente adulterada foi rejeitada pela verificação SHA-256.
- O serviço de produção carregou a base real, pesquisou paracetamol e concluiu uma atualização real via API, sem fixtures.
- Campos clínicos ausentes permaneceram sinalizados. A referência PCDT real de metformina foi exibida separadamente da bula de Glifage, após seleção de contexto/apresentação.
- A calculadora converteu a dose matemática de 1 mg em 2 unidades de 0,5 mg, sem gravar valores nem preencher a partir do protocolo.
- Os dois PDFs oficiais tiveram SHA-256 correspondente às versões curadas. A coleção reúne 19 referências, relacionadas a 368 registros, sem afirmar cobertura clínica completa.

O relatório automatizado fica em `releases/validacao-real.json`. Uma verificação isolada de carga inicial em desktop levou aproximadamente 1,5 s neste ambiente; não é benchmark ou garantia de desempenho em outros aparelhos.

## Distribuição

O HTML portátil inclui a base comprimida, com integridade verificada antes da importação, e os scripts inline são autorizados por hash CSP. Não realiza requisições de atualização para uma API inexistente. IndexedDB é usado quando disponível; a base continua consultável em memória quando o navegador bloqueia sua persistência, com aviso explícito.

O runtime Windows Node v24.22.0 foi obtido da distribuição oficial de 14/10/2026. O SHA-256 do ZIP foi conferido com `SHASUMS256.txt` oficial:

`f9683a19877e12a9b167305c8db71040d812876359de21f0d2e97c3f321f80c3`.

Isso verifica o artefato baixado, não o funcionamento em Windows. Não existe máquina Windows neste ambiente; execução do iniciador, integração com navegador e instalação em Windows/Android/iOS reais continuam não testadas. O pacote é portátil, sem instalador Tauri ou APK.

## Limites

A fonte cadastral não contém apresentação, dose, idade, sintomas ou interações documentadas. O Bulário é uma consulta externa interativa; seu roteamento para busca por registro foi conferido no cliente público, sem contornar CAPTCHA ou acessar endpoints protegidos. A disponibilidade de uma bula específica não foi validada. A coleção PCDT separada tem transcrição documental rastreável; isso não constitui revisão clínica individual ou validação de bulas dos registros.

A data de consulta do cadastro não significa revisão clínica. A auditoria de dependências não garante ausência absoluta de vulnerabilidades. Sem SQLite, sincronização, restauração de backup pessoal, execução semanal com o programa fechado ou integração comercial de preços nesta versão.

## Verificações adicionadas na versão 0.4

Os testes incluem exatidão decimal, conversão g/mg/mcg, rejeição de entradas ambíguas, frações de unidades, ausência do fator específico de gotas e volumes incompatíveis com a graduação do dosador. O diálogo foi testado em desktop/celular, inclusive orientações expansíveis, invalidação do resultado após edição, fechamento por Escape e limpeza ao reabrir.

A camada clínica foi testada com PDFs sintéticos isolados para verificar hash, retirada de referências após mudança de documento, rejeição de HTML, manutenção da data original no cache durante falha e correspondência estrita de ingrediente, excluindo associações e sais distintos. O manifesto real passa pela validação de versões e fontes. Veja [critérios de curadoria](curadoria-clinica.md), inclusive divergências internas preservadas.

O pacote Windows 0.4 foi extraído em pasta isolada. Com Node Linux, o servidor incluído iniciou, serviu a interface e retornou 10.326 cadastros e 19 referências; o manifesto clínico está incluído. Isso não substitui o teste do executável/iniciador em Windows. A auditoria npm não apontou vulnerabilidades conhecidas na execução desta etapa.

## Alternativa ao download da prévia

O botão Salvar HTML da distribuição portátil cria um Blob local com os recursos estáticos e a base incluída, sem serializar a interface renderizada ou dados pessoais. O teste de distribuição capturou o download e reabriu a cópia com os 10.326 registros, sem erros JavaScript, em 1440 × 1000 e 390 × 844. Um ZIP contendo o HTML foi conferido por integridade e correspondência de conteúdo. Isso não testa nem corrige o serviço de transferência do ChatGPT ou permissões do iframe dessa plataforma.
