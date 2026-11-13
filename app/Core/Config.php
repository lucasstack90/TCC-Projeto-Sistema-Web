<?php

namespace Core;

use RuntimeException;

/**
 * Acesso à configuração (config/config.php).
 *
 * Config::get('banco')        -> todo o bloco "banco"
 * Config::get('banco.host')   -> um valor dentro do bloco (notação por ponto)
 */
final class Config
{
    /** @var array<string,mixed> */
    private static array $dados = [];

    public static function carregar(string $arquivo): void
    {
        if (!is_file($arquivo)) {
            throw new RuntimeException('Arquivo de configuração não encontrado: ' . $arquivo);
        }
        self::$dados = require $arquivo;
    }

    public static function get(string $chave, mixed $padrao = null): mixed
    {
        $atual = self::$dados;
        foreach (explode('.', $chave) as $parte) {
            if (!is_array($atual) || !array_key_exists($parte, $atual)) {
                return $padrao;
            }
            $atual = $atual[$parte];
        }
        return $atual;
    }
}
