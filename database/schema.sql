-- =====================================================================
-- PAWSAFE — Criação do banco (MySQL / MariaDB do XAMPP)
-- =====================================================================
-- Como usar:
--   1. Abra o phpMyAdmin (http://localhost/phpmyadmin) com o MySQL ligado.
--   2. Importe este arquivo, OU cole o conteúdo na aba SQL e execute.
--   Ele cria o banco "pawsafe", as tabelas da base (usuários) e do módulo de
--   Animais, e cadastra usuários de cada perfil (administrador, equipe,
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
    perfil       ENUM('administrador', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario',
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
    ENUM('admin', 'funcionario', 'administrador', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario';
UPDATE usuarios SET perfil = 'administrador' WHERE perfil IN ('admin', 'funcionario');
ALTER TABLE usuarios MODIFY perfil
    ENUM('administrador', 'equipe', 'veterinario', 'voluntario') NOT NULL DEFAULT 'voluntario';

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
    sexo          ENUM('Macho', 'Fêmea') NULL,
    porte         ENUM('Pequeno', 'Médio', 'Grande') NULL,
    status        ENUM('Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário')
                  NOT NULL DEFAULT 'Disponível',
    foto          VARCHAR(255) NULL,              -- caminho em storage/ ou URL
    peso          DECIMAL(6,2) NULL,              -- kg
    vacinado      TINYINT(1)   NOT NULL DEFAULT 0,
    castrado      TINYINT(1)   NOT NULL DEFAULT 0,
    microchip     TINYINT(1)   NOT NULL DEFAULT 0,
    observacoes   TEXT         NULL,
    -- origem_resgate_id virá quando o módulo de Resgates existir:
    -- origem_resgate_id INT UNSIGNED NULL, FOREIGN KEY -> resgates(id)
    criado_em     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_animais_status (status),
    KEY idx_animais_especie (especie)
) ENGINE=InnoDB;

-- Vacinas aplicadas a um animal
CREATE TABLE IF NOT EXISTS vacinas (
    id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id  INT UNSIGNED NOT NULL,
    nome       VARCHAR(80)  NOT NULL,
    data       DATE         NULL,
    proxima    DATE         NULL,
    lote       VARCHAR(60)  NULL,
    veterinario VARCHAR(120) NULL,
    PRIMARY KEY (id),
    KEY idx_vacinas_animal (animal_id),
    CONSTRAINT fk_vacinas_animal FOREIGN KEY (animal_id)
        REFERENCES animais (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Atendimentos / histórico clínico
CREATE TABLE IF NOT EXISTS atendimentos (
    id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id   INT UNSIGNED NOT NULL,
    tipo        VARCHAR(40)  NULL,
    data        DATE         NULL,
    descricao   VARCHAR(255) NULL,
    veterinario VARCHAR(120) NULL,
    observacoes TEXT         NULL,
    PRIMARY KEY (id),
    KEY idx_atendimentos_animal (animal_id),
    CONSTRAINT fk_atendimentos_animal FOREIGN KEY (animal_id)
        REFERENCES animais (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pesagens
CREATE TABLE IF NOT EXISTS pesagens (
    id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
    animal_id INT UNSIGNED NOT NULL,
    peso      DECIMAL(6,2) NOT NULL,
    data      DATE         NULL,
    nota      VARCHAR(120) NULL,
    PRIMARY KEY (id),
    KEY idx_pesagens_animal (animal_id),
    CONSTRAINT fk_pesagens_animal FOREIGN KEY (animal_id)
        REFERENCES animais (id) ON DELETE CASCADE
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

-- =====================================================================
-- Dados iniciais
-- =====================================================================
-- Este bloco pode ser importado mais de uma vez sem duplicar nada.
--
-- Usuários de cada perfil para o primeiro acesso e para a apresentação.
-- Senha de todos: pawsafe123   (TROQUE depois do primeiro login)
--   admin@pawsafe.local        Administrador(a) — coordenação: tudo, usuários, caixa, relatório
--   tesouraria@pawsafe.local   Administrador(a) — segundo administrador (ex.: tesoureiro)
--   equipe@pawsafe.local       Equipe           — operação do dia a dia
--   veterinario@pawsafe.local  Veterinário(a)   — fichas clínicas, resgates, estoque
--   voluntario@pawsafe.local   Voluntário(a)    — consulta animais, resgates, consumo no estoque
-- O hash abaixo foi gerado com password_hash('pawsafe123', PASSWORD_BCRYPT).
INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES
('Administrador',     'admin@pawsafe.local',       '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'administrador', 1),
('Tesouraria',        'tesouraria@pawsafe.local',  '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'administrador', 1),
('Equipe do Abrigo',  'equipe@pawsafe.local',      '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'equipe',        1),
('Dra. Marina Lopes', 'veterinario@pawsafe.local', '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'veterinario',   1),
('Voluntário Teste',  'voluntario@pawsafe.local',  '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.', 'voluntario',    1)
ON DUPLICATE KEY UPDATE id = id;

-- Dois animais de exemplo (equivalentes ao seed do protótipo) — só se a tabela estiver vazia.
INSERT INTO animais (nome, especie, raca, cor, idade, data_chegada, sexo, porte, status, peso, vacinado, castrado, microchip, observacoes)
SELECT * FROM (
    SELECT 'Thor' AS nome, 'Cão' AS especie, 'Labrador' AS raca, 'Dourado' AS cor, '3 anos' AS idade, DATE('2026-03-14') AS data_chegada, 'Macho' AS sexo, 'Grande' AS porte, 'Disponível' AS status, 26.40 AS peso, 1 AS vacinado, 1 AS castrado, 0 AS microchip, 'Sociável e ativo. Gosta de passeios.' AS observacoes
    UNION ALL
    SELECT 'Mia', 'Gato', 'Siamês', 'Creme e marrom', '2 anos', DATE('2026-02-09'), 'Fêmea', 'Pequeno', 'Disponível', 4.20, 1, 1, 0, 'Tranquila e aparentemente saudável.'
) AS exemplos
WHERE NOT EXISTS (SELECT 1 FROM animais);

-- Dois veterinários de exemplo (o CRMV é único: reimportar não duplica).
INSERT IGNORE INTO veterinarios (nome, crmv, crmv_uf, vinculo, especialidade, clinica, telefone, email, ativo) VALUES
('Dra. Marina Lopes',   '12345', 'PR', 'Clínica parceira', 'Clínica geral', 'Clínica VidaPet', '(42) 99999-1234', 'marina@exemplo.com', 1),
('Dr. Henrique Farias', '23456', 'PR', 'Voluntário(a)',    'Felinos',       'Atende no abrigo', '(42) 99999-5678', 'henrique@exemplo.com', 1);

-- Um contribuinte de exemplo (pessoa jurídica, CNPJ de exemplo válido).
INSERT IGNORE INTO contribuintes (tipo, nome, documento, nome_fantasia, contato, telefone, email, cidade, uf, doador, fornecedor, ativo) VALUES
('Pessoa jurídica', 'Associação de Proteção Animal (exemplo)', '11222333000181', 'APA Guarapuava', 'Setor de parcerias', '(42) 3333-4444', 'contato@exemplo.org', 'Guarapuava', 'PR', 1, 0, 1);
