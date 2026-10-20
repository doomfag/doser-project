# iPhone e iPad sem Mac, sem assinatura paga

O Doser gera uma IPA sem assinatura. Para instalá-la gratuitamente sem Mac, uma opção é o **AltStore Classic com AltServer em Windows**. Isso exige acesso a um computador Windows; Linux sozinho não foi validado como alternativa. O programa aparece como aplicativo no iPhone/iPad, sem abrir o navegador para usar o Doser.

## Limites antes de instalar

- A assinatura gratuita expira em **sete dias**. O AltServer precisa estar disponível para renovar os aplicativos, normalmente pela mesma rede Wi-Fi. Sem renovação, o aplicativo deixa de abrir até ser reassinado.
- A documentação do AltStore informa limite de três aplicativos instalados dessa forma ao mesmo tempo, incluindo o próprio AltStore.
- Este caminho cobre iPhone/iPad compatíveis, **não Apple TV**. O Doser requer iOS/iPadOS 15.4 ou posterior.
- O pacote foi compilado e iniciado em simulador; instalação, renovação e funcionamento em iPhone físico ainda precisam ser testados. Não há garantia de instalação permanente gratuita.

## Instalação

1. Consulte o [guia oficial do AltStore para Windows](https://faq.altstore.io/altstore-classic/how-to-install-altstore-windows). Use os downloads indicados pelo projeto oficial. O guia exige iTunes e iCloud nas versões indicadas ali, além do AltServer.
2. Conecte o iPhone/iPad ao Windows por USB, autorize o computador no aparelho e siga o guia para instalar o AltStore Classic. A sincronização Wi-Fi permite a renovação posterior. O guia também explica a ativação do Modo de Desenvolvedor quando exigida pelo iOS.
3. A autenticação com sua conta Apple é feita no próprio fluxo do AltServer/Apple. **Não envie senha, códigos ou certificados pelo chat.** Leia as condições e permissões da ferramenta antes de usá-la; ela é um projeto independente do Doser.
4. Baixe `Doser-iOS-SEM-ASSINATURA.ipa` na página de downloads do Doser, transfira-o para Arquivos no iPhone/iPad e use o botão **+** em **My Apps** do AltStore Classic para selecionar a IPA. O AltStore fará a assinatura pessoal. Não use o ZIP de simulador.
5. Abra o Doser pelo ícone do sistema. Confira em **My Apps** a validade da assinatura e renove antes do vencimento com o AltServer acessível. Evite desinstalar o Doser para tentar atualizar: isso pode apagar dados locais.

Não é necessário comprar Apple Developer Program para esse fluxo de assinatura pessoal descrito pelo AltStore. Não foi criado cadastro ou contratado serviço em seu nome. Recursos de distribuição da Apple têm regras diferentes; não confunda AltStore Classic com outras modalidades ou lojas.

## Fontes consultadas

Documentação oficial do projeto AltStore, consultada em 20/10/2026 pelo repositório público `altstoreio/FAQ`:

- [Windows](https://github.com/altstoreio/FAQ/blob/main/altstore-world/how-to-install-altstore-windows.md)
- [Validade e renovação](https://github.com/altstoreio/FAQ/blob/main/altstore-world/your-altstore.md)
- [Distribuição de IPA e assinatura pessoal](https://github.com/altstoreio/FAQ/blob/main/developers/distribute-with-altstore-classic.md)

As instruções da ferramenta podem mudar. O Doser não inclui o instalador do AltServer nem solicita credenciais Apple.
