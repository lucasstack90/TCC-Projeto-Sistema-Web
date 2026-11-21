<?php

namespace Core\Middleware;

use Core\Permissoes;
use Core\Request;
use Core\Response;
use Core\Session;

/**
 * Barra a requisição se o perfil do usuário logado não tiver a permissão.
 *
 * Uso nas rotas (o segundo item é a permissão exigida):
 *   $r->post('/api/animais', [...], [[ExigirPermissao::class, 'animais.cadastrar']]);
 */
final class ExigirPermissao implements Middleware
{
    public function __construct(private string $permissao)
    {
    }

    public function tratar(Request $req): void
    {
        $usuario = Session::usuario();
        if (!$usuario) {
            Response::erro('Sessão expirada ou acesso não autorizado. Faça login novamente.', 401);
        }
        if (!Permissoes::pode($usuario['perfil'] ?? null, $this->permissao)) {
            Response::erro('Seu perfil não tem permissão para esta ação.', 403);
        }
    }
}
