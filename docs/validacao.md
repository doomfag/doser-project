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

## Aplicativos instaláveis — 0.5

- Desktop Electron: janela independente, origem doser://app, 10.326 registros, pesquisa e calculadora passaram no teste de execução nativa. A interface não expôs require/Node. O teste passou neste Linux com servidor gráfico virtual e nos jobs Windows/Linux do GitHub.
- O aplicativo Linux já empacotado em ASAR foi executado separadamente e carregou a base real. O pacote .deb foi gerado e seus metadados conferidos. A instalação pelo gerenciador de pacotes ainda requer teste no computador do usuário.
- O teste Linux em ambiente de automação usa --no-sandbox devido às limitações do executor. Essa opção não é enviada ao aplicativo instalado; a janela de produção configura sandbox e isolamento. Isso limita a verificação de sandbox Linux neste ambiente.
- Android: projeto gerado/sincronizado localmente; APK compilado com sucesso no workflow 39450238625. Ainda não foi instalado nem exercitado em aparelho/emulador Android. A atualização automática permanece indisponível nessa plataforma e a assinatura é de depuração.
- 57 testes unitários/serviço e TypeScript passaram após a adaptação. Auditoria npm completa apontou zero vulnerabilidades conhecidas com as versões e override de empacotamento atuais.
- Windows/Linux são artefatos instaláveis, distintos do ZIP anterior que apenas iniciava o navegador. Não há afirmação de assinatura comercial ou instalação física validada.

A execução final [39450238625](https://github.com/doomfag/doser-project/actions/runs/39450238625), commit e71ab3b, concluiu com sucesso os três trabalhos: Windows (teste da janela e instalador NSIS), Linux (teste da janela e pacote Debian) e Android (APK de teste compilado). Os três artefatos foram publicados no GitHub Actions; os arquivos exigem conta GitHub para download e ficam retidos por 14 dias. Nenhuma instalação física Android ou assinatura comercial Windows foi alegada.

## iOS, macOS e TVs — 0.6

Em 20/10/2026, os workflows [39453915295](https://github.com/doomfag/doser-project/actions/runs/39453915295) e [39453915293](https://github.com/doomfag/doser-project/actions/runs/39453915293), commit a898361, concluíram com sucesso:

- Windows, Linux e macOS: teste da janela Electron e empacotamento; Android: compilação do APK.
- iPhone/iPad: compilações para simulador e dispositivo sem assinatura; instalação e abertura no simulador iPhone, com captura de tela. Isso não comprova os fluxos completos nem instalação em aparelho físico.
- Android TV/Fire OS: APK com launcher de TV compilado. Sem teste físico ou emulador Android TV.
- Apple TV: app SwiftUI compilado para simulador e dispositivo sem assinatura. Sem execução/instalação física validada.
- LG: IPK gerado pelo CLI oficial. Samsung: ZIP de projeto, sem assinatura ou WGT instalável.
- TV web em Chromium: base real, navegação por setas/Enter/Voltar, ficha e calculadora, sem API, erros JavaScript ou estouro horizontal. Não substitui testes nos motores de firmware de Samsung/LG.
- 61 testes unitários/serviço, TypeScript e build passaram. Auditoria completa npm: zero vulnerabilidades conhecidas; isso não é garantia de ausência de falhas.

Os pacotes móveis e de TV preservam o catálogo offline; atualização automática nessas plataformas permanece pendente. Apple TV tem conjunto de recursos reduzido. Consulte [a matriz de plataformas](apple-e-tvs.md) e [instalação gratuita iPhone/iPad com Windows](ios-gratuito.md). As compilações posteriores corrigem a versão interna da IPA para 0.6.0 e acrescentam publicação de downloads públicos de teste; a execução dessas alterações é registrada separadamente no GitHub Actions.

## Downloads externos — 0.6

A execução [39456404738](https://github.com/doomfag/doser-project/actions/runs/39456404738), fonte 4bdd537, concluiu os quatro builds e a publicação da [prévia iPhone/TVs](https://github.com/doomfag/doser-project/releases/tag/v0.6.0-apple-tv-preview). iOS abriu no simulador. Foram baixados novamente, por HTTPS público, a IPA, o APK TV e o IPK LG; seus SHA-256 corresponderam a SHA256SUMS.txt publicado. A IPA contém identificador io.github.doomfag.doser, versão 0.6.0/build 6, mínimo iOS 15.4 e catálogo nativo embutido. A assinatura pessoal e a instalação física continuam pendentes.

O workflow nativo [39456098574](https://github.com/doomfag/doser-project/actions/runs/39456098574), fonte 969f8fc, passou em Windows/Linux/macOS e Android. O primeiro publicador separado de desktop recebeu HTTP 403 ao tentar criar a release para uma referência anterior. A tag explícita v0.6.0-desktop-android-preview foi criada pelo acesso Git autorizado, e o publicador exige agora essa tag existente, sem mudar main ou solicitar credenciais. O resultado da publicação é registrado em [39457757093](https://github.com/doomfag/doser-project/actions/runs/39457757093).

A reinstalação congelada de dependências foi repetida com cache Electron/npm no workspace, seguida de native:prepare e build:portable; todas passaram. As instruções reutilizáveis install_script e start_skill foram atualizadas no rascunho do ambiente. Salvar o rascunho não publica a configuração.

## Busca cotidiana e fichas — 0.7, 20/10/2026

- TypeScript estrito, build e 75 testes unitários/serviço passaram. A suíte completa passou com **26 testes de interface**, divididos entre desktop e celular. Casos novos cobrem linguagem popular na busca inicial, contexto de dor de barriga, referência sem cadastro de marca, custo com frete separado de prazo, persistência de cotações, imagem raster local e rejeição de arquivo disfarçado, além de seleção por busca na comparação.
- `scripts/verify-improvements.ts` usa o catálogo real, sem fixtures: “dor de cabeça” retornou 18 registros com indicação documental. Aquipta foi excluído dessa busca genérica e apresentou a informação oficial de prevenção de enxaqueca na sua ficha. “Dor de barriga”, gases e diarreia foram exercitados em 1440 e 390 pixels, sem erros JavaScript ou estouro horizontal. Uma medição local do filtro de 10.326 registros ficou em aproximadamente 10 ms; não é garantia para outros aparelhos.
- `npm run test:release` passou nos dois tamanhos, verificando a distribuição offline, integridade, favoritos, comparação, PCDT, calculadora, cópia interna sem dados pessoais e atualização real pela API. A expectativa antiga de zero resultados para dor de cabeça e febre foi substituída pela exigência de paracetamol documental e ausência de Aquipta na busca genérica.
- O catálogo real continua com 10.326 cadastros ativos únicos. São **30 referências em quatro documentos**, relacionadas a 388 registros; referências com apresentação não confirmada podem ser consultadas separadamente. Isso não constitui 10.326 bulas completas.
- O PDF LMN da Anvisa respondeu como PDF e teve SHA-256 `d3e98bb910036dbf14cc8ed61d49dd4861926f7d9cfc338590be3f8a830fa699`. A divergência de ano do cabeçalho e o caráter de referência de 2021 estão expostos. A notícia oficial de Aquipta usa texto público da representação JSON Plone, com hash de texto estável `cd298aa456dafdc85a57df861dd361455876f787ce73c740e2f67fd5466e41d7`. Alterações de conteúdo retiram os vínculos até conferência; navegação e imagens do portal não entram no hash clínico. Não foram usados endpoints protegidos do Bulário.
- O teste da janela Electron passou neste Linux após instalar o binário com o cache e proxy corretos; o teste inicial sem essas variáveis falhou no download, sem indicar defeito da aplicação. A auditoria npm completa não apontou vulnerabilidades conhecidas. Isso não certifica ausência absoluta de falhas.
- O projeto Android confirmou ID `io.github.doomfag.doser.preview07`, versão 0.7.0 e código 7. O workflow também confere o manifesto do APK compilado antes do upload. A prévia tem instalação separada e não migra a biblioteca do APK anterior; assinatura de produção estável e restauração nativa permanecem pendentes. Não foi testada em aparelho físico.
- Fotos são pessoais e locais; não há acervo automático autorizado conectado. Cotações comerciais são informadas pelo usuário. BVS, FDA, NIH e consultas a três farmácias foram canceladas pela rede do ambiente; nenhuma oferta, entrega ou foto comercial foi importada ou simulada. Destinos adicionais foram salvos no rascunho da rede, sem alegar aplicação ou autorização comercial.

Relatórios e capturas locais: `releases/validacao-melhorias-0.7.json`, `releases/validacao-real.json`, `releases/busca-cabeca-390.png` e `releases/ficha-aquipta-390.png`. São verificações da interface em Chromium; não substituem instalação e uso em Android/iOS/TV física. Os resultados dos empacotamentos 0.7 ficam nos workflows e nas páginas de release após conclusão bem-sucedida.

## Apresentações oficiais — 0.7.1, 20/10/2026

- TypeScript, build, **82 testes unitários/serviço** e a suíte completa de **26 testes de interface** passaram. A distribuição offline foi novamente exercitada em 1440 e 390 pixels com o catálogo real, incluindo dor de cabeça, refinamento de dor de barriga, gases, diarreia, Aquipta e embalagens de Dorflex. Não houve erro JavaScript nesses percursos. `test:release` passou novamente, incluindo integridade, biblioteca e atualização real pela API.
- A fonte gratuita `https://dados.anvisa.gov.br/dados/TA_PRECO_MEDICAMENTO.csv` forneceu 17.148.070 bytes, SHA-256 `e843e1ba8cbe781692101282ac4e7dee10ae66ad262a620aa03abc781918c7cf`. O importador encontrou 26.634 linhas válidas e vinculou **25.219 apresentações distintas a 8.355 fichas** existentes por prefixo de registro e nome exato normalizado. Colunas de preços foram descartadas. A data Last-Modified permanece como metadado do servidor, sem ser apresentada como publicação clínica.
- O updater compilado em `build-native/updater.mjs` foi executado separadamente com a base real em pasta temporária: atualização concluída, 8.355 produtos/25.219 apresentações, sem erro. Testes de importação cobrem formato, registro/nome, ausência de inferência clínica, retirada de apresentações, cache datado e fallback do snapshot distribuído.
- A preparação de TV e `test:tv` passaram com dados reais, teclado/controle simulado, retorno e calculadora. Isso continua sendo teste em Chromium, não em firmware de TV.
- O projeto Android gerado confirmou `io.github.doomfag.doser.preview071`, versão 0.7.1/código 8. A prévia mantém os dados do APK antigo no aplicativo antigo; não há migração automática. A compilação e o manifesto do APK são conferidos no workflow antes de publicar. Instalações físicas, assinatura definitiva e restauração nativa permanecem pendentes.

### Downloads públicos 0.7.1

O workflow [39516615752](https://github.com/doomfag/doser-project/actions/runs/39516615752), fonte `11ba06e`, passou em Windows, Linux, macOS, Android e publicação. [Release desktop/Android](https://github.com/doomfag/doser-project/releases/tag/v0.7.1-desktop-android-preview). Os downloads foram refeitos por HTTPS público, sem login, e os hashes corresponderam ao arquivo SHA256SUMS.txt publicado:

- APK separado: 5.574.417 bytes; SHA-256 `22a8d3d257ca2117fb43c8d7613d8cde14b6c211ee72cf29e4a328f92551df15`.
- Windows Setup: 112.165.645 bytes; SHA-256 `3bc7e142bf3bb74a0e646867512d1da6ac7a9ca612dd8f025f196ac7d12196c3`.

O manifesto Android compilado foi conferido com aapt2 no CI (pacote separado, código 8, versão 0.7.1). O HTML nativo extraído do APK público confirmou 10.326 registros, 30 referências e 25.219 apresentações em 8.355 fichas. O teste local da janela Electron 0.7.1 passou; `npm audit` completo não apontou vulnerabilidades conhecidas. Isso não atesta instalação física nem ausência absoluta de falhas. `main` foi preservado, com trabalho no branch `codex/doser-download`.
