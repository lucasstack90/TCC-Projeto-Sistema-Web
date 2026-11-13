<?php

namespace Core\Middleware;

use Core\Csrf;
use Core\Request;
use Core\Response;

/**
 * Exige o token CSRF em requisições que alteram dados (POST/PUT/PATCH/DELETE).
 * A interface obtém o token em GET /api/csrf e o envia no cabeçalho
 * "X-CSRF-Token".
 */
final class VerificarCsrf implements Middleware
{
    private const METODOS_SEGUROS = ['GET', 'HEAD', 'OPTIONS'];

    public function tratar(Request $req): void
    {
        if (in_array($req->metodo(), self::METODOS_SEGUROS, true)) {
            return;
        }
        $token = $req->cabecalho('X-Csrf-Token') ?? (string) $req->input('_csrf', '');
        if (!Csrf::valido($token)) {
            Response::erro('Token de segurança inválido. Recarregue a página e tente de novo.', 419);
        }
    }
}
