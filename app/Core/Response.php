<?php

namespace Core;

/**
 * Ajuda a devolver respostas HTTP, principalmente JSON para a interface.
 */
final class Response
{
    /** Devolve JSON com um código de status e encerra a execução. */
    public static function json(mixed $dados, int $status = 200): never
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode($dados, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    /** Resposta de sucesso padronizada: { "ok": true, "dados": ... }. */
    public static function ok(mixed $dados = null, int $status = 200): never
    {
        self::json(['ok' => true, 'dados' => $dados], $status);
    }

    /**
     * Resposta de erro padronizada: { "ok": false, "erro": "...", "campos": {...} }.
     * "campos" leva os erros de validação por campo, para a interface destacar.
     */
    public static function erro(string $mensagem, int $status = 400, array $campos = []): never
    {
        $corpo = ['ok' => false, 'erro' => $mensagem];
        if ($campos !== []) {
            $corpo['campos'] = $campos;
        }
        self::json($corpo, $status);
    }

    /** Redireciona o navegador (usado em páginas, não na API). */
    public static function redirecionar(string $url, int $status = 302): never
    {
        if (!headers_sent()) {
            http_response_code($status);
            header('Location: ' . $url);
        }
        exit;
    }
}
