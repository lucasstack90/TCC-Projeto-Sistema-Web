<?php

namespace Core;

/**
 * Proteção CSRF (Cross-Site Request Forgery).
 *
 * Gera um token por sessão. Toda requisição que altera dados (POST/PUT/DELETE)
 * precisa reenviar esse token no cabeçalho "X-CSRF-Token". A interface lê o
 * token de GET /api/csrf e o envia nas chamadas seguintes.
 */
final class Csrf
{
    private const CHAVE = '_csrf_token';

    public static function token(): string
    {
        if (empty($_SESSION[self::CHAVE])) {
            $_SESSION[self::CHAVE] = bin2hex(random_bytes(32));
        }
        return $_SESSION[self::CHAVE];
    }

    /** Compara o token enviado com o da sessão (comparação segura). */
    public static function valido(?string $enviado): bool
    {
        $atual = $_SESSION[self::CHAVE] ?? '';
        return is_string($enviado) && $atual !== '' && hash_equals($atual, $enviado);
    }
}
