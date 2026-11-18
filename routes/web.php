<?php

/**
 * Rotas da aplicação.
 *
 * Tudo que começa com /api é a API consumida pela interface (fetch + JSON).
 * As páginas HTML continuam sendo servidas como arquivos estáticos de public/.
 *
 * Proteção em camadas:
 *   - Autenticar: exige login (grupo abaixo);
 *   - [ExigirPermissao::class, 'x']: exige que o perfil tenha a permissão "x"
 *     (o mapa fica em app/Core/Permissoes.php);
 *   - VerificarCsrf: exige o token nas gravações.
 *
 * Para criar um módulo novo, copie o bloco de "animais": rotas apontando para
 * as ações do controller (index, show, store, update, destroy).
 */

use Controllers\AnimalController;
use Controllers\AuthController;
use Controllers\ContribuinteController;
use Controllers\MetaController;
use Controllers\UsuarioController;
use Controllers\VeterinarioController;
use Core\Middleware\Autenticar;
use Core\Middleware\ExigirPermissao;
use Core\Middleware\VerificarCsrf;
use Core\Router;

return function (Router $r): void {

    // Atalho: [middleware de permissão] e [permissão + CSRF] para gravações.
    $pode = fn (string $permissao): array => [[ExigirPermissao::class, $permissao]];
    $grava = fn (string $permissao): array => [[ExigirPermissao::class, $permissao], VerificarCsrf::class];

    // --- Públicas (sem login) -------------------------------------------
    $r->get('/api/ping', [MetaController::class, 'ping']);
    $r->get('/api/csrf', [MetaController::class, 'csrf']);
    $r->post('/api/auth/login', [AuthController::class, 'login'], [VerificarCsrf::class]);

    // --- Exigem login ---------------------------------------------------
    $r->grupo([Autenticar::class], function (Router $r) use ($pode, $grava): void {
        $r->get('/api/auth/eu', [AuthController::class, 'eu']);
        $r->post('/api/auth/logout', [AuthController::class, 'logout'], [VerificarCsrf::class]);

        // Animais: todos os perfis consultam; só funcionário cadastra/edita/exclui.
        $r->get('/api/animais', [AnimalController::class, 'index'], $pode('pagina.animais'));
        $r->get('/api/animais/{id}', [AnimalController::class, 'show'], $pode('pagina.animais'));
        $r->post('/api/animais', [AnimalController::class, 'store'], $grava('animais.cadastrar'));
        $r->put('/api/animais/{id}', [AnimalController::class, 'update'], $grava('animais.cadastrar'));
        $r->delete('/api/animais/{id}', [AnimalController::class, 'destroy'], $grava('animais.cadastrar'));

        // Veterinários: lista para quem registra vacinas; gestão só funcionário.
        $r->get('/api/veterinarios', [VeterinarioController::class, 'index'], $pode('veterinarios.ver'));
        $r->post('/api/veterinarios', [VeterinarioController::class, 'store'], $grava('cadastros.gerenciar'));
        $r->put('/api/veterinarios/{id}', [VeterinarioController::class, 'update'], $grava('cadastros.gerenciar'));
        $r->delete('/api/veterinarios/{id}', [VeterinarioController::class, 'destroy'], $grava('cadastros.gerenciar'));

        // Contribuintes: têm CPF/CNPJ (LGPD) — só funcionário vê e gerencia.
        $r->get('/api/contribuintes', [ContribuinteController::class, 'index'], $pode('contribuintes.ver'));
        $r->post('/api/contribuintes', [ContribuinteController::class, 'store'], $grava('cadastros.gerenciar'));
        $r->put('/api/contribuintes/{id}', [ContribuinteController::class, 'update'], $grava('cadastros.gerenciar'));
        $r->delete('/api/contribuintes/{id}', [ContribuinteController::class, 'destroy'], $grava('cadastros.gerenciar'));

        // Usuários do sistema: só funcionário.
        $r->get('/api/usuarios', [UsuarioController::class, 'index'], $pode('usuarios.gerenciar'));
        $r->post('/api/usuarios', [UsuarioController::class, 'store'], $grava('usuarios.gerenciar'));
        $r->put('/api/usuarios/{id}', [UsuarioController::class, 'update'], $grava('usuarios.gerenciar'));
        $r->delete('/api/usuarios/{id}', [UsuarioController::class, 'destroy'], $grava('usuarios.gerenciar'));
    });
};
