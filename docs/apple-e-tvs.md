# Apple e TVs — versão 0.8.0

Compatibilidade deve ser declarada por sistema e versão. Não existe instalador universal para todos os aparelhos. As compilações e os testes abaixo não comprovam funcionamento em todos os modelos ou controles.

| Família                                             | Entrega                                                       | Situação de instalação                                                                                                                                                  |
| --------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| iPhone/iPad, iOS/iPadOS 15.4+                       | Projeto Capacitor, app para simulador e IPA sem assinatura    | O IPA não instala diretamente. Precisa de assinatura e provisionamento Apple.                                                                                           |
| Mac                                                 | Aplicativo Electron em DMG, arquitetura indicada no nome      | Build inicial sem assinatura/notarização comercial. Validação em Mac físico pendente.                                                                                   |
| Android TV/Google TV                                | APK de teste com launcher Leanback e navegação por setas      | Requer instalação autorizada pelo próprio aparelho e teste no modelo.                                                                                                   |
| Fire TV/Fire TV Stick                               | O mesmo APK da família Android                                | Destina-se a aparelhos com Fire OS/Android compatível; não se aplica automaticamente a aparelhos com Vega OS ou outro sistema.                                          |
| Apple TV, tvOS 17+                                  | App SwiftUI, builds de simulador e dispositivo sem assinatura | Requer provisionamento Apple para dispositivo físico. Primeira interface de catálogo, favoritos e leitura documental; sem paridade completa com o aplicativo principal. |
| LG webOS                                            | IPK de desenvolvimento                                        | Requer Developer Mode oficial da LG e validação do motor web no modelo. Não é publicação na loja.                                                                       |
| Samsung Tizen                                       | Projeto web para o SDK da Samsung                             | Não é WGT assinado ou instalador pronto. Requer Tizen Studio e certificado de TV, além de testes no modelo.                                                             |
| Roku, VIDAA, Saphi, Vega e outros sistemas fechados | Nenhum instalador nesta etapa                                 | Precisam de adaptador/SDK próprio; não são declarados compatíveis.                                                                                                      |

## Instalar em iPhone ou Apple TV

Para iPhone/iPad sem Mac, existe um caminho gratuito com **Windows + AltStore Classic/AltServer**. A assinatura pessoal precisa ser renovada a cada sete dias, com o AltServer disponível. Não é instalação permanente nem publicação na App Store. Veja [as instruções em português](ios-gratuito.md). O IPA compilado aqui ainda depende dessa assinatura local; baixar o arquivo não instala o aplicativo.

Apple TV não é coberta por esse caminho do AltStore Classic. O pacote tvOS continua sem assinatura/provisionamento, e a instalação física permanece pendente. Não foi contratado serviço nem solicitada senha, chave ou assinatura paga.

Os builds de simulador funcionam apenas nos simuladores do Xcode. Não são instaladores de aparelho físico. Desenvolvimento pessoal pelo Xcode usa Mac e provisionamento temporário sujeito às regras da Apple; App Store/TestFlight normalmente exigem associação ao Apple Developer Program. Referência: https://developer.apple.com/support/compare-memberships/ . Essa página não pôde ser consultada pela rede deste ambiente; confirme ali as condições vigentes.

## TVs

As interfaces web para TV têm foco visível, navegação direcional e tratamento do botão Voltar. Android TV recebe banner, categoria Leanback, recurso touchscreen opcional e ponte para Voltar do controle. O pacote de TV usa identificador separado do APK de telefone. Isso permite testar as duas variantes sem misturar a biblioteca local.

Os pacotes usam a base real e as referências existentes. A consulta é offline; atualização automática dos dados nas TVs e nos dispositivos móveis continua pendente. O cálculo converte somente uma dose já prescrita. A versão SwiftUI de Apple TV ainda não inclui calculadora, comparação e anotações; não se presume paridade de recursos.

Samsung/LG dependem do motor web do firmware. O alvo web inicial é Chromium 87 ou mais recente, com BigInt e dialog nativo, mas isso não garante APIs ou persistência em um firmware específico. Modelos antigos não foram adaptados. Não use navegador de TV como comprovação de instalação de aplicativo. A mensagem de carregamento informa possível incompatibilidade se o motor não executar a interface.

A integridade dos recursos nativos é responsabilidade do pacote/assinatura do sistema. Para evitar depender de APIs recentes de descompressão em WebViews, esses pacotes recebem JSON local escapado e validado; o HTML portátil anterior continua usando gzip e SHA-256. O JSON não recebe uma assinatura clínica nova: preserva fontes, versões e o estado documental original.

Documentação dos fornecedores: https://developer.samsung.com/smarttv/develop/getting-started/creating-certificate.html e https://webostv.developer.lge.com/develop/getting-started/developer-mode-app . O acesso a essas páginas estava indisponível na rede deste ambiente; não foram alegadas verificações atuais de certificados ou prazo de Developer Mode.
