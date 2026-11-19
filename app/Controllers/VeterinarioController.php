<?php

namespace Controllers;

use Core\Controller;
use Core\Validator;
use Models\Veterinario;

/**
 * API REST do cadastro de Veterinários.
 *   GET    /api/veterinarios        index
 *   POST   /api/veterinarios        store
 *   PUT    /api/veterinarios/{id}   update
 *   DELETE /api/veterinarios/{id}   destroy
 */
final class VeterinarioController extends Controller
{
    private Veterinario $vets;

    public function __construct()
    {
        parent::__construct();
        $this->vets = new Veterinario();
    }

    public function index(): void
    {
        $this->ok($this->vets->listarParaApi());
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados);
        $id = $this->vets->criar($this->vets->doApi($dados));
        $this->ok($this->vets->paraApi($this->vets->encontrar($id)), 201);
    }

    public function update(string $id): void
    {
        if (!$this->vets->encontrar((int) $id)) {
            $this->erro('Veterinário não encontrado.', 404);
        }
        $dados = $this->req->todos();
        $this->validar($dados, (int) $id);
        $this->vets->atualizar((int) $id, $this->vets->doApi($dados));
        $this->ok($this->vets->paraApi($this->vets->encontrar((int) $id)));
    }

    public function destroy(string $id): void
    {
        if ($this->vets->remover((int) $id) === 0) {
            $this->erro('Veterinário não encontrado.', 404);
        }
        $this->ok(['removido' => (int) $id]);
    }

    private function validar(array $dados, ?int $id = null): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('name', 'Nome')->texto('name', 3, 120);
        $v->obrigatorio('crmv', 'CRMV')->texto('crmv', 1, 20);
        $v->obrigatorio('crmvUf', 'UF do CRMV')->texto('crmvUf', 2, 2);
        $v->umDe('bond', Veterinario::VINCULOS);
        $v->texto('specialty', 0, 80)->texto('clinic', 0, 120);
        $v->email('email')->texto('notes', 0, 1000);
        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
        // Unicidade do CRMV por UF.
        if (isset($dados['crmv'], $dados['crmvUf'])
            && $this->vets->crmvEmUso((string) $dados['crmv'], (string) $dados['crmvUf'], $id)) {
            $this->erro('Já existe um veterinário com este CRMV nesta UF.', 422, [
                'crmv' => 'CRMV já cadastrado nesta UF.',
            ]);
        }
    }
}
