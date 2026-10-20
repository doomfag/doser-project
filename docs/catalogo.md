# Formato do catálogo — versão 1

Na tela **Dados e ajustes**, escolha **Importar catálogo**. Arquivos são processados no dispositivo e não enviados a servidores. Esta importação manual recebe dados documentados e não extrai PDFs. A atualização cadastral da Anvisa é uma função separada do programa local.

A raiz contém `version: 1` e `medicines`, uma lista com até 100.000 registros. Tamanho máximo de arquivo: 50 MiB. Importações atualizam pelo ID, preservando outros registros. Exporte antes de atualizar informações importantes.

Campos obrigatórios de cada medicamento:

| Campo           | Conteúdo                                                                   |
| --------------- | -------------------------------------------------------------------------- |
| `id`            | Identificador estável, único, até 100 caracteres alfanuméricos, `_` ou `-` |
| `name`          | Nome documentado, até 200 caracteres                                       |
| `ingredient`    | Princípio ativo documentado, até 1.000 caracteres                          |
| `drugClass`     | Classe documentada, até 300 caracteres                                     |
| `presentations` | Lista de apresentações exatas, pode estar vazia                            |
| `aliases`       | Lista de nomes alternativos documentados, pode estar vazia                 |
| `facts`         | Objeto contendo apenas os campos documentados                              |

Campos aceitos em `facts`: `indications`, `dosage`, `contraindications`, `precautions`, `adverse`, `interactions`, `dynamics`, `kinetics`, `metabolism`, `halfLife`, `routes`, `pregnancy`.

Cada fato exige `text` (até 10.000 caracteres) e `source` contendo:

- `title`: título do documento, até 300 caracteres.
- `url`: URL HTTPS da fonte original, até 2.048 caracteres, sem credenciais.
- `publishedAt`: data de publicação `AAAA-MM-DD`, opcional. Não invente uma data ausente.
- `checkedAt`: data real da conferência `AAAA-MM-DD`, obrigatória.
- `version`: identificador da versão documental, até 100 caracteres.
- `status`: `pending` ou `validated`. A declaração não é certificada pelo Doser. Use `pending` enquanto não houver conferência documental.

Links opcionais do medicamento: `professionalLeaflet` e `patientLeaflet`, ambos HTTPS. Não confunda uma URL geral de busca com a URL de uma bula específica. Não inclua fatos que não consiga rastrear. Nunca substitua ausência por texto produzido automaticamente.

Arquivo vazio válido, sem dados de demonstração:

```json
{ "version": 1, "medicines": [] }
```

Os registros dos testes são sintéticos e não contêm orientação clínica. Não importe fixtures de teste na biblioteca de uso pessoal.

## Regimes por apresentação (`usage`)

O medicamento aceita `usage`, lista opcional de até 100 regimes. Cada regime exige `id` único dentro do medicamento, `presentation` (apresentação exata, até 500 caracteres), `population` (população documentada, até 1.000 caracteres), `dose` (texto documental, até 10.000 caracteres) e `source` com o mesmo formato obrigatório das fontes de fatos.

Campos opcionais do regime: `interval`, `route`, `age`, `duration`, `maxDaily`, `conditions`. Cada um aceita texto de até 10.000 caracteres. Ausência é mostrada explicitamente; não use zero ou dose padrão para preencher lacunas. Preserve condições e ressalvas da fonte. Nunca converta uma dose para gotas sem a concentração, equivalência e apresentação documentadas. A validação de formato não comprova segurança clínica.

A ficha exige selecionar apresentação/população antes de exibir o regime. `dosage` em `facts` pode preservar a seção textual completa da documentação; isso não cria automaticamente regimes estruturados.

## Base automática e registros manuais

O serviço local mantém a base cadastral em `.doser/catalog.json`. O navegador mantém cópia em IndexedDB. JSON importado manualmente permanece em uma coleção separada; uma atualização cadastral não apaga seus registros. Se o ID coincide, a versão manual prevalece na visualização. Metadados opcionais `registration` contêm `number`, `situation`, `holder` opcional e `source`. Cadastro regulatório não confirma posologia nem equivalência.

## Referências por princípio ativo

A raiz aceita `clinicalReferences` com até 2.000 referências: `id`, `documentId`, `subject`, `ingredients` (correspondências exatas), `scope`, `presentations`, `facts`, `usage` e `source`. `issues` é uma lista opcional de até 20 ressalvas/conflitos documentais. Fontes aceitam `kind` (`leaflet`, `guideline`, `registry`, `scientific`) e `locator` para página/seção.

Um registro pode conter `clinicalReferenceIds`. Os vínculos devem existir e ter princípio ativo exatamente correspondente após normalização; combinações não herdam referências de monoterapias. São exibidas como referências por princípio ativo, nunca como bula ou apresentação confirmada do produto.

O campo `doseBasis` em `usage` aceita `per-dose`, `per-day` ou `document-text`. Use explicitamente `per-day` para faixas diárias, preservando a frequência e as condições. O texto não é enviado automaticamente à calculadora. Validação de formato e declarações importadas não certificam revisão clínica.
