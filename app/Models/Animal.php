<?php

namespace Models;

use Core\Model;

/**
 * Animais abrigados.
 *
 * As colunas do banco ficam em português (nome, especie, ...). A interface já
 * usa chaves em inglês (name, species, ...), herdadas do protótipo; por isso o
 * model traduz nos dois sentidos (paraApi / doApi). Assim o banco fica limpo e
 * o JavaScript existente quase não muda ao trocar o localStorage pela API.
 */
final class Animal extends Model
{
    protected string $tabela = 'animais';
    protected array $preenchivel = [
        'nome', 'especie', 'raca', 'cor', 'idade', 'data_chegada',
        'sexo', 'porte', 'status', 'foto', 'peso',
        'vacinado', 'castrado', 'microchip', 'observacoes',
    ];

    public const STATUS  = ['Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário'];
    public const ESPECIES = ['Cão', 'Gato', 'Outros'];

    /** chave da API (inglês) => coluna do banco (português) */
    private const MAPA = [
        'name'       => 'nome',
        'species'    => 'especie',
        'breed'      => 'raca',
        'color'      => 'cor',
        'age'        => 'idade',
        'arrival'    => 'data_chegada',
        'sex'        => 'sexo',
        'size'       => 'porte',
        'status'     => 'status',
        'photo'      => 'foto',
        'weight'     => 'peso',
        'vaccinated' => 'vacinado',
        'neutered'   => 'castrado',
        'chip'       => 'microchip',
        'notes'      => 'observacoes',
    ];

    /** Converte uma linha do banco para o formato que a interface espera. */
    public function paraApi(array $linha): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::MAPA as $api => $col) {
            $valor = $linha[$col] ?? null;
            if (in_array($col, ['vacinado', 'castrado', 'microchip'], true)) {
                $valor = (bool) $valor;
            } elseif ($col === 'peso' && $valor !== null) {
                $valor = (float) $valor;
            }
            $out[$api] = $valor;
        }
        return $out;
    }

    /** Converte o corpo vindo da interface para colunas do banco. */
    public function doApi(array $dados): array
    {
        $out = [];
        foreach (self::MAPA as $api => $col) {
            if (!array_key_exists($api, $dados)) {
                continue;
            }
            $valor = $dados[$api];
            if (in_array($col, ['vacinado', 'castrado', 'microchip'], true)) {
                $valor = $valor ? 1 : 0;
            }
            $out[$col] = $valor;
        }
        return $out;
    }

    /** Lista já no formato da interface. */
    public function listarParaApi(): array
    {
        return array_map([$this, 'paraApi'], $this->todos('id DESC'));
    }

    /** Um animal com as coleções relacionadas (vacinas, atendimentos, pesagens). */
    public function comDetalhes(int $id): ?array
    {
        $linha = $this->encontrar($id);
        if (!$linha) {
            return null;
        }
        $animal = $this->paraApi($linha);
        $animal['vaccines'] = $this->relacionados('vacinas', $id, 'data DESC');
        $animal['history']  = $this->relacionados('atendimentos', $id, 'data DESC');
        $animal['weights']  = $this->relacionados('pesagens', $id, 'data DESC');
        return $animal;
    }

    private function relacionados(string $tabela, int $animalId, string $ordem): array
    {
        $stmt = $this->db()->prepare("SELECT * FROM {$tabela} WHERE animal_id = :id ORDER BY {$ordem}");
        $stmt->execute([':id' => $animalId]);
        return $stmt->fetchAll();
    }
}
