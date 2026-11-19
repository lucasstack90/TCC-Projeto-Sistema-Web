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

        return self::$pdo;
    }

    /** Usado só nos testes, para injetar uma conexão (ex.: SQLite em memória). */
    public static function usar(PDO $pdo): void
    {
        self::$pdo = $pdo;
    }
}
