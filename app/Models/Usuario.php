<?php

namespace Models;

use Core\Model;
use Core\Permissoes;

/**
 * Usuários do sistema. O perfil (administrador, equipe, veterinario, voluntario) define o
 * que cada um pode fazer — ver Core\Permissoes.
 * A senha é guardada como hash bcrypt (password_hash), nunca em texto puro.
 */
final class Usuario extends Model
{
    protected string $tabela = 'usuarios';
    protected array $preenchivel = ['nome', 'email', 'senha_hash', 'perfil', 'ativo'];

    public const PERFIS = Permissoes::PERFIS;

    /** Busca por e-mail (usado no login). */
    public function porEmail(string $email): ?array
    {
        $stmt = $this->db()->prepare('SELECT * FROM usuarios WHERE email = :email LIMIT 1');
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

    /** Formato seguro para a API: nunca devolve o hash da senha. */
    public function paraApi(array $linha): array
    {
        return [
            'id'          => (int) $linha['id'],
            'nome'        => $linha['nome'],
            'email'       => $linha['email'],
            'perfil'      => $linha['perfil'],
            'perfilRotulo'=> Permissoes::ROTULOS[$linha['perfil']] ?? $linha['perfil'],
            'ativo'       => (bool) $linha['ativo'],
        ];
    }

    public function listarParaApi(): array
    {
        return array_map([$this, 'paraApi'], $this->todos('nome ASC'));
    }

    public function emailEmUso(string $email, ?int $ignorarId = null): bool
    {
        $sql = 'SELECT id FROM usuarios WHERE email = :email';
        $params = [':email' => mb_strtolower(trim($email))];
        if ($ignorarId) {
            $sql .= ' AND id <> :id';
            $params[':id'] = $ignorarId;
        }
        $stmt = $this->db()->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }

    /** Quantos administradores ativos existem (para não ficar sem nenhum). */
    public function administradoresAtivos(?int $ignorarId = null): int
    {
        $sql = "SELECT COUNT(*) FROM usuarios WHERE perfil = 'administrador' AND ativo = 1";
        $params = [];
        if ($ignorarId) {
            $sql .= ' AND id <> :id';
            $params[':id'] = $ignorarId;
        }
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }
}
