<?php

namespace Models;

use Core\Model;

/**
 * Usuários do sistema (equipe da ONG). O perfil define o que cada um pode fazer.
 * A senha é guardada como hash bcrypt (password_hash), nunca em texto puro.
 */
final class Usuario extends Model
{
    protected string $tabela = 'usuarios';
    protected array $preenchivel = ['nome', 'email', 'senha_hash', 'perfil', 'ativo'];

    public const PERFIS = ['admin', 'equipe'];

    /** Busca por e-mail (usado no login). */
    public function porEmail(string $email): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM usuarios WHERE email = :email LIMIT 1'
        );
        $stmt->execute([':email' => mb_strtolower(trim($email))]);
        return $stmt->fetch() ?: null;
    }

    /** Confere a senha digitada contra o hash salvo. */
    public function senhaConfere(array $usuario, string $senha): bool
    {
        return password_verify($senha, $usuario['senha_hash'] ?? '');
    }

    /** Gera o hash de uma senha nova (cadastro / troca de senha). */
    public static function hash(string $senha): string
    {
        return password_hash($senha, PASSWORD_BCRYPT);
    }
}
