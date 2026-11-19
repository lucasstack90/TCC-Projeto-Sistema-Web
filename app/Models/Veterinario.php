<?php

namespace Models;

use Core\Model;

/**
 * Veterinários (módulo de Animais). Colunas em português; a interface usa
 * chaves em inglês, então o model traduz nos dois sentidos (como Animal).
 */
final class Veterinario extends Model
{
    protected string $tabela = 'veterinarios';
    protected array $preenchivel = [
        'nome', 'crmv', 'crmv_uf', 'vinculo', 'especialidade',
        'clinica', 'telefone', 'email', 'observacoes', 'ativo',
    ];

    public const VINCULOS = ['Equipe da organização', 'Voluntário(a)', 'Clínica parceira', 'Serviço público'];

    private const MAPA = [
        'name'        => 'nome',
        'crmv'        => 'crmv',
        'crmvUf'      => 'crmv_uf',
        'bond'        => 'vinculo',
        'specialty'   => 'especialidade',
        'clinic'      => 'clinica',
        'phone'       => 'telefone',
        'email'       => 'email',
        'notes'       => 'observacoes',
        'active'      => 'ativo',
    ];

    public function paraApi(array $linha): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::MAPA as $api => $col) {
            $valor = $linha[$col] ?? null;
            if ($col === 'ativo') {
                $valor = (bool) $valor;
            }
            $out[$api] = $valor;
        }
        // Rótulo pronto para exibir, ex.: "CRMV-PR 12345".
        $out['registry'] = 'CRMV-' . ($linha['crmv_uf'] ?? '') . ' ' . ($linha['crmv'] ?? '');
        return $out;
    }

    public function doApi(array $dados): array
    {
        $out = [];
        foreach (self::MAPA as $api => $col) {
            if (!array_key_exists($api, $dados)) {
                continue;
            }
            $valor = $dados[$api];
            if ($col === 'ativo') {
                $valor = $valor ? 1 : 0;
            } elseif ($col === 'crmv') {
                $valor = preg_replace('/\D/', '', (string) $valor); // só dígitos
            } elseif ($col === 'crmv_uf') {
                $valor = strtoupper((string) $valor);
            }
            $out[$col] = $valor;
        }
        return $out;
    }

    public function listarParaApi(): array
    {
        return array_map([$this, 'paraApi'], $this->todos('nome ASC'));
    }

    /** Checa se já existe o mesmo CRMV+UF em outro registro (unicidade). */
    public function crmvEmUso(string $crmv, string $uf, ?int $ignorarId = null): bool
    {
        $sql = 'SELECT id FROM veterinarios WHERE crmv = :crmv AND crmv_uf = :uf';
        $params = [':crmv' => preg_replace('/\D/', '', $crmv), ':uf' => strtoupper($uf)];
        if ($ignorarId) {
            $sql .= ' AND id <> :id';
            $params[':id'] = $ignorarId;
        }
        $stmt = $this->db()->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }
}
