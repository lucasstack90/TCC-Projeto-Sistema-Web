-- =====================================================================
-- PAWSAFE — Criação do banco (MySQL / MariaDB do XAMPP)
-- =====================================================================
-- Como usar:
--   1. Abra o phpMyAdmin (http://localhost/phpmyadmin) com o MySQL ligado.
--   2. Importe este arquivo, OU cole o conteúdo na aba SQL e execute.
--   Ele cria o banco "pawsafe", as tabelas da base (usuários) e do módulo de
--   Animais, e cadastra usuários de cada perfil (administrador, financeiro, equipe,
--   veterinário, voluntário) para o primeiro acesso. Pode ser importado de novo sem
--   duplicar dados — e atualiza bancos criados em versões anteriores.
--
-- Decisões alinhadas a docs/pendencias-backend.md:
--   - Valores monetários (nos módulos financeiros) usarão DECIMAL, nunca FLOAT.
--   - Fotos ficam no sistema de arquivos (storage/), não em base64 no banco:
--     a coluna "foto" guarda só o caminho/nome do arquivo (ou uma URL externa).
--   - Datas de criação/alteração em todas as tabelas, para auditoria e LGPD.
-- =====================================================================

-- Garante que os acentos (ex.: 'Cão', 'Fêmea') sejam lidos como UTF-8, seja
-- importando pelo phpMyAdmin ou pelo terminal do MySQL.
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS pawsafe
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE pawsafe;

-- ---------------------------------------------------------------------
-- Usuários do sistema (equipe da ONG)
-- ---------------------------------------------------------------------
-- LGPD: guarda o mínimo (nome, e-mail) e NUNCA a senha em texto puro —
-- apenas o hash bcrypt gerado por password_hash() no PHP.
CREATE TABLE IF NOT EXISTS usuarios (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome         VARCHAR(120)  NOT NULL,
    email        VARCHAR(150)  NOT NULL,
    senha_hash   VARCHAR(255)  NOT NULL,
    -- Perfis e o que cada um pode fazer: app/Core/Permissoes.php
    perfil       ENUM('administrador', 'financeiro', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario',
    ativo        TINYINT(1)    NOT NULL DEFAULT 1,
    criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

-- Atualização de bancos criados em versões anteriores:
--   'admin' e 'funcionario' -> 'administrador' (ninguém perde acesso).
-- Em banco novo estes comandos não mudam nada; pode rodar sempre.
ALTER TABLE usuarios MODIFY perfil
    ENUM('admin', 'funcionario', 'administrador', 'financeiro', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario';
UPDATE usuarios SET perfil = 'administrador' WHERE perfil IN ('admin', 'funcionario');
ALTER TABLE usuarios MODIFY perfil
    ENUM('administrador', 'financeiro', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario';

-- ---------------------------------------------------------------------
-- Animais abrigados
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS animais (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome          VARCHAR(80)  NOT NULL,
    especie       ENUM('Cão', 'Gato', 'Outros') NOT NULL,
    raca          VARCHAR(80)  NULL,
    cor           VARCHAR(60)  NULL,
    idade         VARCHAR(40)  NULL,
    data_chegada  DATE         NULL,
    sexo          ENUM('Macho', 'Fêmea', 'Não identificado') NULL,
    porte         ENUM('Pequeno', 'Médio', 'Grande') NULL,
    status        ENUM('Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário')
                  NOT NULL DEFAULT 'Disponível',
    foto          VARCHAR(255) NULL,              -- caminho em storage/ ou URL
    peso          DECIMAL(6,2) NULL,              -- kg
    vacinado      TINYINT(1)   NOT NULL DEFAULT 0,
    castrado      TINYINT(1)   NOT NULL DEFAULT 0,
    microchip     TINYINT(1)   NOT NULL DEFAULT 0,
    observacoes   TEXT         NULL,
    -- Exclusão lógica: o animal some das listas, mas a ficha clínica, as adoções
    -- e as despesas ligadas a ele continuam guardadas (prestação de contas).
    excluido_em   DATETIME     NULL,
    excluido_por  INT UNSIGNED NULL,
    -- origem_resgate_id virá quando o módulo de Resgates existir:
    -- origem_resgate_id INT UNSIGNED NULL, FOREIGN KEY -> resgates(id)
    criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_animais_status (status),
    KEY idx_animais_especie (especie)
) ENGINE=InnoDB;

-- Registros clínicos da ficha do animal (vacinas, histórico, pesagens)
-- ---------------------------------------------------------------------
-- Auditoria em todos: quem registrou (registrado_por), quem corrigiu por último
-- (atualizado_por) e quem removeu (removido_por). Registro removido não é
-- apagado: some da ficha, mas fica guardado. As chaves estrangeiras para
-- usuarios e veterinarios são criadas mais abaixo, depois dessas tabelas.

-- Vacinas aplicadas a um animal
CREATE TABLE IF NOT EXISTS vacinas (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id      INT UNSIGNED NOT NULL,
    nome           VARCHAR(80)  NOT NULL,
    data           DATE         NULL,
    proxima        DATE         NULL,
    lote           VARCHAR(60)  NULL,
    veterinario    VARCHAR(120) NULL,                -- nome (também de quem não é cadastrado)
    veterinario_id INT UNSIGNED NULL,                -- veterinário cadastrado, quando houver
    registrado_por INT UNSIGNED NULL,
    criado_em      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INT UNSIGNED NULL,
    atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    removido_em    DATETIME     NULL,
    removido_por   INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_vacinas_animal (animal_id)
) ENGINE=InnoDB;

-- Atendimentos / histórico clínico
CREATE TABLE IF NOT EXISTS atendimentos (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id      INT UNSIGNED NOT NULL,
    tipo           VARCHAR(40)  NULL,
    data           DATE         NULL,
    descricao      VARCHAR(255) NULL,
    veterinario    VARCHAR(120) NULL,
    veterinario_id INT UNSIGNED NULL,
    observacoes    TEXT         NULL,
    registrado_por INT UNSIGNED NULL,
    criado_em      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INT UNSIGNED NULL,
    atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    removido_em    DATETIME     NULL,
    removido_por   INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_atendimentos_animal (animal_id)
) ENGINE=InnoDB;

-- Pesagens (o peso atual do animal é sempre a pesagem mais recente)
CREATE TABLE IF NOT EXISTS pesagens (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id      INT UNSIGNED NOT NULL,
    peso           DECIMAL(6,2) NOT NULL,
    data           DATE         NULL,
    nota           VARCHAR(120) NULL,
    registrado_por INT UNSIGNED NULL,
    criado_em      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_por INT UNSIGNED NULL,
    atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    removido_em    DATETIME     NULL,
    removido_por   INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_pesagens_animal (animal_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Veterinários (módulo de Animais)
-- ---------------------------------------------------------------------
-- Cadastro dos profissionais que aplicam vacinas, fazem procedimentos e
-- assinam o relatório técnico. Evita digitar o nome a cada vacina.
CREATE TABLE IF NOT EXISTS veterinarios (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome          VARCHAR(120) NOT NULL,
    crmv          VARCHAR(20)  NOT NULL,                 -- só números
    crmv_uf       CHAR(2)      NOT NULL DEFAULT 'PR',
    vinculo       VARCHAR(40)  NULL,                     -- Clínica parceira, Voluntário(a)...
    especialidade VARCHAR(80)  NULL,
    clinica       VARCHAR(120) NULL,
    telefone      VARCHAR(20)  NULL,
    email         VARCHAR(150) NULL,
    observacoes   TEXT         NULL,
    ativo         TINYINT(1)   NOT NULL DEFAULT 1,
    criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_vet_crmv (crmv, crmv_uf)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Contribuintes (módulo Financeiro): doadores frequentes e fornecedores
-- ---------------------------------------------------------------------
-- LGPD: guarda dado pessoal (CPF, endereço, contato) de pessoa física, por isso
-- registra o consentimento e a data. Pessoa jurídica usa CNPJ (dado da empresa).
-- O documento é guardado só com dígitos; a interface formata ao exibir.
CREATE TABLE IF NOT EXISTS contribuintes (
    id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    tipo           ENUM('Pessoa física', 'Pessoa jurídica') NOT NULL,
    nome           VARCHAR(120) NOT NULL,                -- nome ou razão social
    documento      VARCHAR(14)  NOT NULL,                -- CPF (11) ou CNPJ (14), só dígitos
    nome_fantasia  VARCHAR(120) NULL,
    contato        VARCHAR(120) NULL,                    -- pessoa de contato (PJ)
    telefone       VARCHAR(20)  NULL,
    email          VARCHAR(150) NULL,
    cep            VARCHAR(9)   NULL,
    logradouro     VARCHAR(150) NULL,
    numero         VARCHAR(20)  NULL,
    complemento    VARCHAR(80)  NULL,
    bairro         VARCHAR(80)  NULL,
    cidade         VARCHAR(80)  NULL,
    uf             CHAR(2)      NULL,
    doador         TINYINT(1)   NOT NULL DEFAULT 1,
    fornecedor     TINYINT(1)   NOT NULL DEFAULT 0,
    observacoes    TEXT         NULL,
    consentimento  TINYINT(1)   NULL,                    -- LGPD (pessoa física)
    consentimento_em TIMESTAMP  NULL,
    ativo          TINYINT(1)   NOT NULL DEFAULT 1,
    criado_em      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_contrib_documento (documento),
    KEY idx_contrib_papel (doador, fornecedor)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Adotantes (módulo de Adoções) — dados pessoais (LGPD)
-- ---------------------------------------------------------------------
-- Só administrador e equipe acessam (permissão adotantes.gerenciar). Excluir é
-- lógico: o cadastro some da lista, mas fica no histórico das adoções.
CREATE TABLE IF NOT EXISTS adotantes (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nome             VARCHAR(120) NOT NULL,
    cpf              CHAR(11)     NOT NULL,           -- só os dígitos
    nascimento       DATE         NULL,
    telefone         VARCHAR(20)  NULL,
    email            VARCHAR(160) NULL,
    rua              VARCHAR(120) NULL,
    numero           VARCHAR(10)  NULL,
    bairro           VARCHAR(80)  NULL,
    cidade           VARCHAR(80)  NULL,
    tipo_moradia     VARCHAR(20)  NULL,
    propriedade      VARCHAR(20)  NULL,
    tem_quintal      TINYINT(1)   NOT NULL DEFAULT 0,
    tem_telas        TINYINT(1)   NOT NULL DEFAULT 0,
    moradores        TINYINT UNSIGNED NULL,
    tem_criancas     TINYINT(1)   NOT NULL DEFAULT 0,
    outros_animais   VARCHAR(200) NULL,
    horas_sozinho    TINYINT UNSIGNED NULL,
    experiencia      VARCHAR(500) NULL,
    motivacao        VARCHAR(500) NULL,
    consentimento    TINYINT(1)   NOT NULL DEFAULT 0, -- autorização LGPD
    consentimento_em DATETIME     NULL,
    criado_em        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    criado_por       INT UNSIGNED NULL,
    atualizado_em    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    atualizado_por   INT UNSIGNED NULL,
    excluido_em      DATETIME     NULL,
    excluido_por     INT UNSIGNED NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_adotantes_cpf (cpf),
    CONSTRAINT fk_adotantes_criado     FOREIGN KEY (criado_por)     REFERENCES usuarios (id) ON DELETE SET NULL,
    CONSTRAINT fk_adotantes_atualizado FOREIGN KEY (atualizado_por) REFERENCES usuarios (id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Documentos anexados ao adotante (RG, CPF, comprovante de residência...).
-- O arquivo fica em storage/uploads/adotantes/ (fora da pasta pública) e só é
-- entregue pela API a quem tem acesso aos adotantes. Remover não apaga: guarda
-- quem removeu e quando.
CREATE TABLE IF NOT EXISTS documentos_adotante (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    adotante_id   INT UNSIGNED NOT NULL,
    nome_original VARCHAR(160) NOT NULL,
    arquivo       VARCHAR(80)  NOT NULL,              -- nome no disco (aleatório)
    tipo          VARCHAR(60)  NOT NULL,              -- tipo conferido pelo conteúdo (image/jpeg, application/pdf...)
    tamanho       INT UNSIGNED NOT NULL,
    enviado_por   INT UNSIGNED NULL,
    criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    removido_em   DATETIME     NULL,
    removido_por  INT UNSIGNED NULL,
    PRIMARY KEY (id),
    KEY idx_documentos_adotante (adotante_id),
    CONSTRAINT fk_documentos_adotante FOREIGN KEY (adotante_id) REFERENCES adotantes (id) ON DELETE RESTRICT,
    CONSTRAINT fk_documentos_enviado  FOREIGN KEY (enviado_por) REFERENCES usuarios (id)  ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Tentativas de login (proteção contra adivinhação de senha)
-- ---------------------------------------------------------------------
-- Conta as senhas erradas por IP + e-mail (Models\TentativaLogin). A chave é
-- um hash: a tabela não guarda o e-mail nem o IP em texto (LGPD). O login
-- certo apaga a linha; linhas antigas são limpas sozinhas.
CREATE TABLE IF NOT EXISTS tentativas_login (
    chave      CHAR(64)          NOT NULL,              -- sha256 de IP + e-mail
    erros      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    inicio     DATETIME          NOT NULL,              -- primeiro erro da janela atual
    PRIMARY KEY (chave),
    KEY idx_tentativas_inicio (inicio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Atualização de bancos criados em versões anteriores (ficha do animal)
-- ---------------------------------------------------------------------
-- Pode rodar sempre: em banco novo não muda nada. Usa a sintaxe IF EXISTS /
-- IF NOT EXISTS do MariaDB (o banco do XAMPP).
ALTER TABLE animais
    MODIFY sexo ENUM('Macho', 'Fêmea', 'Não identificado') NULL,
    ADD COLUMN IF NOT EXISTS excluido_em  DATETIME     NULL AFTER observacoes,
    ADD COLUMN IF NOT EXISTS excluido_por INT UNSIGNED NULL AFTER excluido_em;

ALTER TABLE vacinas
    ADD COLUMN IF NOT EXISTS veterinario_id INT UNSIGNED NULL AFTER veterinario,
    ADD COLUMN IF NOT EXISTS registrado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS atualizado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS atualizado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS removido_em    DATETIME NULL,
    ADD COLUMN IF NOT EXISTS removido_por   INT UNSIGNED NULL;
ALTER TABLE atendimentos
    ADD COLUMN IF NOT EXISTS veterinario_id INT UNSIGNED NULL AFTER veterinario,
    ADD COLUMN IF NOT EXISTS registrado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS atualizado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS atualizado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS removido_em    DATETIME NULL,
    ADD COLUMN IF NOT EXISTS removido_por   INT UNSIGNED NULL;
ALTER TABLE pesagens
    ADD COLUMN IF NOT EXISTS registrado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS criado_em      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS atualizado_por INT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS atualizado_em  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS removido_em    DATETIME NULL,
    ADD COLUMN IF NOT EXISTS removido_por   INT UNSIGNED NULL;

-- Chaves estrangeiras. A do animal deixa de ser ON DELETE CASCADE: excluir um
-- animal não apaga mais o histórico clínico (ele é só marcado como excluído).
ALTER TABLE vacinas DROP FOREIGN KEY IF EXISTS fk_vacinas_animal;
ALTER TABLE vacinas DROP FOREIGN KEY IF EXISTS fk_vacinas_veterinario;
ALTER TABLE vacinas DROP FOREIGN KEY IF EXISTS fk_vacinas_registrado;
ALTER TABLE vacinas
    ADD CONSTRAINT fk_vacinas_animal      FOREIGN KEY (animal_id)      REFERENCES animais (id)      ON DELETE RESTRICT,
    ADD CONSTRAINT fk_vacinas_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinarios (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_vacinas_registrado  FOREIGN KEY (registrado_por) REFERENCES usuarios (id)     ON DELETE SET NULL;

ALTER TABLE atendimentos DROP FOREIGN KEY IF EXISTS fk_atendimentos_animal;
ALTER TABLE atendimentos DROP FOREIGN KEY IF EXISTS fk_atendimentos_veterinario;
ALTER TABLE atendimentos DROP FOREIGN KEY IF EXISTS fk_atendimentos_registrado;
ALTER TABLE atendimentos
    ADD CONSTRAINT fk_atendimentos_animal      FOREIGN KEY (animal_id)      REFERENCES animais (id)      ON DELETE RESTRICT,
    ADD CONSTRAINT fk_atendimentos_veterinario FOREIGN KEY (veterinario_id) REFERENCES veterinarios (id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_atendimentos_registrado  FOREIGN KEY (registrado_por) REFERENCES usuarios (id)     ON DELETE SET NULL;

ALTER TABLE pesagens DROP FOREIGN KEY IF EXISTS fk_pesagens_animal;
ALTER TABLE pesagens DROP FOREIGN KEY IF EXISTS fk_pesagens_registrado;
ALTER TABLE pesagens
    ADD CONSTRAINT fk_pesagens_animal     FOREIGN KEY (animal_id)      REFERENCES animais (id)  ON DELETE RESTRICT,
    ADD CONSTRAINT fk_pesagens_registrado FOREIGN KEY (registrado_por) REFERENCES usuarios (id) ON DELETE SET NULL;

-- =====================================================================
-- Dados iniciais
-- =====================================================================
-- Este bloco pode ser importado mais de uma vez sem duplicar nada.
--
-- Usuários de cada perfil para o primeiro acesso e para a apresentação.
-- Senha de todos: pawsafe123   (TROQUE depois do primeiro login)
--   admin@pawsafe.local        Administrador(a) — coordenação: tudo, usuários, caixa, relatório
--   tesouraria@pawsafe.local   Financeiro       — caixa: doações em dinheiro, despesas, saldo, orçamento
--   equipe@pawsafe.local       Equipe           — operação do dia a dia
--   veterinario@pawsafe.local  Veterinário(a)   — fichas clínicas, resgates, estoque
--   voluntario@pawsafe.local   Voluntário(a)    — consulta animais, resgates, consumo no estoque
-- O hash abaixo foi gerado com password_hash('pawsafe123', PASSWORD_BCRYPT).
INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES
('Administrador',     'admin@pawsafe.local',       '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'administrador', 1),
('Tesouraria',        'tesouraria@pawsafe.local',  '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'financeiro',    1),
('Equipe do Abrigo',  'equipe@pawsafe.local',      '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'equipe',        1),
('Dra. Marina Lopes', 'veterinario@pawsafe.local', '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'veterinario',   1),
('Voluntário Teste',  'voluntario@pawsafe.local',  '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'voluntario',    1)
ON DUPLICATE KEY UPDATE id = id;

-- Bancos importados antes do perfil Financeiro: a conta de teste da tesouraria
-- era administrador e passa a ser financeiro (só esta conta do seed).
UPDATE usuarios SET perfil = 'financeiro'
 WHERE email = 'tesouraria@pawsafe.local' AND perfil = 'administrador';


-- Dois veterinários de exemplo (o CRMV é único: reimportar não duplica).
INSERT IGNORE INTO veterinarios (nome, crmv, crmv_uf, vinculo, especialidade, clinica, telefone, email, ativo) VALUES
('Dra. Marina Lopes',   '12345', 'PR', 'Clínica parceira', 'Clínica geral', 'Clínica VidaPet', '(42) 99999-1234', 'marina@exemplo.com', 1),
('Dr. Henrique Farias', '23456', 'PR', 'Voluntário(a)',    'Felinos',       'Atende no abrigo', '(42) 99999-5678', 'henrique@exemplo.com', 1);

-- Um contribuinte de exemplo (pessoa jurídica, CNPJ de exemplo válido).
INSERT IGNORE INTO contribuintes (tipo, nome, documento, nome_fantasia, contato, telefone, email, cidade, uf, doador, fornecedor, ativo) VALUES
('Pessoa jurídica', 'Associação de Proteção Animal (exemplo)', '11222333000181', 'APA Guarapuava', 'Setor de parcerias', '(42) 3333-4444', 'contato@exemplo.org', 'Guarapuava', 'PR', 1, 0, 1);

-- Animais de exemplo: os mesmos 8 do protótipo (js/dados.js), com os mesmos ids,
-- para que Adoções, Resgates, Estoque e Relatório continuem batendo com a ficha.
-- INSERT IGNORE: reimportar não duplica nem sobrescreve o que já foi editado.
INSERT IGNORE INTO animais (id, nome, especie, raca, cor, idade, data_chegada, sexo, porte, status, foto, peso, vacinado, castrado, microchip, observacoes) VALUES
(1, 'Thor', 'Cão', 'Labrador', 'Dourado', '3 anos', '2026-03-14', 'Macho', 'Grande', 'Disponível', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80', 26.4, 1, 1, 0, 'Sociável e ativo. Gosta de passeios.'),
(2, 'Mia', 'Gato', 'Siamês', 'Creme e marrom', '2 anos', '2026-02-09', 'Fêmea', 'Pequeno', 'Disponível', 'https://images.unsplash.com/photo-1573865526739-10659f8f3bcf?auto=format&fit=crop&w=900&q=80', 4.2, 1, 1, 0, 'Tranquila e aparentemente saudável.'),
(3, 'Bolinha', 'Cão', 'Vira-lata', 'Branco e marrom', '1 ano', '2026-04-02', 'Macho', 'Médio', 'Em Tratamento', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=80', 12.1, 0, 0, 0, 'Em acompanhamento veterinário.'),
(4, 'Nina', 'Gato', 'Persa', 'Caramelo', '4 anos', '2026-01-20', 'Fêmea', 'Médio', 'Em Lar Temporário', 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=900&q=80', 3.9, 1, 1, 1, 'Em lar temporário.'),
(5, 'Rex', 'Cão', 'Pastor Alemão', 'Preto e caramelo', '5 anos', '2025-12-11', 'Macho', 'Grande', 'Adotado', 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=900&q=80', 31.5, 1, 1, 1, 'Adoção concluída.'),
(6, 'Pérola', 'Outros', 'Coelho angorá', 'Branco', '8 meses', '2026-05-02', 'Fêmea', 'Pequeno', 'Disponível', 'https://images.unsplash.com/photo-1591382386627-349b692688ff?auto=format&fit=crop&w=900&q=80', 1.8, 1, 0, 0, 'Coelha dócil.'),
(7, 'Mel', 'Cão', 'Golden Retriever', 'Dourado', '2 anos', '2026-04-12', 'Fêmea', 'Grande', 'Resgatado', 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80', 24.7, 0, 0, 0, 'Resgate recente. Aguardando avaliação veterinária.'),
(8, 'Simba', 'Gato', 'Maine Coon', 'Laranja', '3 anos', '2026-02-18', 'Macho', 'Grande', 'Disponível', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80', 6.2, 1, 1, 1, 'Sociável com pessoas.');

-- Registros clínicos de exemplo (só para o animal que ainda não tem nenhum).
INSERT INTO vacinas (animal_id, nome, data, proxima, lote, veterinario, veterinario_id)
SELECT * FROM (
    SELECT 1 AS animal_id, 'V8' AS nome, '2026-03-15' AS data, '2027-03-15' AS proxima, 'V8-2048' AS lote, 'Dra. Marina Lopes' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dra. Marina Lopes' LIMIT 1) AS veterinario_id
) AS v WHERE NOT EXISTS (SELECT 1 FROM vacinas WHERE animal_id = 1);
INSERT INTO atendimentos (animal_id, tipo, data, descricao, veterinario, veterinario_id, observacoes)
SELECT * FROM (
    SELECT 1 AS animal_id, 'Consulta' AS tipo, '2026-03-14' AS data, 'Avaliação geral de chegada' AS descricao, 'Dra. Marina Lopes' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dra. Marina Lopes' LIMIT 1) AS veterinario_id, 'Saúde geral boa.' AS observacoes
) AS h WHERE NOT EXISTS (SELECT 1 FROM atendimentos WHERE animal_id = 1);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 1 AS animal_id, 26.4 AS peso, '2026-03-14' AS data, 'Avaliação inicial' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 1);
INSERT INTO vacinas (animal_id, nome, data, proxima, lote, veterinario, veterinario_id)
SELECT * FROM (
    SELECT 2 AS animal_id, 'Tríplice Felina' AS nome, '2026-02-10' AS data, '2027-02-10' AS proxima, 'TF-2026-220' AS lote, 'Dr. Henrique Farias' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1) AS veterinario_id
    UNION ALL
    SELECT 2, 'Antirrábica', '2026-02-10', '2027-02-10', 'AR-2026-046', 'Dr. Henrique Farias', (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1)
) AS v WHERE NOT EXISTS (SELECT 1 FROM vacinas WHERE animal_id = 2);
INSERT INTO atendimentos (animal_id, tipo, data, descricao, veterinario, veterinario_id, observacoes)
SELECT * FROM (
    SELECT 2 AS animal_id, 'Consulta' AS tipo, '2026-03-10' AS data, 'Retorno — avaliação nutricional' AS descricao, 'Dr. Henrique Farias' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1) AS veterinario_id, 'Ganhou 400 g. Ótima evolução.' AS observacoes
    UNION ALL
    SELECT 2, 'Consulta', '2026-02-09', 'Avaliação geral de chegada', 'Dr. Henrique Farias', (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1), 'Dieta de recuperação prescrita.'
) AS h WHERE NOT EXISTS (SELECT 1 FROM atendimentos WHERE animal_id = 2);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 2 AS animal_id, 4.2 AS peso, '2026-03-10' AS data, 'Retorno' AS nota
    UNION ALL
    SELECT 2, 3.8, '2026-02-09', 'Chegada'
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 2);
INSERT INTO atendimentos (animal_id, tipo, data, descricao, veterinario, veterinario_id, observacoes)
SELECT * FROM (
    SELECT 3 AS animal_id, 'Tratamento' AS tipo, '2026-04-02' AS data, 'Início de tratamento dermatológico' AS descricao, 'Dra. Marina Lopes' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dra. Marina Lopes' LIMIT 1) AS veterinario_id, 'Retorno agendado.' AS observacoes
) AS h WHERE NOT EXISTS (SELECT 1 FROM atendimentos WHERE animal_id = 3);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 3 AS animal_id, 12.1 AS peso, '2026-04-02' AS data, 'Pesagem de chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 3);
INSERT INTO vacinas (animal_id, nome, data, proxima, lote, veterinario, veterinario_id)
SELECT * FROM (
    SELECT 4 AS animal_id, 'Antirrábica' AS nome, '2026-01-20' AS data, '2027-01-20' AS proxima, 'AR-9012' AS lote, 'Dr. Henrique Farias' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1) AS veterinario_id
) AS v WHERE NOT EXISTS (SELECT 1 FROM vacinas WHERE animal_id = 4);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 4 AS animal_id, 3.9 AS peso, '2026-01-20' AS data, 'Chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 4);
INSERT INTO atendimentos (animal_id, tipo, data, descricao, veterinario, veterinario_id, observacoes)
SELECT * FROM (
    SELECT 5 AS animal_id, 'Adoção' AS tipo, '2025-12-20' AS data, 'Adoção concluída' AS descricao, 'Equipe PAWSAFE' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Equipe PAWSAFE' LIMIT 1) AS veterinario_id, 'Termo arquivado.' AS observacoes
) AS h WHERE NOT EXISTS (SELECT 1 FROM atendimentos WHERE animal_id = 5);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 5 AS animal_id, 31.5 AS peso, '2025-12-11' AS data, 'Chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 5);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 6 AS animal_id, 1.8 AS peso, '2026-05-02' AS data, 'Chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 6);
INSERT INTO atendimentos (animal_id, tipo, data, descricao, veterinario, veterinario_id, observacoes)
SELECT * FROM (
    SELECT 7 AS animal_id, 'Resgate' AS tipo, '2026-04-12' AS data, 'Resgate em área urbana' AS descricao, 'Equipe PAWSAFE' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Equipe PAWSAFE' LIMIT 1) AS veterinario_id, 'Encaminhada para avaliação.' AS observacoes
) AS h WHERE NOT EXISTS (SELECT 1 FROM atendimentos WHERE animal_id = 7);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 7 AS animal_id, 24.7 AS peso, '2026-04-12' AS data, 'Chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 7);
INSERT INTO vacinas (animal_id, nome, data, proxima, lote, veterinario, veterinario_id)
SELECT * FROM (
    SELECT 8 AS animal_id, 'Tríplice Felina' AS nome, '2026-02-18' AS data, '2027-02-18' AS proxima, 'TF-2210' AS lote, 'Dr. Henrique Farias' AS veterinario, (SELECT id FROM veterinarios WHERE nome = 'Dr. Henrique Farias' LIMIT 1) AS veterinario_id
) AS v WHERE NOT EXISTS (SELECT 1 FROM vacinas WHERE animal_id = 8);
INSERT INTO pesagens (animal_id, peso, data, nota)
SELECT * FROM (
    SELECT 8 AS animal_id, 6.2 AS peso, '2026-02-18' AS data, 'Chegada' AS nota
) AS w WHERE NOT EXISTS (SELECT 1 FROM pesagens WHERE animal_id = 8);

-- Adotantes de exemplo: os mesmos 3 do protótipo (js/dados.js), com os mesmos ids,
-- porque os processos de adoção (ainda no navegador) apontam para eles.
INSERT IGNORE INTO adotantes (id, nome, cpf, nascimento, telefone, email, rua, numero, bairro, cidade, tipo_moradia, propriedade, tem_quintal, tem_telas, moradores, tem_criancas, outros_animais, horas_sozinho, experiencia, motivacao, consentimento, consentimento_em, criado_em) VALUES
(1, 'Carlos Mendes', '52998224725', '1988-05-14', '(42) 99912-3456', 'carlos.mendes@email.com', 'Rua XV de Novembro', '1240', 'Centro', 'Guarapuava - PR', 'Casa', 'Própria', 1, 0, 3, 1, 'Uma gata castrada', 4, 'Já teve cães de grande porte.', 'Família procura um cão companheiro para as crianças.', 1, '2025-12-10 10:00:00', '2025-12-10 10:00:00'),
(2, 'Fernanda Lima', '31298765455', '1995-09-02', '(42) 99845-1122', 'fernanda.lima@email.com', 'Rua Saldanha Marinho', '310', 'Trianon', 'Guarapuava - PR', 'Casa', 'Alugada', 1, 0, 2, 0, NULL, 6, 'Primeiro animal.', 'Quer um cão ativo para acompanhar nas caminhadas.', 1, '2026-10-01 10:00:00', '2026-10-01 10:00:00'),
(3, 'Juliana Alves', '47123659864', '1990-01-23', '(42) 99734-8890', 'juliana.alves@email.com', 'Rua Pedro Alves', '85', 'Bairro Santa Cruz', 'Guarapuava - PR', 'Apartamento', 'Própria', 0, 1, 1, 0, NULL, 8, 'Já teve gatos.', 'Mora sozinha e quer um gato tranquilo.', 1, '2026-10-14 10:00:00', '2026-10-14 10:00:00');
