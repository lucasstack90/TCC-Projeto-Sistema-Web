-- =====================================================================
-- PAWSAFE — banco de dados completo (MySQL / MariaDB do XAMPP)
-- Sistema web de gestão para ONGs e grupos de proteção animal
--
-- COMO USAR: phpMyAdmin (http://localhost/phpmyadmin) → aba "Importar" →
-- escolher este arquivo → "Importar". O banco "pawsafe" é criado sozinho.
--
-- ATENÇÃO: importar de novo APAGA as tabelas e volta aos dados de exemplo.
--
-- Este arquivo tem o mesmo resultado que "php artisan migrate --seed"
-- (database/migrations + database/seeders). Ao mudar uma migration,
-- atualize este arquivo também.
--
-- Logins de demonstração (troque antes de usar com dados reais):
--   Funcionária: renata.oliveira@email.com / pawsafe123
--   Voluntário:  marcos.ribeiro@email.com  / pawsafe123
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `pawsafe` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `pawsafe`;

SET NAMES utf8mb4;
SET time_zone = '-03:00';
SET FOREIGN_KEY_CHECKS = 0;

DROP VIEW IF EXISTS `vw_saldo_financeiro`;
DROP TABLE IF EXISTS
  `log_auditoria`, `relatorio_narrativas`, `configuracoes_relatorio`,
  `movimentacao_lotes`, `movimentacoes`, `lotes`, `embalagens`, `itens_estoque`, `categorias_estoque`,
  `configuracoes_financeiras`, `orcamentos`, `despesas`, `doacoes`,
  `adocao_registros`, `adocoes`, `adotante_documentos`, `adotantes`,
  `animal_pesagens`, `animal_historicos`, `animal_vacinas`, `animais`,
  `resgate_registros`, `resgates`,
  `password_reset_tokens`, `users`, `voluntarios`, `migrations`;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- Controle do Laravel: diz ao "php artisan migrate" que estas tabelas já existem
-- ---------------------------------------------------------------------
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `migration` varchar(255) NOT NULL,
  `batch` int NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `migrations` (`migration`, `batch`) VALUES
('0001_01_01_000000_create_users_table', 1),
('2026_11_11_000100_create_voluntarios_table', 1),
('2026_11_11_000200_create_resgates_tables', 1),
('2026_11_11_000300_create_animais_tables', 1),
('2026_11_11_000400_create_adocoes_tables', 1),
('2026_11_11_000500_create_financeiro_tables', 1),
('2026_11_11_000600_create_estoque_tables', 1),
('2026_11_11_000700_create_relatorio_e_auditoria_tables', 1);

-- =====================================================================
-- VOLUNTÁRIOS E EQUIPE
-- LGPD: data do consentimento e anonimização sem apagar o histórico.
-- =====================================================================
CREATE TABLE `voluntarios` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `telefone` varchar(20) NOT NULL,
  `funcao` enum('Voluntário','Coordenação','Veterinário(a)','Administração') NOT NULL DEFAULT 'Voluntário',
  `status` enum('Interessado','Ativo','Inativo') NOT NULL DEFAULT 'Interessado',
  `habilidades` json DEFAULT NULL,
  `experiencia` text DEFAULT NULL,
  `dias` json DEFAULT NULL,
  `turnos` json DEFAULT NULL,
  `observacoes` text DEFAULT NULL,
  `origem` enum('Formulário','Cadastro interno') NOT NULL DEFAULT 'Cadastro interno',
  `consentimento_lgpd_em` timestamp NULL DEFAULT NULL,
  `consentimento_ip` varchar(45) DEFAULT NULL,
  `anonimizado_em` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `voluntarios_email_unique` (`email`),
  KEY `voluntarios_status_index` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- USUÁRIOS (login). perfil: funcionario = acesso completo; voluntario = limitado.
-- Senha só como hash bcrypt, nunca em texto puro (LGPD, art. 46).
-- =====================================================================
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `perfil` enum('funcionario','voluntario') NOT NULL DEFAULT 'voluntario',
  `voluntario_id` bigint unsigned DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `ultimo_acesso_em` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`),
  KEY `users_voluntario_id_foreign` (`voluntario_id`),
  CONSTRAINT `users_voluntario_id_foreign` FOREIGN KEY (`voluntario_id`) REFERENCES `voluntarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- RESGATES
-- =====================================================================
CREATE TABLE `resgates` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `data` date NOT NULL,
  `logradouro` varchar(150) NOT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `bairro` varchar(100) NOT NULL,
  `cidade` varchar(100) NOT NULL DEFAULT 'Guarapuava - PR',
  `referencia` varchar(200) DEFAULT NULL,
  `especie` enum('Cão','Gato','Outros') NOT NULL,
  `quantidade` smallint unsigned NOT NULL DEFAULT 1,
  `prioridade` enum('Baixa','Média','Alta','Crítica') NOT NULL DEFAULT 'Média',
  `descricao` text NOT NULL,
  `responsavel_id` bigint unsigned DEFAULT NULL,
  `denunciante` varchar(120) DEFAULT NULL,
  `etapa` enum('Pendente','Em atendimento','Concluído','Sem sucesso') NOT NULL DEFAULT 'Pendente',
  `encerrado_em` date DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `resgates_etapa_data_index` (`etapa`,`data`),
  KEY `resgates_responsavel_id_foreign` (`responsavel_id`),
  KEY `resgates_user_id_foreign` (`user_id`),
  CONSTRAINT `resgates_responsavel_id_foreign` FOREIGN KEY (`responsavel_id`) REFERENCES `voluntarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `resgates_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `resgate_registros` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `resgate_id` bigint unsigned NOT NULL,
  `data` date NOT NULL,
  `etapa` varchar(30) NOT NULL,
  `texto` text NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `resgate_registros_resgate_id_foreign` (`resgate_id`),
  KEY `resgate_registros_user_id_foreign` (`user_id`),
  CONSTRAINT `resgate_registros_resgate_id_foreign` FOREIGN KEY (`resgate_id`) REFERENCES `resgates` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resgate_registros_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- ANIMAIS (ficha, vacinas, histórico de cuidados e pesagens)
-- Foto guardada como caminho do arquivo (storage), não em base64 no banco.
-- =====================================================================
CREATE TABLE `animais` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(60) NOT NULL,
  `especie` enum('Cão','Gato','Outros') NOT NULL,
  `raca` varchar(60) NOT NULL,
  `cor` varchar(60) NOT NULL,
  `idade_estimada` varchar(30) DEFAULT NULL,
  `data_chegada` date NOT NULL,
  `sexo` enum('Macho','Fêmea','Não identificado') NOT NULL DEFAULT 'Não identificado',
  `porte` enum('Pequeno','Médio','Grande') NOT NULL DEFAULT 'Médio',
  `status` enum('Resgatado','Em Tratamento','Disponível','Em Lar Temporário','Adotado') NOT NULL DEFAULT 'Resgatado',
  `peso` decimal(6,2) DEFAULT NULL,
  `vacinado` tinyint(1) NOT NULL DEFAULT 0,
  `castrado` tinyint(1) NOT NULL DEFAULT 0,
  `microchip` tinyint(1) NOT NULL DEFAULT 0,
  `observacoes` text DEFAULT NULL,
  `foto` varchar(255) DEFAULT NULL,
  `resgate_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `animais_status_especie_index` (`status`,`especie`),
  KEY `animais_resgate_id_foreign` (`resgate_id`),
  KEY `animais_user_id_foreign` (`user_id`),
  CONSTRAINT `animais_resgate_id_foreign` FOREIGN KEY (`resgate_id`) REFERENCES `resgates` (`id`) ON DELETE SET NULL,
  CONSTRAINT `animais_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `animal_vacinas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `animal_id` bigint unsigned NOT NULL,
  `nome` varchar(80) NOT NULL,
  `data_aplicacao` date NOT NULL,
  `proxima_dose` date DEFAULT NULL,
  `lote` varchar(40) DEFAULT NULL,
  `veterinario` varchar(120) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `animal_vacinas_animal_id_foreign` (`animal_id`),
  KEY `animal_vacinas_user_id_foreign` (`user_id`),
  CONSTRAINT `animal_vacinas_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE,
  CONSTRAINT `animal_vacinas_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `animal_historicos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `animal_id` bigint unsigned NOT NULL,
  `tipo` varchar(30) NOT NULL COMMENT 'Cadastro, Consulta, Cirurgia, Tratamento, Exame, Banho e Tosa, Resgate, Adoção, Outro',
  `data` date NOT NULL,
  `descricao` varchar(200) NOT NULL,
  `responsavel` varchar(120) DEFAULT NULL,
  `notas` text DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `animal_historicos_animal_id_foreign` (`animal_id`),
  KEY `animal_historicos_user_id_foreign` (`user_id`),
  CONSTRAINT `animal_historicos_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE,
  CONSTRAINT `animal_historicos_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `animal_pesagens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `animal_id` bigint unsigned NOT NULL,
  `peso` decimal(6,2) NOT NULL,
  `data` date NOT NULL,
  `observacao` varchar(150) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `animal_pesagens_animal_id_foreign` (`animal_id`),
  KEY `animal_pesagens_user_id_foreign` (`user_id`),
  CONSTRAINT `animal_pesagens_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE,
  CONSTRAINT `animal_pesagens_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- ADOÇÕES
-- LGPD: CPF criptografado pelo Laravel (APP_KEY) + cpf_hash para impedir CPF repetido;
-- documentos fora da pasta pública; consentimento com data e versão do termo.
-- =====================================================================
CREATE TABLE `adotantes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(120) NOT NULL,
  `cpf` text NOT NULL COMMENT 'criptografado',
  `cpf_hash` char(64) NOT NULL COMMENT 'HMAC-SHA256 do CPF',
  `data_nascimento` date NOT NULL,
  `telefone` varchar(20) NOT NULL,
  `email` varchar(150) NOT NULL,
  `logradouro` varchar(150) NOT NULL,
  `numero` varchar(20) DEFAULT NULL,
  `bairro` varchar(100) NOT NULL,
  `cidade` varchar(100) NOT NULL DEFAULT 'Guarapuava - PR',
  `tipo_moradia` enum('Casa','Apartamento','Chácara / sítio','Outro') NOT NULL,
  `posse_moradia` enum('Própria','Alugada','Cedida') NOT NULL,
  `tem_quintal` tinyint(1) NOT NULL DEFAULT 0,
  `tem_telas` tinyint(1) NOT NULL DEFAULT 0,
  `moradores` tinyint unsigned NOT NULL DEFAULT 1,
  `tem_criancas` tinyint(1) NOT NULL DEFAULT 0,
  `outros_animais` varchar(200) DEFAULT NULL,
  `horas_sozinho` tinyint unsigned DEFAULT NULL,
  `experiencia` text DEFAULT NULL,
  `motivacao` text DEFAULT NULL,
  `consentimento_lgpd_em` timestamp NULL DEFAULT NULL,
  `consentimento_versao` varchar(20) DEFAULT NULL,
  `anonimizado_em` timestamp NULL DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `adotantes_cpf_hash_unique` (`cpf_hash`),
  KEY `adotantes_user_id_foreign` (`user_id`),
  CONSTRAINT `adotantes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `adotante_documentos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `adotante_id` bigint unsigned NOT NULL,
  `caminho` varchar(255) NOT NULL,
  `nome_original` varchar(150) NOT NULL,
  `mime` varchar(60) NOT NULL,
  `tamanho` int unsigned NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `adotante_documentos_adotante_id_foreign` (`adotante_id`),
  KEY `adotante_documentos_user_id_foreign` (`user_id`),
  CONSTRAINT `adotante_documentos_adotante_id_foreign` FOREIGN KEY (`adotante_id`) REFERENCES `adotantes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `adotante_documentos_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `adocoes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `animal_id` bigint unsigned NOT NULL,
  `adotante_id` bigint unsigned NOT NULL,
  `etapa` enum('Novo','Em análise','Aprovada','Concluída','Recusada','Cancelada') NOT NULL DEFAULT 'Novo',
  `aberta_em` date NOT NULL,
  `encerrada_em` date DEFAULT NULL,
  `entrevista` tinyint(1) NOT NULL DEFAULT 0,
  `visita` tinyint(1) NOT NULL DEFAULT 0,
  `documentos_conferidos` tinyint(1) NOT NULL DEFAULT 0,
  `termo_assinado` tinyint(1) NOT NULL DEFAULT 0,
  `motivo_encerramento` varchar(300) DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `adocoes_etapa_animal_id_index` (`etapa`,`animal_id`),
  KEY `adocoes_animal_id_foreign` (`animal_id`),
  KEY `adocoes_adotante_id_foreign` (`adotante_id`),
  KEY `adocoes_user_id_foreign` (`user_id`),
  CONSTRAINT `adocoes_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`),
  CONSTRAINT `adocoes_adotante_id_foreign` FOREIGN KEY (`adotante_id`) REFERENCES `adotantes` (`id`),
  CONSTRAINT `adocoes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `adocao_registros` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `adocao_id` bigint unsigned NOT NULL,
  `data` date NOT NULL,
  `etapa` varchar(30) NOT NULL,
  `texto` text NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `adocao_registros_adocao_id_foreign` (`adocao_id`),
  KEY `adocao_registros_user_id_foreign` (`user_id`),
  CONSTRAINT `adocao_registros_adocao_id_foreign` FOREIGN KEY (`adocao_id`) REFERENCES `adocoes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `adocao_registros_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- FINANCEIRO: dinheiro em DECIMAL(10,2); exclusão lógica para prestação de contas.
-- O saldo não é coluna: é calculado pela view vw_saldo_financeiro.
-- =====================================================================
CREATE TABLE `doacoes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `data` date NOT NULL,
  `origem` enum('Pessoa física','Pessoa jurídica') NOT NULL,
  `doador` varchar(150) DEFAULT NULL COMMENT 'vazio = doação anônima',
  `tipo` enum('Financeira','Material') NOT NULL,
  `valor` decimal(10,2) DEFAULT NULL,
  `forma_pagamento` enum('PIX','Dinheiro','Transferência','Cartão','Boleto') DEFAULT NULL,
  `item` varchar(120) DEFAULT NULL,
  `quantidade` decimal(10,3) DEFAULT NULL,
  `unidade` enum('kg','g','L','mL','un') DEFAULT NULL,
  `observacoes` text DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `alterado_por` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `doacoes_tipo_data_index` (`tipo`,`data`),
  KEY `doacoes_user_id_foreign` (`user_id`),
  KEY `doacoes_alterado_por_foreign` (`alterado_por`),
  CONSTRAINT `doacoes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `doacoes_alterado_por_foreign` FOREIGN KEY (`alterado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `despesas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `data` date NOT NULL,
  `categoria` enum('Veterinário','Medicamentos','Ração e alimentação','Higiene e limpeza','Transporte','Manutenção','Outros') NOT NULL,
  `descricao` varchar(200) NOT NULL,
  `valor` decimal(10,2) NOT NULL,
  `pago_a` varchar(150) DEFAULT NULL,
  `animal_id` bigint unsigned DEFAULT NULL,
  `observacoes` text DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `alterado_por` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `despesas_categoria_data_index` (`categoria`,`data`),
  KEY `despesas_animal_id_foreign` (`animal_id`),
  KEY `despesas_user_id_foreign` (`user_id`),
  KEY `despesas_alterado_por_foreign` (`alterado_por`),
  CONSTRAINT `despesas_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL,
  CONSTRAINT `despesas_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `despesas_alterado_por_foreign` FOREIGN KEY (`alterado_por`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `orcamentos` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `categoria` varchar(40) NOT NULL,
  `valor_mensal` decimal(10,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orcamentos_categoria_unique` (`categoria`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `configuracoes_financeiras` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `saldo_inicial` decimal(10,2) NOT NULL DEFAULT 0.00,
  `data_inicio` date NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Saldo = saldo inicial + doações financeiras − despesas (registros não excluídos)
CREATE OR REPLACE VIEW `vw_saldo_financeiro` AS
SELECT
  COALESCE((SELECT saldo_inicial FROM configuracoes_financeiras ORDER BY id LIMIT 1), 0) AS saldo_inicial,
  COALESCE((SELECT SUM(valor) FROM doacoes WHERE tipo = 'Financeira' AND deleted_at IS NULL), 0) AS total_doacoes,
  COALESCE((SELECT SUM(valor) FROM despesas WHERE deleted_at IS NULL), 0) AS total_despesas,
  COALESCE((SELECT saldo_inicial FROM configuracoes_financeiras ORDER BY id LIMIT 1), 0)
    + COALESCE((SELECT SUM(valor) FROM doacoes WHERE tipo = 'Financeira' AND deleted_at IS NULL), 0)
    - COALESCE((SELECT SUM(valor) FROM despesas WHERE deleted_at IS NULL), 0) AS saldo;

-- =====================================================================
-- ESTOQUE: saldo = entradas − saídas (movimentações); erro se corrige com estorno.
-- Quantidades em DECIMAL(10,3) na unidade de controle do item.
-- =====================================================================
CREATE TABLE `categorias_estoque` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nome` varchar(60) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categorias_estoque_nome_unique` (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `itens_estoque` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `categoria_id` bigint unsigned NOT NULL,
  `nome` varchar(120) NOT NULL,
  `unidade` enum('kg','g','L','mL','un') NOT NULL,
  `estoque_minimo` decimal(10,3) NOT NULL DEFAULT 0.000,
  `controla_validade` tinyint(1) NOT NULL DEFAULT 0,
  `observacoes` text DEFAULT NULL,
  `ativo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `itens_estoque_nome_unique` (`nome`),
  KEY `itens_estoque_categoria_id_foreign` (`categoria_id`),
  CONSTRAINT `itens_estoque_categoria_id_foreign` FOREIGN KEY (`categoria_id`) REFERENCES `categorias_estoque` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `embalagens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint unsigned NOT NULL,
  `nome` varchar(60) NOT NULL,
  `quantidade` decimal(10,3) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `embalagens_item_id_foreign` (`item_id`),
  CONSTRAINT `embalagens_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `itens_estoque` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lotes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint unsigned NOT NULL,
  `codigo` varchar(40) NOT NULL,
  `data_validade` date NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lotes_item_id_codigo_unique` (`item_id`,`codigo`),
  CONSTRAINT `lotes_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `itens_estoque` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `movimentacoes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `item_id` bigint unsigned NOT NULL,
  `tipo` enum('entrada','saida') NOT NULL,
  `motivo` enum('doacao','compra','consumo','uso_animal','perda','repasse','ajuste','estorno') NOT NULL,
  `quantidade` decimal(10,3) NOT NULL,
  `quantidade_informada` decimal(10,3) DEFAULT NULL,
  `embalagem_id` bigint unsigned DEFAULT NULL,
  `animal_id` bigint unsigned DEFAULT NULL,
  `doacao_id` bigint unsigned DEFAULT NULL,
  `origem_destino` varchar(150) DEFAULT NULL,
  `observacao` text DEFAULT NULL,
  `estorno_de_id` bigint unsigned DEFAULT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `data` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `movimentacoes_item_id_tipo_data_index` (`item_id`,`tipo`,`data`),
  KEY `movimentacoes_embalagem_id_foreign` (`embalagem_id`),
  KEY `movimentacoes_animal_id_foreign` (`animal_id`),
  KEY `movimentacoes_doacao_id_foreign` (`doacao_id`),
  KEY `movimentacoes_estorno_de_id_foreign` (`estorno_de_id`),
  KEY `movimentacoes_user_id_foreign` (`user_id`),
  CONSTRAINT `movimentacoes_item_id_foreign` FOREIGN KEY (`item_id`) REFERENCES `itens_estoque` (`id`),
  CONSTRAINT `movimentacoes_embalagem_id_foreign` FOREIGN KEY (`embalagem_id`) REFERENCES `embalagens` (`id`) ON DELETE SET NULL,
  CONSTRAINT `movimentacoes_animal_id_foreign` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL,
  CONSTRAINT `movimentacoes_doacao_id_foreign` FOREIGN KEY (`doacao_id`) REFERENCES `doacoes` (`id`) ON DELETE SET NULL,
  CONSTRAINT `movimentacoes_estorno_de_id_foreign` FOREIGN KEY (`estorno_de_id`) REFERENCES `movimentacoes` (`id`),
  CONSTRAINT `movimentacoes_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `movimentacao_lotes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `movimentacao_id` bigint unsigned NOT NULL,
  `lote_id` bigint unsigned NOT NULL,
  `quantidade` decimal(10,3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `movimentacao_lotes_movimentacao_id_foreign` (`movimentacao_id`),
  KEY `movimentacao_lotes_lote_id_foreign` (`lote_id`),
  CONSTRAINT `movimentacao_lotes_movimentacao_id_foreign` FOREIGN KEY (`movimentacao_id`) REFERENCES `movimentacoes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `movimentacao_lotes_lote_id_foreign` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- RELATÓRIO TÉCNICO E AUDITORIA (LGPD, art. 37)
-- =====================================================================
CREATE TABLE `configuracoes_relatorio` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `organizacao` json NOT NULL,
  `parceria` json NOT NULL,
  `metas` json NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `relatorio_narrativas` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `periodo_inicio` date NOT NULL,
  `periodo_fim` date NOT NULL,
  `texto` longtext NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `relatorio_narrativas_periodo_inicio_periodo_fim_unique` (`periodo_inicio`,`periodo_fim`),
  KEY `relatorio_narrativas_user_id_foreign` (`user_id`),
  CONSTRAINT `relatorio_narrativas_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `log_auditoria` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `acao` varchar(40) NOT NULL,
  `tabela` varchar(60) DEFAULT NULL,
  `registro_id` bigint unsigned DEFAULT NULL,
  `descricao` varchar(255) DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `log_auditoria_tabela_registro_id_index` (`tabela`,`registro_id`),
  KEY `log_auditoria_user_id_foreign` (`user_id`),
  CONSTRAINT `log_auditoria_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- DADOS DE EXEMPLO (os mesmos do protótipo, com os mesmos ids)
-- =====================================================================

INSERT INTO `voluntarios` (`id`, `nome`, `email`, `telefone`, `funcao`, `status`, `habilidades`, `experiencia`, `dias`, `turnos`, `observacoes`, `origem`, `consentimento_lgpd_em`, `created_at`, `updated_at`) VALUES
(1, 'Renata Oliveira', 'renata.oliveira@email.com', '(42) 99901-2233', 'Administração', 'Ativo', '["Resgate","Redes sociais","Arrecadação"]', 'Coordena a organização desde a fundação.', '["Seg","Ter","Qua","Qui","Sex"]', '["Manhã","Tarde"]', NULL, 'Cadastro interno', '2025-03-01 00:00:00', '2025-03-01 00:00:00', '2025-03-01 00:00:00'),
(2, 'Marcos Ribeiro', 'marcos.ribeiro@email.com', '(42) 99812-4455', 'Voluntário', 'Ativo', '["Resgate","Transporte"]', 'Tem caminhonete e ajuda nos resgates de fim de semana.', '["Qua","Sáb","Dom"]', '["Manhã","Tarde"]', NULL, 'Formulário', '2025-08-12 00:00:00', '2025-08-12 00:00:00', '2025-08-12 00:00:00'),
(3, 'Ana Paula Souza', 'anapaula.souza@email.com', '(42) 99733-6677', 'Coordenação', 'Ativo', '["Resgate","Cuidados e limpeza","Lar temporário"]', 'Já foi lar temporário de mais de 20 gatos.', '["Seg","Qua","Sex"]', '["Tarde","Noite"]', 'Responsável pela escala de limpeza.', 'Formulário', '2025-06-20 00:00:00', '2025-06-20 00:00:00', '2025-06-20 00:00:00'),
(4, 'Dra. Marina Lopes', 'marina.lopes@email.com', '(42) 99654-8899', 'Veterinário(a)', 'Ativo', '["Cuidados veterinários"]', 'Médica-veterinária, atende os animais da organização.', '["Ter","Qui"]', '["Manhã"]', NULL, 'Cadastro interno', '2025-04-10 00:00:00', '2025-04-10 00:00:00', '2025-04-10 00:00:00'),
(5, 'Dr. Henrique Farias', 'henrique.farias@email.com', '(42) 99545-1010', 'Veterinário(a)', 'Ativo', '["Cuidados veterinários"]', 'Médico-veterinário, foco em felinos.', '["Seg","Sex"]', '["Tarde"]', NULL, 'Cadastro interno', '2025-09-02 00:00:00', '2025-09-02 00:00:00', '2025-09-02 00:00:00'),
(6, 'Paulo Henrique Lima', 'paulo.lima@email.com', '(42) 99476-2020', 'Voluntário', 'Inativo', '["Cuidados e limpeza"]', NULL, '["Sáb"]', '["Manhã"]', 'Mudou de cidade em agosto de 2026.', 'Formulário', '2025-11-15 00:00:00', '2025-11-15 00:00:00', '2025-11-15 00:00:00'),
(7, 'Bruna Carvalho', 'bruna.carvalho@email.com', '(42) 99367-3030', 'Voluntário', 'Interessado', '["Redes sociais","Eventos e feiras"]', 'Ajudou a organizar uma feira de adoção na faculdade.', '["Sáb"]', '["Manhã","Tarde"]', NULL, 'Formulário', '2026-10-24 00:00:00', '2026-10-24 00:00:00', '2026-10-24 00:00:00'),
(8, 'Diego Martins', 'diego.martins@email.com', '(42) 99258-4040', 'Voluntário', 'Interessado', '["Transporte","Resgate"]', 'Tem carro e já levou animais à clínica para uma vizinha.', '["Dom"]', '["Manhã"]', NULL, 'Formulário', '2026-10-27 00:00:00', '2026-10-27 00:00:00', '2026-10-27 00:00:00');

-- Senha "pawsafe123" em hash bcrypt (o banco nunca guarda a senha em texto).
INSERT INTO `users` (`id`, `name`, `email`, `password`, `perfil`, `voluntario_id`, `ativo`, `created_at`, `updated_at`) VALUES
(1, 'Renata Oliveira', 'renata.oliveira@email.com', '$2y$12$XJqPVLgWm1HnyiP4xzEiB.m.8DdBez2wQLqik0JaDyL4Im9N3BIFK', 'funcionario', 1, 1, '2026-11-11 00:00:00', '2026-11-11 00:00:00'),
(2, 'Marcos Ribeiro', 'marcos.ribeiro@email.com', '$2y$12$XJqPVLgWm1HnyiP4xzEiB.m.8DdBez2wQLqik0JaDyL4Im9N3BIFK', 'voluntario', 2, 1, '2026-11-11 00:00:00', '2026-11-11 00:00:00');

INSERT INTO `animais` (`id`, `nome`, `especie`, `raca`, `cor`, `idade_estimada`, `data_chegada`, `sexo`, `porte`, `status`, `peso`, `vacinado`, `castrado`, `microchip`, `observacoes`, `foto`, `created_at`, `updated_at`) VALUES
(1, 'Thor', 'Cão', 'Labrador', 'Dourado', '3 anos', '2026-03-14', 'Macho', 'Grande', 'Disponível', 26.40, 1, 1, 0, 'Sociável e ativo. Gosta de passeios.', 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 'Mia', 'Gato', 'Siamês', 'Creme e marrom', '2 anos', '2026-02-09', 'Fêmea', 'Pequeno', 'Disponível', 4.20, 1, 1, 0, 'Tranquila e aparentemente saudável.', 'https://images.unsplash.com/photo-1573865526739-10659f8f3bcf?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(3, 'Bolinha', 'Cão', 'Vira-lata', 'Branco e marrom', '1 ano', '2026-04-02', 'Macho', 'Médio', 'Em Tratamento', 12.10, 0, 0, 0, 'Em acompanhamento veterinário.', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(4, 'Nina', 'Gato', 'Persa', 'Caramelo', '4 anos', '2026-01-20', 'Fêmea', 'Médio', 'Em Lar Temporário', 3.90, 1, 1, 1, 'Em lar temporário.', 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(5, 'Rex', 'Cão', 'Pastor Alemão', 'Preto e caramelo', '5 anos', '2025-12-11', 'Macho', 'Grande', 'Adotado', 31.50, 1, 1, 1, 'Adoção concluída.', 'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(6, 'Pérola', 'Outros', 'Coelho angorá', 'Branco', '8 meses', '2026-05-02', 'Fêmea', 'Pequeno', 'Disponível', 1.80, 1, 0, 0, 'Coelha dócil.', 'https://images.unsplash.com/photo-1591382386627-349b692688ff?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(7, 'Mel', 'Cão', 'Golden Retriever', 'Dourado', '2 anos', '2026-04-12', 'Fêmea', 'Grande', 'Resgatado', 24.70, 0, 0, 0, 'Resgate recente. Aguardando avaliação veterinária.', 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(8, 'Simba', 'Gato', 'Maine Coon', 'Laranja', '3 anos', '2026-02-18', 'Macho', 'Grande', 'Disponível', 6.20, 1, 1, 1, 'Sociável com pessoas.', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=900&q=80', '2026-05-02 12:00:00', '2026-05-02 12:00:00');

INSERT INTO `animal_vacinas` (`animal_id`, `nome`, `data_aplicacao`, `proxima_dose`, `lote`, `veterinario`, `created_at`, `updated_at`) VALUES
(1, 'V8', '2026-03-15', '2027-03-15', 'V8-2048', 'Dra. Marina Lopes', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 'Tríplice Felina', '2026-02-10', '2027-02-10', 'TF-2026-220', 'Dr. Henrique Farias', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 'Antirrábica', '2026-02-10', '2027-02-10', 'AR-2026-046', 'Dr. Henrique Farias', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(4, 'Antirrábica', '2026-01-20', '2027-01-20', 'AR-9012', 'Dr. Henrique Farias', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(8, 'Tríplice Felina', '2026-02-18', '2027-02-18', 'TF-2210', 'Dr. Henrique Farias', '2026-05-02 12:00:00', '2026-05-02 12:00:00');

INSERT INTO `animal_historicos` (`animal_id`, `tipo`, `data`, `descricao`, `responsavel`, `notas`, `created_at`, `updated_at`) VALUES
(1, 'Consulta', '2026-03-14', 'Avaliação geral de chegada', 'Dra. Marina Lopes', 'Saúde geral boa.', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 'Consulta', '2026-03-10', 'Retorno — avaliação nutricional', 'Dr. Henrique Farias', 'Ganhou 400 g. Ótima evolução.', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 'Consulta', '2026-02-09', 'Avaliação geral de chegada', 'Dr. Henrique Farias', 'Dieta de recuperação prescrita.', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(3, 'Tratamento', '2026-04-02', 'Início de tratamento dermatológico', 'Dra. Marina Lopes', 'Retorno agendado.', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(5, 'Adoção', '2025-12-20', 'Adoção concluída', 'Equipe PAWSAFE', 'Termo arquivado.', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(7, 'Resgate', '2026-04-12', 'Resgate em área urbana', 'Equipe PAWSAFE', 'Encaminhada para avaliação.', '2026-05-02 12:00:00', '2026-05-02 12:00:00');

INSERT INTO `animal_pesagens` (`animal_id`, `peso`, `data`, `observacao`, `created_at`, `updated_at`) VALUES
(1, 26.40, '2026-03-14', 'Avaliação inicial', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 4.20, '2026-03-10', 'Retorno', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(2, 3.80, '2026-02-09', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(3, 12.10, '2026-04-02', 'Pesagem de chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(4, 3.90, '2026-01-20', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(5, 31.50, '2025-12-11', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(6, 1.80, '2026-05-02', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(7, 24.70, '2026-04-12', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00'),
(8, 6.20, '2026-02-18', 'Chegada', '2026-05-02 12:00:00', '2026-05-02 12:00:00');

INSERT INTO `orcamentos` (`categoria`, `valor_mensal`, `created_at`, `updated_at`) VALUES
('Veterinário', 600.00, NOW(), NOW()),
('Medicamentos', 200.00, NOW(), NOW()),
('Ração e alimentação', 400.00, NOW(), NOW()),
('Higiene e limpeza', 100.00, NOW(), NOW()),
('Transporte', 150.00, NOW(), NOW()),
('Manutenção', 100.00, NOW(), NOW()),
('Outros', 100.00, NOW(), NOW());

INSERT INTO `configuracoes_financeiras` (`saldo_inicial`, `data_inicio`, `created_at`, `updated_at`) VALUES
(400.00, '2026-08-01', NOW(), NOW());

INSERT INTO `categorias_estoque` (`nome`, `created_at`, `updated_at`) VALUES
('Ração', NOW(), NOW()),
('Medicamento', NOW(), NOW()),
('Vacina', NOW(), NOW()),
('Higiene e limpeza', NOW(), NOW()),
('Utensílio', NOW(), NOW());

INSERT INTO `configuracoes_relatorio` (`organizacao`, `parceria`, `metas`, `created_at`, `updated_at`) VALUES
(
  '{"name":"Associação de Proteção Animal (exemplo)","cnpj":"00.000.000/0001-00","address":"Rua XV de Novembro, 1000 — Centro","city":"Guarapuava - PR","phone":"(42) 3000-0000","email":"contato@ong-exemplo.org.br","legalRep":"Renata Oliveira","legalRole":"Presidente"}',
  '{"publicFunding":true,"instrument":"Termo de Colaboração nº 000/2026 (exemplo)","grantor":"Prefeitura Municipal de Guarapuava — Secretaria Municipal de Meio Ambiente","object":"Resgate, tratamento veterinário e encaminhamento para adoção responsável de cães e gatos em situação de vulnerabilidade.","start":"2026-01-01","end":"2026-12-31"}',
  '{"rescues":2,"adoptions":2,"vaccines":4,"healthCare":3}',
  NOW(), NOW()
);
