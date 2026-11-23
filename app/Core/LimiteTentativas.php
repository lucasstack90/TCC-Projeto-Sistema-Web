<?php

namespace Core;

/**
 * Limite de tentativas de login (proteção contra adivinhação de senha).
 *
 * Conta os erros de senha por IP + e-mail. Depois de MAXIMO erros dentro de
 * JANELA segundos, aquele e-mail fica bloqueado naquele IP até a janela passar.
 * Um login certo zera a contagem. Quem digita a senha certa nunca é afetado.
 *
 * Os contadores ficam em arquivos pequenos em storage/tentativas/ (pasta que o
 * navegador não alcança), assim não é preciso mudar o banco de dados.
 */
final class LimiteTentativas
{
    public const MAXIMO = 5;
    public const JANELA = 15 * 60; // 15 minutos

    /** Segundos que faltam para liberar (0 = liberado). */
    public static function segundosBloqueado(string $email): int
    {
        $registro = self::ler($email);
        if ($registro['erros'] < self::MAXIMO) {
            return 0;
        }
        return max(0, $registro['inicio'] + self::JANELA - time());
    }

    /** Conta mais um erro de senha. */
    public static function registrarErro(string $email): void
    {
        $registro = self::ler($email);
        $registro['erros']++;
        self::gravar($email, $registro);
    }

    /** Login certo: zera a contagem. */
    public static function limpar(string $email): void
    {
        $arquivo = self::arquivo($email);
        if (is_file($arquivo)) {
            @unlink($arquivo);
        }
    }

    /** @return array{erros:int,inicio:int} */
    private static function ler(string $email): array
    {
        $vazio = ['erros' => 0, 'inicio' => time()];
        $arquivo = self::arquivo($email);
        if (!is_file($arquivo)) {
            return $vazio;
        }
        $dados = json_decode((string) @file_get_contents($arquivo), true);
        if (!is_array($dados) || !isset($dados['erros'], $dados['inicio'])) {
            return $vazio;
        }
        // Janela vencida: começa a contar de novo.
        if ((int) $dados['inicio'] + self::JANELA <= time()) {
            return $vazio;
        }
        return ['erros' => (int) $dados['erros'], 'inicio' => (int) $dados['inicio']];
    }

    private static function gravar(string $email, array $registro): void
    {
        $pasta = dirname(self::arquivo($email));
        if (!is_dir($pasta) && !@mkdir($pasta, 0775, true) && !is_dir($pasta)) {
            return; // sem pasta para gravar: não impede o login
        }
        @file_put_contents(self::arquivo($email), json_encode($registro), LOCK_EX);
    }

    /** Um arquivo por IP + e-mail; o nome é um hash (não guarda o e-mail em texto). */
    private static function arquivo(string $email): string
    {
        $ip = $_SERVER['REMOTE_ADDR'] ?? 'desconhecido';
        $chave = hash('sha256', $ip . '|' . mb_strtolower(trim($email)));
        return App::raiz() . '/storage/tentativas/' . $chave . '.json';
    }
}
