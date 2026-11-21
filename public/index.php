<?php

/**
 * PAWSAFE — Front controller (porta de entrada do sistema).
 *
 * Só a pasta public/ fica exposta no servidor. Todo pedido que não seja um
 * arquivo que existe (CSS, JS, imagem, página .html) é enviado pelo .htaccess
 * para cá, e o roteador decide o que fazer. Na prática, isto trata as rotas
 * /api/*; as páginas HTML são servidas direto pelo Apache como arquivos.
 *
 * Roda sem "composer install": o autoloader abaixo substitui o do Composer.
 */

declare(strict_types=1);

$raiz = dirname(__DIR__);

require $raiz . '/app/Core/Autoloader.php';

use Core\App;
use Core\Autoloader;

// Mapa de namespaces -> pastas (PSR-4 manual).
Autoloader::adicionar('Core', $raiz . '/app/Core');
Autoloader::adicionar('Controllers', $raiz . '/app/Controllers');
Autoloader::adicionar('Models', $raiz . '/app/Models');
Autoloader::registrar();

App::iniciar($raiz);
