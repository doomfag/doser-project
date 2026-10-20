# Curadoria clínica inicial — Doser 0.4

A base cadastral da Anvisa e as referências clínicas são coleções separadas. O registro identifica o produto; o PCDT descreve tratamento em um contexto. A correspondência exata do princípio ativo **não confirma apresentação, formulação, via ou indicação de um registro específico**. Não há associação por semelhança de sintomas nem extrapolação entre sais ou combinações.

`data/clinical/curated.json` contém 19 referências extraídas de dois documentos oficiais do Ministério da Saúde, com trechos de evidência das páginas consultadas. Não são dados de demonstração nem texto gerado como substituto de evidência.

| Documento                                                                                                                | Trechos utilizados                                                                                                   | Versão SHA-256                                                     |
| ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [PCDT Hipertensão Arterial Sistêmica](https://www.gov.br/saude/pt-br/assuntos/pcdt/h/hipertensao-arterial-sistemica.pdf) | PDF pp. 51–55: apresentações, Quadro 18 de adultos por via oral e contraindicações. Não inclui esquemas pediátricos. | `1f39016a1f1df510b5221d1809a6ff40674d9bad6797bb68b7fc14094c85b608` |
| [PCDT Diabete Melito Tipo 2](https://www.gov.br/saude/pt-br/assuntos/pcdt/d/diabete-melito-tipo-2.pdf)                   | PDF pp. 12, 23–24, 37, 39–40: população, metformina, sulfonilureias, apresentações, esquemas e contraindicações.     | `f90b782997a5f90842877c6526432cd382b596ad6cb7ad95da0a2fd776dfae09` |

Os PDFs foram baixados via HTTPS e o texto foi conferido com `pdftotext -layout`. As datas de portaria aparecem no título. Não foram usadas como data de publicação do PDF sem confirmação. A data de verificação é registrada separadamente.

## Regras de apresentação

- Dezesseis referências de HAS e três de DM2, vinculadas inicialmente a 368 dos 10.326 registros ativos únicos. A curadoria não fornece bulas completas para esses produtos.
- O usuário escolhe explicitamente apresentação/população antes de ler o esquema. O texto identifica dose diária, por tomada ou esquema narrativo; dose diária não é convertida automaticamente em quantidade por tomada.
- A faixa de adultos corresponde ao contexto do protocolo, não à idade mínima regulatória do medicamento. Glibenclamida preserva a ressalva documental de idade a partir de 60 anos.
- Metoprolol preserva a ressalva de formulações distintas; gliclazida refere-se apenas à formulação MR. A metformina mantém a titulação e os limites renais do texto, sem sugerir uma dose padrão.
- O Quadro 18 informa 200 mg/dia como máximo de hidroclorotiazida e 25–50 mg/dia como faixa habitual. O aplicativo preserva a fonte e explicita essa diferença, sem converter o máximo em recomendação.
- O próprio PCDT de DM2 contém divergências: a seção 8.9 e a 8.3.2 divergem sobre gliclazida MR com TFG abaixo de 30; há orientações conflitantes sobre duração de ação em idosos. O aplicativo sinaliza esses pontos, preserva os trechos e não propõe uma resolução clínica.
- As listas são trechos, não revisão exaustiva de segurança. Outros campos ausentes permanecem ausentes; não há verificador de interações entre tratamentos nesta versão.

## Atualizar documentos

A atualização cadastral também verifica os dois PDFs, mesmo quando o CSV responde ETag 304. `server/clinical.ts` aceita somente fontes fixas do manifesto, HTTPS, sem redirecionamentos, com assinatura de PDF e limite de 15 MiB por documento. Cada campo precisa apontar ao mesmo documento e versão, com página específica.

Se o SHA-256 mudar, suas referências são retiradas da consulta até revisão do novo texto. Isso evita preservar doses de uma versão antiga como se fossem atuais. Se houver apenas falha de rede, uma versão anteriormente verificada pode permanecer em cache com sua data original e aviso; sem verificação anterior, nenhum esquema é anexado.

Para adicionar uma referência: consultar a fonte completa e seus critérios; registrar versão e páginas; transcrever os dados com condições e conflitos; adicionar apenas correspondências de princípio ativo comprovadas; executar testes e conferir a interface. Atualização semanal não significa extração clínica automática e irrestrita de novos documentos.

## Calculadora

`src/domain/doseConversion.ts` realiza aritmética racional exata com BigInt. Recebe dose **já prescrita por tomada**, concentração e forma. Iguala g/mg/mcg antes de dividir. Não recebe idade, peso ou sintomas e não escolhe uma dose clínica.

Comprimidos, cápsulas e gotas exigem unidades inteiras. Líquidos exigem graduação do dosador compatível. Gotas exigem fator próprio do gotejador/bula, sem presumir 20 gotas/mL. Não arredonda, não presume fracionamento ou intercambialidade e não valida limites diários. O formulário é zerado ao fechar/reabrir ou trocar de forma, e não grava dados pessoais. O resultado some ao editar qualquer entrada.

A interface oferece “Quando usar e por quê” e “Como fazer o cálculo”, com exemplos explicitamente matemáticos. Não importa automaticamente uma faixa de PCDT para a dose prescrita. Não converte UI, mEq, porcentagem, dose por peso ou frequência.
