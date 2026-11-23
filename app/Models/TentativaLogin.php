<?php

namespace Models;

use Core\Model;
use PDOException;

/**
 * Tentativas de login com senha errada (tabela tentativas_login).
 *
 * Proteção contra adivinhação de senha: depois de MAXIMO erros dentro de
 * JANELA segundos, aquele e-mail fica bloqueado naquele IP até a janela
 * passar. Um login certo zera a contagem; quem acerta a senha nunca é afetado.
 *
 * A chave da linha é o sha256 de IP + e-mail, então a tabela não guarda dados
 * pessoais em texto. As contas de tempo usam o relógio do MySQL (NOW()).
 *
 * Se a tabela ainda não existir (banco criado antes desta versão, sem importar
 * o schema.sql de novo), o limite fica desligado e o login segue normal.
 */
final class TentativaLogin extends Model
{
    public const MAXIMO = 5;
    public const JANELA = 15 * 60; // 15 minutos

    protected string $tabela = 'tentativas_login';
    protected string $chave = 'chave';

    /** Segundos que faltam para liberar (0 = liberado). */
    public function segundosBloqueado(string $ip, string $email): int
    {
        try {
            $stmt = $this->db()->prepare(
                'SELECT erros, TIMESTAMPDIFF(SECOND, NOW(), inicio + INTERVAL :janela SECOND) AS resta
                   FROM tentativas_login WHERE chave = :chave LIMIT 1'
            );
            $stmt->execute([':janela' => self::JANELA, ':chave' => $this->chaveDe($ip, $email)]);
            $linha = $stmt->fetch();
        } catch (PDOException $e) {
            $this->avisar($e);
            return 0;
        }
        if (!$linha || (int) $linha['erros'] < self::MAXIMO) {
            return 0;
        }
        return max(0, (int) $linha['resta']);
    }

    /** Conta mais um erro de senha (janela vencida recomeça a contagem). */
    public function registrarErro(string $ip, string $email): void
    {
        try {
            // As atribuições do UPDATE rodam em ordem: "erros" ainda enxerga o "inicio" antigo.
            $stmt = $this->db()->prepare(
                'INSERT INTO tentativas_login (chave, erros, inicio) VALUES (:chave, 1, NOW())
                 ON DUPLICATE KEY UPDATE
                    erros  = IF(inicio <= NOW() - INTERVAL :janela1 SECOND, 1, erros + 1),
                    inicio = IF(inicio <= NOW() - INTERVAL :janela2 SECOND, NOW(), inicio)'
            );
            $stmt->execute([
                ':chave'   => $this->chaveDe($ip, $email),
                ':janela1' => self::JANELA,
                ':janela2' => self::JANELA,
            ]);
            // Faxina: linhas de mais de um dia não servem para nada.
            $this->db()->exec('DELETE FROM tentativas_login WHERE inicio < NOW() - INTERVAL 1 DAY');
        } catch (PDOException $e) {
            $this->avisar($e);
        }
    }

    /** Login certo: zera a contagem. */
    public function limpar(string $ip, string $email): void
    {
        try {
            $this->remover($this->chaveDe($ip, $email));
        } catch (PDOException $e) {
            $this->avisar($e);
        }
    }

    private function chaveDe(string $ip, string $email): string
    {
        return hash('sha256', $ip . '|' . mb_strtolower(trim($email)));
    }

    private function avisar(PDOException $e): void
    {
        error_log('[PAWSAFE] Limite de login desligado (importe database/schema.sql de novo): ' . $e->getMessage());
    }
}
