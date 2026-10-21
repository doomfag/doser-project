# Doser 0.7.2

Consulta pessoal de medicamentos em React e TypeScript. Sem chatbot, conta, hospedagem ou API paga.

A base real foi consultada na Anvisa em **20/10/2026**: **10.326 registros ativos únicos**, após processar 228.869 linhas, excluir 156.100 linhas fora do critério e remover 62.443 duplicatas. Treze registros incluídos não trazem princípio ativo, sinalizado como ausente. Registro ativo na fonte não confirma estoque ou comercialização. Dose, idade, apresentação e indicação não são fornecidas por esse arquivo cadastral. Em coleção separada, há **30 referências oficiais em quatro documentos**, incluindo 19 PCDT de HAS e DM2 e referências Anvisa sobre sintomas comuns e Aquipta. Há vínculos por substância a 388 registros; outras referências não são ligadas automaticamente por falta de apresentação confirmada. Não são bulas completas desses produtos. Veja [o que mudou e os limites](docs/melhorias-0.7.md).

A integração CMED adiciona **25.219 apresentações em 8.355 fichas**, com vínculo por registro MS e nome do produto. As descrições, datas e fontes são preservadas. Isso não constitui dose recomendada, estoque ou preço comercial real.

## Imagens dos fabricantes

A versão 0.7.2 inclui uma galeria de **15 imagens de apresentações de Dorflex e Novalgina**, consultadas nos sites oficiais. Os arquivos não são redistribuídos no APK: o primeiro acesso usa internet e, no celular, uma cópia privada pode ser guardada após conferir sua integridade. Não há fotos para todos os medicamentos. [Cobertura, termos e instalação](docs/melhorias-0.7.2.md).

## Atualização Android

O usuário já usa o APK anterior. A prévia 0.7.2 instala ao lado dele, com identificador próprio; não desinstale a versão antiga. Favoritos e anotações continuam no aplicativo anterior, sem migração automática. Assinatura definitiva e restauração nativa ainda precisam ser configuradas e validadas. [Instruções de instalação](docs/melhorias-0.7.2.md).

## Apple e TVs

A extensão 0.6 acrescenta projetos/builds para iPhone/iPad, Apple TV, Android TV/Google TV/Fire TV e LG webOS, além de um projeto Samsung Tizen. [Veja a matriz de suporte e as limitações de assinatura](docs/apple-e-tvs.md). Não há alegação de compatibilidade universal: versões Apple sem assinatura não são instaladores prontos para dispositivo físico; Samsung requer certificado do SDK. As compilações ficam no workflow [iOS e TVs](https://github.com/doomfag/doser-project/actions/workflows/extended-platforms.yml).

## Aplicativos para instalar

A distribuição usa Electron para Windows/Linux/macOS e Capacitor para Android. Os instaladores de teste ficam em [Releases](https://github.com/doomfag/doser-project/releases). O workflow [Aplicativos instaláveis](https://github.com/doomfag/doser-project/actions/workflows/native.yml) produz instaladores e APK quando os trabalhos concluem com sucesso. Consulte [instruções e limites](docs/aplicativos.md). Não é necessário abrir o aplicativo instalado no navegador. A atualização automática do catálogo no Android ainda está pendente.

## Formatos anteriores de consulta

### Arquivo portátil

Abra `releases/Doser.html` no navegador. Ele inclui a base cadastral comprimida e verificada por SHA-256. Busca, comparação, favoritos, histórico e anotações não precisam do serviço local. As consultas ao Bulário e às farmácias exigem internet.

Dentro da cópia portátil, **Salvar HTML** cria um download pelo navegador, como alternativa ao botão da prévia. A cópia inclui o aplicativo e a base de distribuição, sem anotações, favoritos, histórico ou importações pessoais. Esses dados devem ser exportados separadamente. Navegadores ou prévias com downloads bloqueados ainda podem impedir a gravação; o aplicativo informa apenas que enviou a solicitação.

A cópia HTML não consegue baixar automaticamente o CSV da Anvisa: o servidor da fonte não fornece os cabeçalhos CORS necessários ao acesso direto do navegador. O painel informa isso e não simula uma atualização. Para renovar, importe dados ou baixe uma nova cópia gerada pelo programa local. O comportamento de armazenamento de arquivos locais varia entre navegadores; exporte seus dados e mantenha o arquivo. Se IndexedDB estiver bloqueado, a base incluída ainda pode ser consultada em memória, com aviso de que não será persistida.

### Windows x64, pacote portátil

1. Extraia **todo** `releases/Doser-Windows-x64.zip` para uma pasta.
2. Abra **Iniciar Doser.cmd**.
3. O programa abre o navegador. Mantenha a janela de execução aberta.
4. Para encerrar, feche a janela ou pressione `Ctrl+C`.

O pacote inclui o runtime Node oficial e sua licença, a dependência de parsing, o aplicativo compilado e a base cadastral. Não exige instalar Node ou dependências. O ZIP oficial do Node tem SHA-256 conferido contra o arquivo de checksums da distribuição oficial; proveniência fica na pasta `runtime`.

**Limite de validação:** o servidor e os fluxos foram testados em Linux, inclusive com a base real. O iniciador e runtime Windows ainda precisam de teste em Windows 10/11 x64 real. Trata-se de um pacote portátil, não de instalador Tauri. Esse formato histórico não é o APK Android disponível nas Releases. O HTML pode ser consultado em navegador compatível; isso não equivale a um aplicativo Android instalado.

## Executar pelo código

Instale Node.js 24 LTS atualizado (mínimo 24.5). No terminal da pasta do projeto:

```sh
npm ci
npm run catalog:update
npm run build
npm start
```

Se `.doser/catalog.json` já veio com o ambiente, o comando de atualização é opcional. O terminal informa a porta local 4173. O serviço de produção aceita apenas conexões da própria máquina. `npm run dev` inicia o modo de desenvolvimento na porta 5173; não exponha Vite à internet. `npm run preview` serve apenas estáticos e não fornece a API de atualização.

A biblioteca é vinculada ao navegador e à origem/porta. Trocar de `localhost` para `127.0.0.1`, mudar a porta ou o modo de execução pode mostrar outra biblioteca. Limpar os dados do navegador pode apagá-la. Não há sincronização nem criptografia própria. Exporte cópias e não registre dados identificáveis de pacientes. A restauração validada de backups pessoais ainda está pendente.

## Atualização real

No programa local, **Dados e ajustes → Atualizar agora** baixa e valida o arquivo oficial. A opção semanal verifica enquanto o aplicativo está aberto ou ao reabri-lo depois de uma semana. Falhas têm intervalo mínimo automático de uma hora e preservam a base anterior. ETag evita repetir o download sem alterações. Não há atualização com o computador desligado ou o programa fechado.

O acesso que estava bloqueado foi restabelecido nesta tarefa. O download real, o formato e uma atualização real via API foram verificados. Os domínios necessários são `dados.anvisa.gov.br`, `www.gov.br` e `consultas.anvisa.gov.br`. O serviço consulta URLs fixas dos CSVs cadastral e CMED e dos quatro documentos oficiais do manifesto clínico, sem token ou chave. A versão dos PDFs é conferida por SHA-256; documentos alterados têm os esquemas retirados até revisão.

Use uma única instância do serviço por pasta. Para atualizar pelo terminal, pare o serviço, execute `npm run catalog:update` e reinicie-o. Para gerar uma nova cópia HTML com a base atual:

```sh
npm run build:portable
```

O pacote Windows é reproduzido por `scripts/package-windows.py` com um ZIP oficial do Node e seus metadados de checksum já verificados. Não desative a verificação para montar uma distribuição.

## Funcionalidades

- Busca por nome, princípio ativo, classe e aliases, com autocomplete e indicação de correspondências aproximadas.
- Resultados em lotes de 40; detentor e número de registro distinguem produtos de nomes iguais.
- Fichas em Visão geral, Como usar e Informações técnicas.
- Referências PCDT separadas das informações do produto, com página, versão, condições e conflitos documentais sinalizados.
- Calculadora de quantidade para uma dose já prescrita: comprimidos/cápsulas inteiros, mL compatíveis com a graduação e gotas com fator específico. Explica como calcular, quando usar e por quê; não escolhe a dose.
- Link do Bulário filtrado pelo registro, conforme o roteamento público do portal.
- Comparação de até quatro registros, sem atestar intercambialidade; campos ausentes não são tratados como iguais.
- Favoritos, histórico, comparações salvas e anotações pessoais por categoria.
- Importação JSON com fontes (até 50 MiB por arquivo), exportação e cache IndexedDB.
- Links externos de farmácias e CMED, sem preços ou estoques simulados.
- Interface responsiva, efeitos discretos e respeito a movimento reduzido.

## Limites clínicos

O CSV cadastral não é uma base de bulas. As 30 referências oficiais incluem protocolos de hipertensão e diabete tipo 2 em adultos, documentos Anvisa sobre sintomas comuns e aprovação do Aquipta; exigem leitura das condições e não substituem a bula de cada apresentação. A busca por sintomas só encontra indicações documentadas; a ausência de resultados não exclui uma condição. A maior parte dos registros ainda não possui informações clínicas. Não são estimadas doses, horários, idades mínimas ou interações ausentes.

Na **Calculadora**, informe a dose prescrita **por tomada** e a concentração da embalagem. Exemplo apenas matemático: 1 mg ÷ 0,5 mg por comprimido = 2 comprimidos. O programa não arredonda, não autoriza partir comprimidos ou trocar formulações e não calcula doses pediátricas nem verifica adequação clínica. Os dados do formulário não são gravados. Leia [curadoria e limites](docs/curadoria-clinica.md).
O portal do Bulário possui mecanismos interativos de verificação; não tentamos contorná-los nem usamos APIs protegidas para extração em massa. Links abrem a consulta oficial, não prometem um PDF específico disponível ou um resultado clínico validado. SQLite/FTS5, ampliação da revisão clínica, atualização de bulas, assinatura definitiva dos instaladores e agendamento de sistema continuam pendentes.

## Testes

```sh
npm run typecheck
npm test
npm run build
npm audit
```

Para interface, instale Chromium com `npx playwright install chromium` ou use o já instalado:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

Com o serviço de produção iniciado e `releases/Doser.html` gerado, verifique a distribuição usando os registros reais, incluindo atualização de rede:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:release
```

O relatório fica em `releases/validacao-real.json`. Testes de dimensões móveis não substituem Android/iOS reais. Fixtures são sintéticas, isoladas e não entram na distribuição. Veja [arquitetura](docs/arquitetura.md), [formato do catálogo](docs/catalogo.md) e [validação](docs/validacao.md).

Para iPhone/iPad sem Mac, consulte [o caminho gratuito com Windows e AltStore Classic](docs/ios-gratuito.md). Ele exige renovação de assinatura a cada sete dias e não cobre Apple TV. Os downloads de teste de iPhone e TVs ficam em [Releases](https://github.com/doomfag/doser-project/releases); a IPA requer assinatura pessoal antes de instalar.
