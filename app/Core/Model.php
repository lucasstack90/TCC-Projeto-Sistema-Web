<?php

namespace Core;

use PDO;

/**
 * Model base: dá a cada model o acesso ao PDO e alguns helpers de CRUD
 * para as tabelas simples. Models com regras próprias (Animal, Usuario)
 * escrevem suas consultas; as genéricas ficam aqui para não repetir código.
 *
 * As classes filhas definem:
 *   protected string $tabela      = 'animais';
 *   protected array  $preenchivel = ['nome', 'especie', ...];  // colunas que a API pode gravar
 */
abstract class Model
{
    protected string $tabela = '';
    /** @var string[] colunas que podem ser gravadas via API (proteção contra mass assignment) */
    protected array $preenchivel = [];
    protected string $chave = 'id';

    protected function db(): PDO
    {
        return Database::conexao();
    }

    /** Lista todos os registros (opcionalmente ordenados). */
    public function todos(string $ordem = 'id DESC'): array
    {
        $sql = "SELECT * FROM {$this->tabela} ORDER BY {$ordem}";
        return $this->db()->query($sql)->fetchAll();
    }

    /** Busca um registro pela chave primária. */
    public function encontrar(int|string $id): ?array
    {
        $sql  = "SELECT * FROM {$this->tabela} WHERE {$this->chave} = :id LIMIT 1";
        $stmt = $this->db()->prepare($sql);
        $stmt->execute([':id' => $id]);
        $linha = $stmt->fetch();
        return $linha ?: null;
    }

    /** Insere e devolve o id criado. Só grava as colunas de $preenchivel. */
    public function criar(array $dados): int
    {
        $dados = $this->apenasPreenchiveis($dados);
        $colunas = array_keys($dados);
        $marcadores = array_map(fn ($c) => ':' . $c, $colunas);

        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)',
            $this->tabela,
            implode(', ', $colunas),
            implode(', ', $marcadores)
        );
        $stmt = $this->db()->prepare($sql);
        $stmt->execute($this->comMarcadores($dados));
        return (int) $this->db()->lastInsertId();
    }

    /** Atualiza pelo id. Devolve quantas linhas mudaram. */
    public function atualizar(int|string $id, array $dados): int
    {
        $dados = $this->apenasPreenchiveis($dados);
        if ($dados === []) {
            return 0;
        }
        $sets = implode(', ', array_map(fn ($c) => "$c = :$c", array_keys($dados)));
        $sql  = "UPDATE {$this->tabela} SET {$sets} WHERE {$this->chave} = :chave_id";
        $stmt = $this->db()->prepare($sql);
        $params = $this->comMarcadores($dados);
        $params[':chave_id'] = $id;
        $stmt->execute($params);
        return $stmt->rowCount();
    }

    /** Remove pelo id. Devolve quantas linhas saíram. */
    public function remover(int|string $id): int
    {
        $sql  = "DELETE FROM {$this->tabela} WHERE {$this->chave} = :id";
        $stmt = $this->db()->prepare($sql);
        $stmt->execute([':id' => $id]);
        return $stmt->rowCount();
    }

    /** Filtra o array para conter apenas as colunas liberadas. */
    protected function apenasPreenchiveis(array $dados): array
    {
        if ($this->preenchivel === []) {
            return $dados;
        }
        return array_intersect_key($dados, array_flip($this->preenchivel));
    }

    private function comMarcadores(array $dados): array
    {
        $out = [];
        foreach ($dados as $c => $v) {
            $out[':' . $c] = $v;
        }
        return $out;
    }
}
