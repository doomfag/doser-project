# Aplicativos instaláveis — Doser 0.5

O objetivo de distribuição passa a ser aplicativo instalado. O HTML permanece uma alternativa de consulta; não é o instalador.

## Desktop

Electron abre uma janela independente com ícone Doser. O mecanismo de consulta e atualização roda dentro do aplicativo. Não inicia o navegador nem um servidor TCP. A origem própria `doser://app` é estável para preservar a biblioteca entre aberturas.

A escolha inicial de Electron reutiliza o importador Node já testado, sem instalar Node no computador do usuário. Tauri exigiria reimplementar esse serviço ou distribuir um processo auxiliar. O custo é um instalador maior.

A base inicial é copiada uma única vez para a pasta de dados do usuário. Atualizar ou reinstalar o programa não deve sobrescrever o catálogo existente. Fontes clínicas mantêm a verificação de versão. A interface não recebe acesso ao Node: sandbox, isolamento de contexto, permissões negadas e navegação externa controlada. Links de bulas/farmácias abrem o navegador por ação do usuário.

Gerar: `npm ci`, `npm run desktop:build`. Windows gera instalador NSIS .exe; Linux gera pacote .deb com entrada no menu de aplicativos. O instalador Windows inicial não possui assinatura comercial. Não desative proteções do sistema para instalá-lo; assinatura e instalação em dispositivos reais ainda precisam de validação.

## Android

Capacitor gera um projeto Android real e APK instalável com a mesma interface e a base local. `npm run android:prepare` gera os recursos e sincroniza o projeto. Android SDK e Java 21 são necessários para compilar; `android/gradlew assembleDebug` produz o APK inicial de teste, com assinatura de depuração.

Não é um atalho de navegador. O catálogo inicial, pesquisa, fichas, comparação e calculadora são locais na WebView do aplicativo. A atualização automática no Android ainda não tem adaptador nativo e fica explicitamente indisponível. Não há alegação de teste em aparelho, exportação nativa de arquivos ou assinatura definitiva. Sem chave estável de distribuição, APKs de teste de builds distintos podem não atualizar sobre a instalação anterior; não desinstale sem exportar dados.

## Obter os instaladores

A automação `Aplicativos instaláveis`, na aba Actions do GitHub, compila Windows, Linux e Android em máquinas adequadas. Os resultados aparecem em Artifacts somente após conclusão bem-sucedida dos trabalhos. É necessário entrar no GitHub para baixar artefatos. Retenção inicial de 14 dias. Os executores padrão de repositório público são usados; não ativa hospedagem, Pages ou publicação em lojas.

A janela Electron foi executada neste ambiente Linux com um servidor gráfico virtual: catálogo, pesquisa, calculadora e isolamento Node passaram. A auditoria npm não apontou vulnerabilidades conhecidas após ajuste das dependências de empacotamento. Isso não substitui instalação em computador/aparelho real.

Não confunda automação configurada com build aprovado. Consulte os resultados de cada sistema. A configuração testa a janela Electron e seu isolamento, pesquisa e catálogo no Windows/Linux; APK requer teste posterior em aparelho Android. iOS continua pendente.
