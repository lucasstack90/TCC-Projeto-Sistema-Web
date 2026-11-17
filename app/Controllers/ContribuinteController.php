<?php

namespace Controllers;

use Core\Controller;
use Core\Documento;
use Core\Validator;
use Models\Contribuinte;

/**
 * API REST do cadastro de Contribuintes (doadores frequentes e fornecedores).
 *   GET    /api/contribuintes        index
 *   POST   /api/contribuintes        store
 *   PUT    /api/contribuintes/{id}   update
 *   DELETE /api/contribuintes/{id}   destroy
 *
 * Valida CPF/CNPJ no servidor (dígitos verificadores) e a unicidade do documento.
 */
final class ContribuinteController extends Controller
{
    private Contribuinte $contribuintes;

    public function __construct()
    {
        parent::__construct();
        $this->contribuintes = new Contribuinte();
    }

    public function index(): void
    {
        $this->ok($this->contribuintes->listarParaApi());
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados);
        $id = $this->contribuintes->criar($this->contribuintes->doApi($dados));
        $this->ok($this->contribuintes->paraApi($this->contribuintes->encontrar($id)), 201);
    }

    public function update(string $id): void
    {
        if (!$this->contribuintes->encontrar((int) $id)) {
            $this->erro('Contribuinte não encontrado.', 404);
        }
        $dados = $this->req->todos();
        $this->validar($dados, (int) $id);
        $this->contribuintes->atualizar((int) $id, $this->contribuintes->doApi($dados));
        $this->ok($this->contribuintes->paraApi($this->contribuintes->encontrar((int) $id)));
    }

    public function destroy(string $id): void
    {
        if ($this->contribuintes->remover((int) $id) === 0) {
            $this->erro('Contribuinte não encontrado.', 404);
        }
        $this->ok(['removido' => (int) $id]);
    }

    private function validar(array $dados, ?int $id = null): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('type', 'Tipo')->umDe('type', Contribuinte::TIPOS);
        $v->obrigatorio('name', 'Nome')->texto('name', 2, 120);
        $v->obrigatorio('document', 'Documento');
        $v->email('email')->texto('notes', 0, 1000);

        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }

        // Pelo menos um papel.
        $doador = !empty($dados['donor']);
        $fornecedor = !empty($dados['supplier']);
        if (!$doador && !$fornecedor) {
            $this->erro('Marque doador, fornecedor ou os dois.', 422, [
                'donor' => 'Escolha ao menos um papel.',
            ]);
        }

        // CPF/CNPJ conforme o tipo.
        $pj = ($dados['type'] ?? '') === Contribuinte::PJ;
        $doc = (string) ($dados['document'] ?? '');
        $docOk = $pj ? Documento::cnpjValido($doc) : Documento::cpfValido($doc);
        if (!$docOk) {
            $this->erro('Documento inválido.', 422, [
                'document' => ($pj ? 'CNPJ' : 'CPF') . ' inválido. Confira os números.',
            ]);
        }

        // Consentimento LGPD obrigatório para pessoa física.
        if (!$pj && empty($dados['consent'])) {
            $this->erro('É preciso o consentimento LGPD para cadastrar uma pessoa física.', 422, [
                'consent' => 'Consentimento obrigatório.',
            ]);
        }

        // Documento único.
        if ($this->contribuintes->documentoEmUso($doc, $id)) {
            $this->erro('Este documento já está cadastrado.', 422, [
                'document' => 'Documento já cadastrado.',
            ]);
        }
    }
}
