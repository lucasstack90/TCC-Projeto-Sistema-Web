<?php

namespace Models;

use Core\Model;

/**
 * Registros clínicos da ficha do animal: vacinas, histórico (atendimentos) e
 * pesagens. As três tabelas seguem o mesmo molde, então um model só cuida delas.
 *
 * Auditoria: cada registro guarda quem registrou, quem corrigiu por último e
 * quem removeu. Remover não apaga: o registro some da ficha e fica guardado.
 *
 * Tipos aceitos na URL (/api/animais/{id}/{tipo}): vacinas, historico, pesagens.
 */
final class RegistroClinico extends Model
{
    /** tipo da URL => tabela e colunas que a interface pode gravar (chave da API => coluna) */
    public const TIPOS = [
        'vacinas' => [
            'tabela' => 'vacinas',
            'campos' => [
                'name' => 'nome', 'date' => 'data', 'next' => 'proxima', 'lot' => 'lote',
                'vet' => 'veterinario', 'vetId' => 'veterinario_id',
            ],
        ],
        'historico' => [
            'tabela' => 'atendimentos',
            'campos' => [
                'type' => 'tipo', 'date' => 'data', 'description' => 'descricao',
                'vet' => 'veterinario', 'vetId' => 'veterinario_id', 'notes' => 'observacoes',
            ],
        ],
        'pesagens' => [
            'tabela' => 'pesagens',
            'campos' => ['weight' => 'peso', 'date' => 'data', 'note' => 'nota'],
        ],
    ];

    /** Nome da coleção no JSON do animal (o formato que a interface já usa). */
    private const COLECAO = ['vacinas' => 'vaccines', 'historico' => 'history', 'pesagens' => 'weights'];

    public const TIPOS_DE_EVENTO = ['Consulta', 'Cirurgia', 'Castração', 'Tratamento', 'Exame', 'Banho e Tosa', 'Resgate', 'Adoção', 'Outro'];

    private static function tabela(string $tipo): string
    {
        return self::TIPOS[$tipo]['tabela'];
    }

    /**
     * Registros ativos de vários animais de uma vez:
     * [animalId => ['vaccines' => [...], 'history' => [...], 'weights' => [...]]].
     */
    public function porAnimais(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $saida = [];
        foreach ($ids as $id) {
            $saida[$id] = ['vaccines' => [], 'history' => [], 'weights' => []];
        }
        if ($ids === []) {
            return $saida;
        }
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        foreach (self::TIPOS as $tipo => $def) {
            $sql = "SELECT r.*, ur.nome AS registrado_nome, ua.nome AS atualizado_nome
                      FROM {$def['tabela']} r
                      LEFT JOIN usuarios ur ON ur.id = r.registrado_por
                      LEFT JOIN usuarios ua ON ua.id = r.atualizado_por
                     WHERE r.animal_id IN ({$marcas}) AND r.removido_em IS NULL
                     ORDER BY r.data DESC, r.id DESC";
            $stmt = $this->db()->prepare($sql);
            $stmt->execute($ids);
            foreach ($stmt->fetchAll() as $linha) {
                $saida[(int) $linha['animal_id']][self::COLECAO[$tipo]][] = $this->paraApi($tipo, $linha);
            }
        }
        return $saida;
    }

    /** Linha do banco -> formato da interface (com a auditoria para exibir). */
    private function paraApi(string $tipo, array $linha): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::TIPOS[$tipo]['campos'] as $api => $col) {
            $valor = $linha[$col] ?? null;
            if ($col === 'peso') {
                $valor = (float) $valor;
            } elseif ($col === 'veterinario_id') {
                $valor = $valor === null ? null : (int) $valor;
            } elseif ($valor === null) {
                $valor = '';
            }
            $out[$api] = $valor;
        }
        $out['registeredBy'] = $linha['registrado_nome'] ?? null;
        $out['registeredAt'] = $linha['criado_em'] ?? null;
        $corrigido = !empty($linha['atualizado_por']);
        $out['updatedBy'] = $corrigido ? ($linha['atualizado_nome'] ?? null) : null;
        $out['updatedAt'] = $corrigido ? ($linha['atualizado_em'] ?? null) : null;
        return $out;
    }

    /** Corpo da interface -> colunas do banco (só os campos do tipo). */
    public function doApi(string $tipo, array $dados): array
    {
        $out = [];
        foreach (self::TIPOS[$tipo]['campos'] as $api => $col) {
            if (!array_key_exists($api, $dados)) {
                continue;
            }
            $valor = is_string($dados[$api]) ? trim($dados[$api]) : $dados[$api];
            if ($valor === '' || ($col === 'veterinario_id' && !$valor)) {
                $valor = null;
            }
            $out[$col] = $valor;
        }
        return $out;
    }

    /** Busca um registro ativo do animal. */
    public function encontrarDoAnimal(string $tipo, int $animalId, int $id): ?array
    {
        $tabela = self::tabela($tipo);
        $stmt = $this->db()->prepare(
            "SELECT * FROM {$tabela} WHERE id = :id AND animal_id = :a AND removido_em IS NULL LIMIT 1"
        );
        $stmt->execute([':id' => $id, ':a' => $animalId]);
        return $stmt->fetch() ?: null;
    }

    public function inserir(string $tipo, int $animalId, array $colunas, ?int $usuarioId): int
    {
        $colunas['animal_id'] = $animalId;
        $colunas['registrado_por'] = $usuarioId;
        $nomes = array_keys($colunas);
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            self::tabela($tipo),
            implode(', ', $nomes),
            implode(', ', array_map(fn ($c) => ':' . $c, $nomes))
        );
        $this->db()->prepare($sql)->execute(array_combine(array_map(fn ($c) => ':' . $c, $nomes), $colunas));
        return (int) $this->db()->lastInsertId();
    }

    public function corrigir(string $tipo, int $id, array $colunas, ?int $usuarioId): void
    {
        $colunas['atualizado_por'] = $usuarioId;
        $sets = implode(', ', array_map(fn ($c) => "{$c} = :{$c}", array_keys($colunas)));
        $params = array_combine(array_map(fn ($c) => ':' . $c, array_keys($colunas)), $colunas);
        $params[':chave_id'] = $id;
        $this->db()->prepare('UPDATE ' . self::tabela($tipo) . " SET {$sets} WHERE id = :chave_id")->execute($params);
    }

    /** Remoção lógica: some da ficha, mas fica guardado com quem removeu. */
    public function removerRegistro(string $tipo, int $id, ?int $usuarioId): int
    {
        $stmt = $this->db()->prepare(
            'UPDATE ' . self::tabela($tipo) . ' SET removido_em = NOW(), removido_por = :u WHERE id = :id AND removido_em IS NULL'
        );
        $stmt->execute([':u' => $usuarioId, ':id' => $id]);
        return $stmt->rowCount();
    }
}
