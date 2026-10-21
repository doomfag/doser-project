# Doser 0.8.0 — galeria ampliada

## Instalar no Android

Baixe **Doser-Android-0.8.0.apk** nos arquivos desta versão e abra no celular. Autorize a instalação pelo aplicativo usado para baixar somente se o Android solicitar. Depois da instalação, abra **Doser** pela lista de aplicativos; não é necessário abrir um navegador.

Este APK é uma versão de teste, assinada com uma chave de desenvolvimento, não uma distribuição pela Play Store. Se aparecer conflito de assinatura com uma instalação antiga de mesmo identificador, desinstale a antiga e instale esta. **Desinstalar apaga os dados locais do aplicativo antigo.** Nesta entrega, o usuário informou que não tem dados a preservar e autorizou a reinstalação. Não há migração automática nem garantia de atualização futura com a mesma assinatura. Uma instalação antiga chamada “Doser 0.7.2 — prévia” pode continuar ao lado desta; ela não recebe esta galeria.

## Usar a galeria

São **100 medicamentos e 548 imagens distintas**, com pelo menos três por registro. Veja [a lista completa e as quantidades](medicamentos-com-imagens.md). Há embalagens, apresentações e material comercial das fontes. Nem todas são fotografias de ângulos diferentes; textos promocionais não são informações clínicas validadas pelo Doser. Foram excluídos avisos genéricos de produto sem imagem e arquivos específicos de instrução de dose identificados na revisão visual.

Abra a ficha do medicamento e vá até **Fotos e embalagens**. As miniaturas alternam as imagens da apresentação selecionada. **Ver outra embalagem** separa as apresentações pelo código de barras, para não misturar concentrações, quantidades e formas diferentes. Uma ficha pode reunir fotos de várias apresentações; nem toda apresentação tem várias vistas disponíveis. As imagens publicadas pelas fontes podem mostrar caixa, frasco, cartela ou conteúdo, mas não se promete uma foto de comprimido solto ou xarope para cada medicamento.

A seleção é editorial e prioriza medicamentos de uso frequente; não é uma estatística dos mais vendidos nem uma classificação de eficácia. Fotos não determinam autenticidade, dose, substituição ou identificação de comprimidos soltos.

## Fontes e integridade

Os metadados foram consultados nas páginas públicas da Drogasil e no catálogo público VTEX da Pague Menos. O vínculo exige código de barras válido e correspondência de nome, registro e CNPJ do titular na CMED/Anvisa. Kits, vendedores terceiros e códigos ambíguos são excluídos. Quando a loja informa registro diferente da CMED, a galeria mantém um aviso de conflito; a foto pode mostrar uma embalagem anterior.

O processo confere JPEG/PNG/WebP, decodificação, dimensões, tamanho, SHA-256 e duplicatas visuais conservadoras. Essa conferência técnica não é revisão humana de cada ângulo. A lista e o relatório ficam em `data/photos/coverage.json`; o manifesto pronto fica em `src/data/manufacturerPhotos.json`. Candidatos não aprovados ficam separados e não são carregados pelo aplicativo.

Os direitos das fotos pertencem aos respectivos titulares. O aplicativo mostra a fonte e os créditos, sem alegar licença aberta. **As fotografias não são incluídas no APK ou redistribuídas pelo repositório.** O aparelho solicita as imagens diretamente à fonte para consulta pessoal. O primeiro acesso precisa de internet. A fonte recebe uma solicitação de conexão; favoritos, anotações, CEP e termos pesquisados não são enviados junto.

No Android/iOS, o download usa transporte nativo, limite de três solicitações simultâneas e conferência de assinatura do formato, tamanho e SHA-256 antes de exibir. Uma imagem modificada na origem fica indisponível até nova validação. O cache privado guarda imagens recentes quando há espaço, limitado a 600 arquivos e 128 MiB estimados; ele é separado dos dados pessoais. Na web/desktop, as imagens vêm diretamente da origem, sem proxy, e o cache depende do navegador. Falhas têm botão para tentar novamente e link da fonte.

## Pesquisa e comparação

- A correção de sintomas é sugerida para você confirmar, sem alterar silenciosamente o texto.
- Pesquisas combinadas precisam ter todos os sintomas nas indicações documentadas. Consultar um sintoma separadamente não recomenda combinar medicamentos.
- Refinar “dor de barriga e febre” para “gases” mantém a febre na busca.
- Termos de possível urgência não geram sugestão de medicamentos; o programa não realiza triagem completa.
- A ordem prioriza informação documentada do produto, com desempate pelo nome. Não mede qual é o remédio mais eficaz para você.
- Na comparação, campos sem informação em todos os produtos ficam reunidos em um aviso, com links para as bulas. Preço, frete e prazo ainda dependem de consulta externa; cotações manuais podem ser ordenadas por custo total ou entrega.

## iPhone e iPad

O mesmo aplicativo usa Capacitor para iOS/iPadOS 15.4 ou posterior. A IPA compilada sem assinatura exige assinatura pessoal para instalar. Sem Mac e sem pagar, o caminho documentado usa Windows + AltStore Classic/AltServer e renovação a cada sete dias. Não é download e instalação direta como um APK, não é publicação na App Store e não foi testado em iPhone físico. [Passos em português](ios-gratuito.md).

## Limites desta atualização

Esta entrega amplia a galeria e sua navegação. A cobertura de bulas e informações clínicas continua parcial. Não preenche campos ausentes com suposições, não escolhe uma dose, não ordena medicamentos por eficácia e não cria ofertas comerciais. Os testes automatizados e a inspeção do APK não substituem um teste de instalação no seu aparelho físico.
