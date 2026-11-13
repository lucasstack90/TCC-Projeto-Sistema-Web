<?php

/**
 * PAWSAFE — Configuração central do sistema.
 *
 * Este é o único lugar com as credenciais do banco e os ajustes do ambiente.
 * No XAMPP padrão o MySQL usa o usuário "root" sem senha; se você definir uma
 * senha, altere apenas aqui.
 *
 * Em produção, prefira ler estes valores de variáveis de ambiente (getenv)
 * para não deixar senha no código.
 */

return [

    // Nome e ambiente do sistema.
    'app' => [
        'nome'      => 'PAWSAFE',
        // 'dev' mostra os erros na tela; 'prod' esconde e grava em storage/logs.
        'ambiente'  => getenv('PAWSAFE_ENV') ?: 'dev',
        // Caminho base da URL. No XAMPP, se o projeto está em
        // htdocs/pawsafe/public, o site abre em /pawsafe/public.
        // Deixe '' quando a pasta public/ for a raiz do site (vhost).
        'base_url'  => getenv('PAWSAFE_BASE_URL') ?: '',
        'fuso'      => 'America/Sao_Paulo',
    ],

    // Conexão com o MySQL do XAMPP.
    'banco' => [
        'host'   => getenv('PAWSAFE_DB_HOST') ?: '127.0.0.1',
        'porta'  => getenv('PAWSAFE_DB_PORT') ?: '3306',
        'nome'   => getenv('PAWSAFE_DB_NAME') ?: 'pawsafe',
        'usuario'=> getenv('PAWSAFE_DB_USER') ?: 'root',
        'senha'  => getenv('PAWSAFE_DB_PASS') ?: '',
        'charset'=> 'utf8mb4',
    ],

    // Sessão (login).
    'sessao' => [
        'nome'          => 'pawsafe_sessao',
        // Minutos de inatividade até expirar o login.
        'tempo_minutos' => 120,
    ],

    // Uploads (fotos de animais, documentos).
    'uploads' => [
        'pasta'        => dirname(__DIR__) . '/storage/uploads',
        'max_bytes'    => 4 * 1024 * 1024, // 4 MB por arquivo
        'tipos'        => ['image/jpeg', 'image/png', 'image/webp'],
    ],
];
