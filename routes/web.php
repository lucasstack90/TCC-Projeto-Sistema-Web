<?php

/**
 * Rotas da aplicação.
 *
 * Tudo que começa com /api é a API consumida pela interface (fetch + JSON).
 * As páginas HTML continuam sendo servidas como arquivos estáticos de public/.
 *
 * Para criar um módulo novo, copie o bloco de "animais": cinco rotas apontando
 * para as cinco ações do controller (index, show, store, update, destroy).
 */

use Controllers\AnimalController;
use Controllers\AuthController;
use Controllers\MetaController;
use Core\Middleware\Autenticar;
use Core\Middleware\VerificarCsrf;
use Core\Router;

return function (Router $r): void {

    // --- Públicas (sem login) -------------------------------------------
    $r->get('/api/ping', [MetaController::class, 'ping']);
    $r->get('/api/csrf', [MetaController::class, 'csrf']);
    $r->post('/api/auth/login', [AuthController::class, 'login'], [VerificarCsrf::class]);

    // --- Exigem login ---------------------------------------------------
    $r->grupo([Autenticar::class], function (Router $r): void {
        $r->get('/api/auth/eu', [AuthController::class, 'eu']);
        $r->post('/api/auth/logout', [AuthController::class, 'logout'], [VerificarCsrf::class]);

        // Módulo de Animais (referência para os demais módulos).
        $r->get('/api/animais', [AnimalController::class, 'index']);
        $r->get('/api/animais/{id}', [AnimalController::class, 'show']);
        $r->post('/api/animais', [AnimalController::class, 'store'], [VerificarCsrf::class]);
        $r->put('/api/animais/{id}', [AnimalController::class, 'update'], [VerificarCsrf::class]);
        $r->delete('/api/animais/{id}', [AnimalController::class, 'destroy'], [VerificarCsrf::class]);
    });
};
