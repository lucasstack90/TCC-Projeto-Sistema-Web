<?php

namespace Core;

use Throwable;

/**
 * Inicializa e roda a aplicação.
 *
 * Fluxo: carrega config -> fuso -> sessão -> captura a requisição ->
 * carrega as rotas (routes/web.php) -> despacha. Erros viram resposta JSON.
 */
final class App
{
    private static ?Request $request = null;
    private static string $raiz = '';

    public static function raiz(): string { return self::$raiz; }
    public static function request(): Request { return self::$request; }

    public static function iniciar(string $raizDoProjeto): void
    {
        self::$raiz = rtrim($raizDoProjeto, '/\\');

        Config::carregar(self::$raiz . '/config/config.php');
        date_default_timezone_set(Config::get('app.fuso', 'America/Sao_Paulo'));
        self::configurarErros();

        Session::iniciar();
        self::$request = Request::capturar();

        $router = new Router();
        (require self::$raiz . '/routes/web.php')($router);

        try {
            $router->despachar(self::$request);
        } catch (Throwable $e) {
            self::tratarExcecao($e);
        }
    }

    private static function configurarErros(): void
    {
        $dev = Config::get('app.ambiente') === 'dev';
        error_reporting(E_ALL);
        ini_set('display_errors', $dev ? '1' : '0');
        ini_set('log_errors', '1');
        ini_set('error_log', self::$raiz . '/storage/logs/php.log');
    }

    private static function tratarExcecao(Throwable $e): void
    {
        error_log('[PAWSAFE] ' . $e->getMessage() . ' em ' . $e->getFile() . ':' . $e->getLine());
        $dev = Config::get('app.ambiente') === 'dev';
        $msg = $dev
            ? $e->getMessage()
            : 'Ocorreu um erro interno. Tente novamente mais tarde.';
        Response::erro($msg, 500);
    }
}
