# Garfy

Cardápio digital para pedidos na mesa. A interface veio do protótipo **Pastry Menu UX_UI Design** e foi adaptada para React, Vite, TypeScript e Tailwind. A API usa Node.js, Express e MySQL.

## Requisitos

- Node.js 22 ou superior
- MySQL 8 ou superior

## Preparar o banco e a API

```powershell
cd Backend
Copy-Item .env.example .env.backend
npm install
```

Edite `Backend/.env.backend` com as credenciais do MySQL, `MYSQL_DATABASE=garfy` e uma senha segura em `ADMIN_PASSWORD`. Se você já criou o banco `garfy`, o setup usará esse banco. Em seguida:

```powershell
npm run db:setup
npm run dev
```

O setup cria o banco se necessário e as tabelas `mesas`, `categorias`, `produtos`, `administradores`, `sessoes_administrativas`, `pedidos` e `itens_pedido`. Ele cadastra as mesas 1–20, quatro categorias, quatro produtos de exemplo e o primeiro administrador. Pode ser executado novamente sem duplicar esses dados. Se encontrar tabelas da versão antiga em inglês, interrompe a execução para evitar dois conjuntos de dados. A API usa a porta 3001 por padrão.

## Iniciar a aplicação

Na raiz do projeto, execute:

```powershell
npm run dev
```

Esse comando inicia o backend, espera a conexão com o MySQL e então inicia o Vite. Abra a URL mostrada pelo Vite. O proxy local encaminha `/api` para a porta configurada em `Backend/.env.backend` (3001 por padrão). A área da loja fica em `/#/admin` e usa o e-mail e a senha desse arquivo. Se preferir terminais separados, execute `npm run dev` em `Backend` antes de iniciar `npm run dev` em `Frontend`.

## Funcionamento

O cliente escolhe produtos, informa uma mesa cadastrada e pode informar um celular. Cada confirmação cria um pedido separado. O servidor consulta os preços atuais e grava os itens com seus preços no momento da compra. O link de acompanhamento aparece após o pedido; guarde-o para consultar depois. A equipe atualiza o preparo e marca o pagamento recebido no caixa pelo painel.

Fotos de exemplo usam URLs externas do protótipo. Produtos podem receber novas URLs de foto no painel.

## Verificação

```powershell
cd Backend
npm test
cd ..\Frontend
npm run build
```

A aplicação em execução está em `Frontend/src`; o arquivo original do Figma permanece na pasta de origem fora deste repositório.
