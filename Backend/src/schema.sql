CREATE TABLE IF NOT EXISTS mesas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero INT NOT NULL UNIQUE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS categorias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(80) NOT NULL UNIQUE,
  ativa BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS produtos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  categoria_id INT NOT NULL,
  nome VARCHAR(120) NOT NULL,
  descricao TEXT NOT NULL,
  preco_centavos INT NOT NULL,
  url_imagem VARCHAR(1000) NOT NULL DEFAULT '',
  destaque VARCHAR(80) NOT NULL DEFAULT '',
  disponivel BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_produto_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);
CREATE TABLE IF NOT EXISTS administradores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  hash_senha VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS sessoes_administrativas (
  hash_token CHAR(64) PRIMARY KEY,
  administrador_id INT NOT NULL,
  expira_em DATETIME NOT NULL,
  CONSTRAINT fk_sessao_administrador FOREIGN KEY (administrador_id) REFERENCES administradores(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pedidos (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  token_acompanhamento CHAR(64) NOT NULL UNIQUE,
  mesa_id INT NOT NULL,
  celular VARCHAR(24) NULL,
  situacao ENUM('recebido','em_preparo','pronto','servido','cancelado') NOT NULL DEFAULT 'recebido',
  pago BOOLEAN NOT NULL DEFAULT FALSE,
  total_centavos INT NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_mesa FOREIGN KEY (mesa_id) REFERENCES mesas(id)
);
CREATE TABLE IF NOT EXISTS itens_pedido (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pedido_id BIGINT NOT NULL,
  produto_id INT NULL,
  nome_produto VARCHAR(120) NOT NULL,
  url_imagem VARCHAR(1000) NOT NULL DEFAULT '',
  tamanho ENUM('tradicional','grande') NOT NULL,
  quantidade INT NOT NULL,
  preco_unitario_centavos INT NOT NULL,
  CONSTRAINT fk_item_pedido FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  CONSTRAINT fk_item_produto FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE SET NULL
);
