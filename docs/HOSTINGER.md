# Migração para Hostinger — GoIndica

Destino informado: domínio `goindica.com.br`, MySQL `srv1885.hstgr.io`, banco/usuário `u834850703_goindica`, remetente `contato@goindica.com.br`. Atualizado em 14 de outubro de 2026.

## Arquitetura

- Next.js em Node 24 no Web Unlimited.
- MariaDB/MySQL InnoDB em UTF-8, datas UTC; pool limitado a cinco conexões por instância.
- Autenticação local: hashes scrypt, sessões opacas no MySQL e confirmação/recuperação via SMTP Hostinger.
- Fotos de pedidos no próprio banco, com limite de tamanho; perfis usam as iniciais do nome.
- Estabelecimentos cadastrados pela comunidade, filtrados pela cidade. Não há validação geográfica automática por um provedor de mapas; a administração corrige nome/endereço e revisa denúncias.
- Notificações, alertas, pontuação, analytics e fila de lembretes locais.
- QR codes e imagens de compartilhamento gerados pelo próprio servidor.

A Hostinger usa MariaDB nos planos Web/Cloud, compatível com os clientes MySQL: [banco usado](https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/). Os testes também podem rodar com `TEST_MYSQL_IMAGE=mariadb:10.11`.

O catálogo de municípios já está incluído nas migrations. O comando opcional de atualização do IBGE é uma ferramenta de manutenção, sem chamada externa na aplicação.

A Hostinger documenta suporte a cinco aplicações Node.js no Web Unlimited: [limites](https://www.hostinger.com/support/6976044-parameters-and-limits-of-hosting-plans-in-hostinger/) e [publicação Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/). SMTP padrão é `smtp.hostinger.com`, SSL na porta 465: [configuração de e-mail](https://www.hostinger.com/support/4305847-set-up-hostinger-email-on-your-applications-and-devices/).

## O que falta para executar no ambiente real

No arquivo local `.env.hostinger`, preencher:

- `MYSQL_PASSWORD`: senha do usuário do banco criado no hPanel.
- `SMTP_PASSWORD`: senha da caixa `contato@goindica.com.br`.

SSH não é obrigatório. `HOSTINGER_SSH_USER` é um usuário de terminal, diferente do usuário de banco; não é necessário preenchê-lo para usar o hPanel. Somente nomes de host e usuário não concedem acesso à hospedagem.

O arquivo `.env.hostinger` tem permissão 600, é ignorado pelo Git e não entra nos pacotes. Configure no hPanel apenas as variáveis da aplicação; **não copie as variáveis SSH para a aplicação publicada**.

### Limites do MySQL

- A busca usa comparação de palavras sem distinção de acentos no MySQL; não reproduz o stemming português do PostgreSQL.
- Migrations MySQL contêm DDL que auto-commita. Em caso de erro de criação, interrompa e corrija em um destino novo; não finja que uma migration parcial foi concluída.

## hPanel sem SSH

O fluxo padrão da Hostinger é **Sites → Adicionar site → Aplicação Node.js**, com upload do código-fonte ou repositório. Como a intenção é não depender de serviços externos, use upload.

Configure framework Next.js, Node 24, comando de build `npm run build` e início `npm start`. As variáveis estão em `.env.example`. O arquivo de exemplo contém placeholders; use as credenciais reais do hPanel.

`npm run hostinger:fonte` cria `goindica-hostinger-fonte.zip`, sem `.env`, Git, testes, histórico ou dados exportados. Esse é o pacote para o fluxo que instala dependências e faz o build na Hostinger.

`npm run hostinger:pacote` cria ZIP/TAR.GZ standalone depois do build. Se o hPanel permitir execução de um pacote já compilado, inicie com `node server.js`; os estáticos já estão incluídos. Não misture um servidor standalone com um novo build de código-fonte.

O banco pode ser preparado a partir deste computador: habilite Remote MySQL no hPanel para o IP de quem executará os scripts. Alternativamente, `npm run banco:sql` exporta um banco MySQL de staging para SQL, para importar pelo phpMyAdmin. Nunca coloque esse SQL em `public_html`: ele contém dados privados e hashes de senha.

## Operação

As credenciais de banco, SMTP e cron são exclusivas do servidor. Não prefixe nenhuma delas com `NEXT_PUBLIC_`. Somente o domínio e o contato de suporte são públicos.

Configure cron de lembretes na própria Hostinger como tarefa personalizada: `curl -fsS -X POST -H 'Authorization: Bearer SUA_CHAVE_CRON' https://goindica.com.br/api/cron/reminders`. Substitua a chave no hPanel; não use npm como comando de cron no ambiente compartilhado. A fila revalida consentimento e estado do pedido antes do envio. Limpe periodicamente sessões/tokens expirados e contadores temporários usando `npm run banco:limpar`.

Mantenha backups automáticos da Hostinger e teste a restauração em um banco separado. Não execute testes automatizados usando o MySQL de produção.
