<?php

/*
|--------------------------------------------------------------------------
| Entrada do sistema pela raiz do projeto (XAMPP / htdocs)
|--------------------------------------------------------------------------
| Permite abrir o PAWSAFE em http://localhost/Sistema-web (sem o "/public").
| Faz o mesmo que public/index.php. O .htaccess desta pasta envia os arquivos
| de css, js e fotos para public/ e bloqueia as pastas internas (app, .env...).
*/

use Illuminate\Foundation\Application;
use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Modo de manutenção (php artisan down).
if (file_exists($maintenance = __DIR__.'/storage/framework/maintenance.php')) {
    require $maintenance;
}

// Dependências do Composer: sem a pasta vendor, mostra o que fazer em vez de uma tela branca.
if (! file_exists(__DIR__.'/vendor/autoload.php')) {
    http_response_code(500);
    exit('PAWSAFE: rode "composer install" na pasta do projeto antes de abrir o sistema.');
}

require __DIR__.'/vendor/autoload.php';

/** @var Application $app */
$app = require_once __DIR__.'/bootstrap/app.php';

$app->handleRequest(Request::capture());
