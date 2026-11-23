<?php

namespace Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Conexão única com o MySQL (PDO).
 *
 * Mantém uma só conexão por requisição (padrão singleton). Sempre use consultas
 * preparadas (os métodos abaixo já fazem isso) para evitar SQL injection.
 */
final class Database
{
    private static ?PDO $pdo = null;

    /** Devolve a conexão PDO, criando-a na primeira chamada. */
    public static function conexao(): PDO
    {
        if (self::$pdo instanceof PDO) {
            return self::$pdo;
        }

        $cfg = Config::get('banco');
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $cfg['host'],
            $cfg['porta'],
            $cfg['nome'],
            $cfg['charset']
        );

        try {
            self::$pdo = new PDO($dsn, $cfg['usuario'], $cfg['senha'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            throw new RuntimeException(
                'Não foi possível conectar ao banco. Confira se o MySQL do XAMPP '
                . 'está ligado e se o banco "' . $cfg['nome'] . '" foi criado '
                . '(rode database/schema.sql).',
                0,
                $e
            );
        }

        // Respostas de erro (Response::erro) encerram o script com exit, sem passar
        // pelo commit. Se uma transação ficou aberta, ela é desfeita aqui, para
        // nunca gravar só metade de uma operação.
        register_shutdown_function([self::class, 'desfazerPendente']);

        return self::$pdo;
    }

    /**
     * Executa $operacao numa transação: grava tudo ou nada. Se a operação
     * encerrar com erro (exceção ou resposta de erro), nada é gravado.
     */
    public static function transacao(callable $operacao): mixed
    {
        $db = self::conexao();
        $db->beginTransaction();
        try {
            $resultado = $operacao();
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            throw $e;
        }
        $db->commit();
        return $resultado;
    }

    /** Desfaz uma transação que ficou aberta no fim da requisição. */
    public static function desfazerPendente(): void
    {
        if (self::$pdo instanceof PDO && self::$pdo->inTransaction()) {
            self::$pdo->rollBack();
        }
    }

    /** Usado só nos testes, para injetar uma conexão (ex.: SQLite em memória). */
    public static function usar(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}
