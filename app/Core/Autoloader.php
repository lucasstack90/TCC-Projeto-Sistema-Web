<?php

namespace Core;

/**
 * Autoloader simples no padrão PSR-4.
 *
 * Substitui o "vendor/autoload.php" do Composer: quando o PHP encontra uma
 * classe como Controllers\AnimalController, este autoloader converte o
 * namespace em caminho de arquivo (app/Controllers/AnimalController.php) e o
 * carrega. Por isso o sistema roda sem "composer install".
 *
 * Mapa de prefixos: namespace raiz => pasta.
 */
final class Autoloader
{
    /** @var array<string,string> */
    private static array $mapa = [];

    /** Registra um prefixo de namespace e a pasta onde suas classes vivem. */
    public static function adicionar(string $prefixo, string $pasta): void
    {
        self::$mapa[trim($prefixo, '\\') . '\\'] = rtrim($pasta, '/\\') . DIRECTORY_SEPARATOR;
    }

    /** Liga o autoloader ao PHP. */
    public static function registrar(): void
    {
        spl_autoload_register([self::class, 'carregar']);
    }

    /** Recebe o nome completo da classe e inclui o arquivo correspondente. */
    public static function carregar(string $classe): void
    {
        foreach (self::$mapa as $prefixo => $pasta) {
            if (!str_starts_with($classe, $prefixo)) {
                continue;
            }
            $relativo = substr($classe, strlen($prefixo));
            $arquivo  = $pasta . str_replace('\\', DIRECTORY_SEPARATOR, $relativo) . '.php';
            if (is_file($arquivo)) {
                require $arquivo;
                return;
            }
        }
    }
}
