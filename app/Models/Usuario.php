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

    /**
     * Colunas que guardam QUEM fez cada registro (auditoria). Usuário que aparece
     * em alguma delas não pode ser excluído, só desativado: senão o histórico
     * perde o autor (as chaves estrangeiras viram NULL).
     */
    private const AUTORIA = [
        'animais'             => ['excluido_por'],
        'vacinas'             => ['registrado_por', 'atualizado_por', 'removido_por'],
        'atendimentos'        => ['registrado_por', 'atualizado_por', 'removido_por'],
        'pesagens'            => ['registrado_por', 'atualizado_por', 'removido_por'],
        'adotantes'           => ['criado_por', 'atualizado_por', 'excluido_por'],
        'documentos_adotante' => ['enviado_por', 'removido_por'],
    ];

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

    /**
     * Formato seguro para a API: nunca devolve o hash da senha.
     * "registros" = quantos registros do sistema têm este usuário como autor
     * (a interface só mostra "Excluir" quando é 0).
     */
    public function paraApi(array $linha, ?int $registros = null): array
    {
        return [
            'id'          => (int) $linha['id'],
            'nome'        => $linha['nome'],
            'email'       => $linha['email'],
            'perfil'      => $linha['perfil'],
            'perfilRotulo'=> Permissoes::ROTULOS[$linha['perfil']] ?? $linha['perfil'],
            'ativo'       => (bool) $linha['ativo'],
            'registros'   => $registros ?? $this->registrosDe((int) $linha['id']),
        ];
    }

    public function listarParaApi(): array
    {
        $contagem = $this->registrosPorUsuario();
        return array_map(
            fn ($linha) => $this->paraApi($linha, $contagem[(int) $linha['id']] ?? 0),
            $this->todos('nome ASC')
        );
    }

    /** Quantos registros têm o usuário como autor (0 = pode ser excluído). */
    public function registrosDe(int $id): int
    {
        [$sql, $params] = $this->consultaDeAutoria($id);
        $stmt = $this->db()->prepare("SELECT COUNT(*) FROM ({$sql}) AS autoria");
        $stmt->execute($params);
        return (int) $stmt->fetchColumn();
    }

    /** @return array<int,int> id do usuário => quantidade de registros (uma consulta só). */
    public function registrosPorUsuario(): array
    {
        [$sql] = $this->consultaDeAutoria(null);
        $linhas = $this->db()->query(
            "SELECT usuario, COUNT(*) AS total FROM ({$sql}) AS autoria GROUP BY usuario"
        )->fetchAll();
        $mapa = [];
        foreach ($linhas as $l) {
            $mapa[(int) $l['usuario']] = (int) $l['total'];
        }
        return $mapa;
    }

    /**
     * Junta (UNION ALL) todas as colunas de autoria numa lista de ids.
     * Com $id, filtra só esse usuário (cada parte com o seu marcador, porque o
     * PDO sem emulação não repete marcadores com o mesmo nome).
     */
    private function consultaDeAutoria(?int $id): array
    {
        $partes = [];
        $params = [];
        foreach (self::AUTORIA as $tabela => $colunas) {
            foreach ($colunas as $coluna) {
                $filtro = "{$coluna} IS NOT NULL";
                if ($id !== null) {
                    $marcador = ':u' . count($params);
                    $filtro = "{$coluna} = {$marcador}";
                    $params[$marcador] = $id;
                }
                $partes[] = "SELECT {$coluna} AS usuario FROM {$tabela} WHERE {$filtro}";
            }
        }
        return [implode(' UNION ALL ', $partes), $params];
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
