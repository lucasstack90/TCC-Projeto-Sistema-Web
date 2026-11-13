<?php

namespace Core\Middleware;

use Core\Request;
use Core\Response;
use Core\Session;

/**
 * Exige que exista um usuário logado. Use nas rotas da API que mexem em dados.
 */
final class Autenticar implements Middleware
{
    public function tratar(Request $req): void
    {
        if (!Session::logado()) {
            Response::erro('Sessão expirada ou acesso não autorizado. Faça login novamente.', 401);
        }
    }
}
