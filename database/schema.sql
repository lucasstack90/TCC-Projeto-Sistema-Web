-- =====================================================================
-- PAWSAFE — Criação do banco (MySQL / MariaDB do XAMPP)
-- =====================================================================
-- Como usar:
--   1. Abra o phpMyAdmin (http://localhost/phpmyadmin) com o MySQL ligado.
--   2. Importe este arquivo, OU cole o conteúdo na aba SQL e execute.
--   Ele cria o banco "pawsafe", as tabelas da base (usuários) e do módulo de
--   Animais, e cadastra um usuário administrador para o primeiro acesso.
--
-- Decisões alinhadas a docs/pendencias-backend.md:
--   - Valores monetários (nos módulos financeiros) usarão DECIMAL, nunca FLOAT.
--   - Fotos ficam no sistema de arquivos (storage/), não em base64 no banco:
--     a coluna "foto" guarda só o caminho/nome do arquivo (ou uma URL externa).
--   - Datas de criação/alteração em todas as tabelas, para auditoria e LGPD.
-- =====================================================================

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
    perfil       ENUM('admin', 'equipe') NOT NULL DEFAULT 'equipe',
    ativo        TINYINT(1)    NOT NULL DEFAULT 1,
    criado_em    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_usuarios_email (email)
) ENGINE=InnoDB;

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

-- =====================================================================
-- Dados iniciais
-- =====================================================================
-- Usuário administrador para o primeiro acesso.
--   E-mail: admin@pawsafe.local
--   Senha:  pawsafe123   (TROQUE depois do primeiro login)
-- O hash abaixo foi gerado com password_hash('pawsafe123', PASSWORD_BCRYPT).
INSERT INTO usuarios (nome, email, senha_hash, perfil, ativo) VALUES
('Administrador', 'admin@pawsafe.local',
 '$2y$10$RLEeeR/uNXNV79HI1mARAOxuTT.v84iSwILru9oHIbRj2XxwABtI.',
 'admin', 1)
ON DUPLICATE KEY UPDATE nome = nome;

-- Dois animais de exemplo (equivalentes ao seed do protótipo).
INSERT INTO animais (nome, especie, raca, cor, idade, data_chegada, sexo, porte, status, peso, vacinado, castrado, microchip, observacoes) VALUES
('Thor', 'Cão', 'Labrador', 'Dourado', '3 anos', '2026-03-14', 'Macho', 'Grande', 'Disponível', 26.40, 1, 1, 0, 'Sociável e ativo. Gosta de passeios.'),
('Mia',  'Gato', 'Siamês', 'Creme e marrom', '2 anos', '2026-02-09', 'Fêmea', 'Pequeno', 'Disponível', 4.20, 1, 1, 0, 'Tranquila e aparentemente saudável.');
