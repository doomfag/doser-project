# Doser 0.7 — busca e fichas

## Instalar sem apagar a versão anterior

O APK `Doser-Android-PREVIA-SEPARADA-0.7.apk` é uma **instalação de teste separada**, chamada **Doser 0.7 — prévia**. Ela instala ao lado do Doser anterior. **Não desinstale o aplicativo antigo:** favoritos, anotações e comparações continuam nele; não são transferidos automaticamente para a prévia. A assinatura de depuração anterior não foi preservada pelo processo de build. Não se promete atualização sobre ela, migração automática nem assinatura definitiva. A distribuição Android permanente precisa de uma chave estável guardada com segurança e de um processo de backup/restauração validado. Nenhum pagamento é necessário para criar essa chave.

Windows/Linux/macOS continuam abrindo uma janela própria. Links de bulas e farmácias abrem sites externos quando você escolhe consultá-los. A instalação ainda precisa ser validada nos seus aparelhos.

## O que mudou

- A busca inicial aceita palavras do dia a dia: “dor de cabeça”, “enjoo”, “dor de barriga”, “dor no estômago”, “intestino preso” e outras expressões. Não é necessário selecionar Sintomas. Combinações exigem correspondência documental para todos os sintomas; não há diagnóstico.
- “Dor de barriga” oferece opções simples, como azia, gases e diarreia. Isso ajuda a refinar a pesquisa sem transformar uma expressão ampla em uma receita.
- A busca distingue produtos cadastrados e informações sobre substâncias. Documentos podem aparecer mesmo quando não há um produto correspondente no catálogo de registros. Não cria marcas ou medicamentos fictícios para preencher resultados.
- “Para que serve”, “Quando não usar” e “Cuidados” substituem os rótulos mais técnicos nessas seções. Campos clínicos ausentes não ocupam uma sequência de blocos vazios.
- Foram adicionadas referências oficiais da Anvisa sobre paracetamol, simeticona, hidratação oral, antiácidos, intestino preso, solução salina nasal e aprovação do Aquipta. São 30 referências no total, incluindo as 19 PCDT existentes. **Não são 10.326 bulas completas.** Cadastro regulatório e bula continuam separados.
- Aquipta mostra a informação de aprovação para prevenção de enxaqueca. Isso não indica uso para qualquer dor de cabeça. A notícia não contém sua posologia nem todas as contraindicações; os campos ausentes não foram inventados.
- As referências de baixo risco vêm de um PDF identificado pela Anvisa como IN 106/2021, retificado em 29/11/2021. O cabeçalho do próprio PDF contém divergência de ano, mostrada na interface. Verificar o arquivo hoje não o transforma em bula atual de todas as marcas. O documento tem SHA-256 fixado, e mudanças retiram os dados até conferência.
- Fotos pessoais da embalagem podem ser adicionadas por produto, com concentração/quantidade e origem. São guardadas localmente, limitadas a seis por produto, com verificação de formato e recodificação de imagem. **Não há acervo automático autorizado de fotos conectado.** Não usamos fotos geradas ou imagens de outra marca como identificação do medicamento.
- A ficha lista outros registros com a mesma substância, sem afirmar que podem ser trocados.
- A comparação permite salvar cotações consultadas por você e ordenar por **preço com frete** ou **prazo de entrega**. Só compara o mesmo produto, embalagem e CEP, com estoque informado como disponível e consulta nas últimas 24 horas. Frete desconhecido não vira grátis; prazo ausente não vira entrega imediata. Cotações vencidas são preservadas no histórico, mas saem da ordenação.

## Limites importantes

A ordem dos medicamentos expressa correspondência com a pesquisa, nunca uma escala universal de eficácia. Uma opção mais adequada depende de diagnóstico, indicação, idade, contraindicações e outras condições. Preço baixo não estabelece equivalência terapêutica.

Não existe um medicamento adequado para todo sintoma nem uma base clínica completa nesta versão. Sintomas sem referência conferida recebem uma explicação clara. Fotos automáticas, preços/estoques e prazos comerciais em tempo real continuam sem integração autorizada. A seção de preços usa links externos e comparação manual de valores reais que você informa; não simula ofertas.

Fotos e cotações ficam neste aplicativo/dispositivo. Não há sincronização ou migração automática desses dados. Atualização automática de conteúdo no Android e nas TVs permanece pendente; a atualização desktop depende do aplicativo aberto ou reaberto.

## Validação

Os resultados atuais e os limites dos testes ficam em [docs/validacao.md](https://github.com/doomfag/doser-project/blob/codex/doser-download/docs/validacao.md). Compilar um APK ou testar uma interface em Chromium não comprova o seletor de fotos, o armazenamento ou a instalação em todos os aparelhos físicos.
