# Arquitetura do Doser 0.5

## Interface e domínio

React 19, TypeScript estrito e Vite, sem serviços pagos. CSS com tokens preserva a identidade visual e permite novas referências. Navegação por fragmentos de URL; mesma interface planejada para Tauri e Capacitor. Há contêiner Electron para Windows/Linux e Capacitor para Android. Não há serviço de sistema em segundo plano.

- `src/domain/catalog.ts`: medicamentos, proveniência por campo, regimes documentados por apresentação/população, normalização, índice textual em memória, comparação e validação de importações.
- `src/domain/updateSchedule.ts`: agenda semanal e intervalo mínimo de uma hora após tentativa automática.
- `src/data/catalogStore.ts`: snapshot transacional IndexedDB, migração do catálogo legado, separação entre registros oficiais e manuais.
- `src/data/storage.ts`: biblioteca pessoal versionada e exportações.
- `src/hooks/useCatalog.ts`: hidratação do cache, serialização das gravações, sincronização do serviço local, preferência semanal e estado de falha/progresso.
- `src/components`: componentes compartilhados, progresso de leitura, fontes, seção de uso e painel de atualização.
- `src/pages`: ficha progressiva e preços. `src/App.tsx` compõe navegação e demais telas.
- `server/anvisa.ts`: adaptador CSV cadastral candidato da Anvisa.
- `server/updater.ts`: download, limites, ETag, hash de versão, validação e substituição atômica do snapshot.
- `server/middleware.ts`: API restrita ao serviço local, compartilhada por Vite e produção.
- `server/index.ts`: serviço Node de produção, estáticos compilados e API, ligado a `127.0.0.1`.
- `src/test`, `server/*.test.ts`, `e2e`: verificações com fixtures isoladas.

## Dados e abrangência

Há uma coleção clínica separada, com 19 referências PCDT e vínculo exato por princípio ativo; consulte [curadoria](curadoria-clinica.md). O adaptador cadastral usa a URL `https://dados.anvisa.gov.br/dados/DADOS_ABERTOS_MEDICAMENTOS.csv`. Espera CSV delimitado por ponto e vírgula, UTF-8 ou Windows-1252, com cabeçalhos documentados no adaptador. Só aceita status ativos reconhecidos, exige registro numérico e rejeita mudanças de esquema. Inclui todos os registros ativos reconhecidos, não filtra doenças raras ou faz inferência de prevalência. Contabiliza excluídos, duplicatas e princípios ativos ausentes. Deduplica pelo registro; não infere apresentação.

O acesso à fonte foi restabelecido e o download real foi validado em 20/10/2026: 228.869 linhas produziram 10.326 registros ativos únicos. A fonte e seu hash estão documentados em docs/validacao.md. Há transcrição rastreável de dois PCDTs oficiais; não há scraping do Bulário. O uso segue pessoal; não foi estabelecida uma licença específica para distribuição pública do CSV ou de documentos clínicos. A página institucional informa licença para seu conteúdo, o que não foi presumido como licença de documentos de terceiros.

Cadastro regulatório não contém necessariamente apresentação, dose, idade ou indicação. O adaptador não fabrica esses campos. O registro preserva URL, data de obtenção e SHA-256 da fonte como versão; `pending` indica ausência de revisão documental clínica. Nenhum status importado é certificado pelo aplicativo.

JSON manual versão 1 continua aceito, com até 50 MiB por arquivo e 100.000 registros. `usage` é opcional e contém regime por apresentação e população. Cada regime exige texto de dose e sua fonte. Campos opcionais ausentes não recebem valores calculados. Não se extrapolam doses entre concentrações ou unidades. Bulas e PubMed seguem como fontes externas; PCDTs têm coleção própria em data/clinical/curated.json. A revisão documental é separada do importador cadastral.

## Busca e apresentação

Índice em memória normaliza textos uma vez por alteração da base, evitando refazer a normalização a cada tecla. A digitação usa valor diferido; resultados são exibidos em lotes de 40. Busca por sintomas considera somente indicações com validação declarada, requer todos os termos e não diagnostica. Aliases precisam ter origem documental; não existe dicionário clínico presumido.

A ficha mostra visão geral, uso e detalhes técnicos separadamente. Regime de uso só é exibido após escolha explícita de apresentação/população. Intervalo documental não é uma agenda personalizada. A calculadora faz conversão exata de uma dose já prescrita em unidades de uma apresentação informada, com orientações e limites. Não há cálculo pediátrico, escolha de dose ou horários, conversão de comprimidos para gotas ou avaliação clínica individual. Comparação nunca certifica equivalência ou intercambialidade.

Microinterações incluem transição de tela, foco e reflexo na busca, seleção de filtros, destaque de linhas, favoritos, abas, expansão de detalhes, avisos e progresso indeterminado de atualização. Animações usam principalmente transformação/opacidade. Movimento reduzido desativa efeitos não essenciais. Não há bibliotecas de partículas ou scripts externos.

## Atualização e persistência

A atualização manual usa POST com destino externo fixo no servidor. A opção semanal verifica na abertura, em retomada da aba/conexão e a cada hora enquanto o programa está aberto; atualiza quando a última verificação bem-sucedida tem pelo menos sete dias. Não há atualização com computador desligado nem programa fechado. Falhas têm espera automática mínima de uma hora, sem bloquear a consulta ao cache. Várias solicitações simultâneas compartilham uma operação. Uma instância do serviço deve usar cada pasta `.doser`.

O download limita tamanho a 100 MiB, registros a 100.000 e linhas a 250.000. Redirecionamentos são rejeitados para evitar envio a destinos inesperados; uma mudança oficial exige revisão do adaptador. TLS permanece validado. ETag evita baixar novamente a fonte sem alteração. SHA-256 identifica a versão, não é assinatura oficial nem validação científica.

Download incompleto, HTML de erro, esquema alterado, ausência de registros ativos e queda superior a 50% de uma base com mais de 100 registros impedem substituição. O arquivo temporário só substitui `catalog.json` após validação e gravação completas. Falha não atualiza a data de sucesso. IndexedDB só muda após sincronização validada; importações manuais são preservadas e têm preferência sobre IDs coincidentes na visualização.

Favoritos e anotações permanecem no navegador, sem envio para a API cadastral. A biblioteca depende da origem/porta usada; `npm run dev` e `npm start` possuem origens diferentes. Exportar dados é necessário antes de limpar o navegador ou trocar a origem. Não há criptografia própria, sincronização ou restauração validada do backup pessoal. A instalação local usa a base oficial já baixada. A versão HTML inclui a base comprimida e verificada; coleções manuais continuam separadas.

## Segurança

React escapa texto; não há HTML arbitrário, eval, modelos de linguagem ou CDN. CSP mantém scripts/conexões na origem, com WebSocket local para desenvolvimento. URLs documentais exigem HTTPS sem credenciais; links externos usam `noopener noreferrer`. As importações têm limites de campos e tamanho.

O serviço de produção liga apenas a loopback. A API verifica o Host contra nomes/endereços da própria máquina, rejeita `Sec-Fetch-Site: cross-site`, não habilita CORS e exige Origin correspondente e cabeçalho próprio no POST. Há intervalo mínimo de 30 segundos entre inícios manuais. O endereço da fonte não vem de parâmetros do usuário, reduzindo risco de SSRF. Estáticos são restritos a `dist`, sem exposição de `.doser` ou fontes. Não há autenticação multiusuário ou suporte a hospedagem pública. Não exponha Vite à internet.

Dependências têm lockfile e auditoria. Esses controles e testes reduzem riscos sem garantir ausência absoluta de vulnerabilidades. A ingestão cadastral real e uma atualização de rede foram verificadas; a cobertura clínica inicial é parcial e não equivale à revisão de bulas de todos os registros.

## Próximas etapas

SQLite com migrações e FTS5 será adotado com os contêineres nativos, mantendo interfaces de repositório e domínio independente. IndexedDB resolve a limitação anterior de quota pequena do localStorage para o catálogo web. Não simulamos um banco SQLite inexistente.

Windows: Tauri 2, WebView2, Rust e permissões mínimas; requer build/teste no Windows. Android: Capacitor e adaptador SQLite auditado, Android SDK/JDK, assinatura e teste em aparelho. iOS exige macOS/Xcode e avaliação de custos de assinatura/distribuição. Agendamento de sistema com o app fechado pertence à etapa nativa.

Importação de bulas, cobertura clínica de medicamentos de uso comum, revisão de posologia/idade por apresentação, conflitos entre documentos, interações cruzadas, atualização clínica e integrações comerciais autorizadas continuam pendentes. Priorizar medicamentos frequentes na curadoria clínica, sem excluir os demais cadastros disponíveis. CMED e pesquisas de farmácias continuam separados dos preços efetivos e estoques.

## Distribuição portátil

`scripts/portable.ts` gera um HTML com scripts e CSS incluídos, script autorizado por hash CSP e snapshot gzip/base64 com SHA-256. `src/data/embeddedCatalog.ts` verifica e descomprime a base antes de validá-la. O modo portátil não chama APIs inexistentes nem promete atualização semanal direta: a fonte não informa cabeçalhos CORS para acesso pelo navegador. O programa local mantém a atualização semanal.

`scripts/package-windows.py` reúne dist, módulos de servidor, domínio, csv-parse com licença, cadastro, manifesto clínico e Node Windows oficial com checksum previamente conferido. O iniciador executa Node em primeiro plano e solicita a abertura do navegador; o serviço continua ligado apenas a loopback. Não há instalação de serviço de sistema ou sincronização. O pacote ainda precisa de teste em Windows real.

`scripts/verify-release.ts` testa a distribuição com o catálogo real, incluindo consulta, persistência, comparação, recusa de adulteração e atualização real da API. Os testes comuns usam transporte controlado para não depender do conteúdo ou disponibilidade diária da Anvisa.

## Módulos clínicos e cálculo

`server/clinical.ts` verifica PDFs oficiais contra versões fixas do manifesto, retira referências quando o documento muda e preserva cache anterior com data original durante falhas de rede. `server/createUpdater.ts` compõe o importador de cadastro com essa verificação. Referências normalizadas ficam na raiz do snapshot; registros guardam apenas IDs, evitando replicar texto clínico em centenas de produtos. `ClinicalReferences` mostra o contexto separado da bula; `ComparisonFact` identifica a origem na comparação.

`src/domain/doseConversion.ts` usa BigInt e frações reduzidas, converte somente unidades de massa suportadas e recusa quantidades que exijam arredondamento/fracionamento. `DoseConverter` usa diálogo nativo acessível, limpa o resultado a cada edição e explica finalidade, método e limitações. Não há persistência de valores ou preenchimento automático por dose de protocolo.

## Distribuição instalada (0.5)

A distribuição desktop usa Electron para reaproveitar o importador Node verificado, com custo de instalador maior que Tauri. Não abre navegador ou servidor TCP. O protocolo interno doser://app serve arquivos e uma API restrita; a origem estável preserva IndexedDB. A janela não acessa Node, possui contexto isolado e sandbox configurado. O primeiro catálogo é copiado para userData sem sobrescrever versões existentes. O manifesto clínico permanece no pacote e seu caminho é passado explicitamente ao importador.

Capacitor usa o catálogo verificado embutido no Android; o adaptador automático de atualização Android ainda está pendente e a interface informa essa limitação. O projeto é gerado por scripts/android.ts com backup Android desativado e identidade visual Doser. A assinatura inicial é de depuração. SQLite e assinatura definitiva continuam pendentes. Consulte aplicativos.md para distribuição e limites.

O workflow nativo compila em Windows e Ubuntu, testa a janela Electron e publica artefatos do instalador; compila o APK com Java 21/Android SDK 36 em trabalho separado. Artefatos não equivalem a instalação validada em dispositivos físicos.
