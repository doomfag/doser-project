# Doser no iPhone, sem computador

O caminho mais simples é a **versão web instalável**. Ela abre pelo ícone, em uma janela própria, sem AltStore, conta Apple de desenvolvedor ou renovação semanal. Não é a IPA nem um aplicativo distribuído pela App Store.

Endereço da distribuição: **https://doomfag.github.io/doser-project/**. O endereço só funciona depois de o GitHub Pages estar ativado para o branch `gh-pages`.

## Instalar pelo próprio iPhone

1. Abra o endereço no **Safari**. Se recebeu pelo WhatsApp, use a opção de abrir no Safari.
2. Toque em **Compartilhar**.
3. Toque em **Adicionar à Tela de Início** e depois em **Adicionar**. Se aparecer “Abrir como App”, deixe ativado.
4. Abra pelo novo ícone **Doser**.

A primeira abertura precisa de internet. Espere a mensagem **“Consulta preparada para abrir sem internet”** antes de fechar. O catálogo e a pesquisa poderão abrir offline; fotos e links externos continuam dependendo de conexão. A instalação física em iPhone ainda precisa ser validada; o build usa alvo Safari 15.4 e JSON verificado sem depender de descompressão gzip.

Favoritos e anotações ficam no aparelho, sem sincronização com o APK. Quando houver uma versão nova, a tela inicial oferece **Atualizar Doser**; salve os rascunhos antes de atualizar. A atualização do aplicativo não é uma atualização clínica automática das bulas.

## Ativação do endereço — uma vez pelo dono do repositório

Os arquivos públicos ficam no branch separado `gh-pages`, sem alterar `main`. Se o GitHub recusar ativação pela credencial da automação, o proprietário precisa abrir [Settings → Pages](https://github.com/doomfag/doser-project/settings/pages), escolher **Deploy from a branch**, selecionar **gh-pages** e **/(root)** e salvar. Isso usa GitHub Pages gratuito do repositório público; não cria assinatura paga. Depois da publicação, qualquer pessoa poderá abrir o endereço e instalar pelo Safari. Nenhuma anotação pessoal é incluída nessa publicação.
