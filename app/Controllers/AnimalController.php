<?php

namespace Controllers;

use Core\Controller;
use Core\Validator;
use Models\Animal;

/**
 * API REST do módulo de Animais — o módulo de referência do sistema.
 * Os demais módulos (adoções, resgates, voluntários, doações, estoque)
 * seguem exatamente este molde: index / show / store / update / destroy.
 *
 * Rotas (ver routes/web.php):
 *   GET    /api/animais        -> index   (lista)
 *   GET    /api/animais/{id}   -> show     (um, com vacinas/atendimentos/pesagens)
 *   POST   /api/animais        -> store    (cria)
 *   PUT    /api/animais/{id}   -> update   (edita)
 *   DELETE /api/animais/{id}   -> destroy  (remove)
 */
final class AnimalController extends Controller
{
    private Animal $animais;

    public function __construct()
    {
        parent::__construct();
        $this->animais = new Animal();
    }

    public function index(): void
    {
        $this->ok($this->animais->listarParaApi());
    }

    public function show(string $id): void
    {
        $animal = $this->animais->comDetalhes((int) $id);
        if (!$animal) {
            $this->erro('Animal não encontrado.', 404);
        }
        $this->ok($animal);
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados);
        $id = $this->animais->criar($this->animais->doApi($dados));
        $this->ok($this->animais->comDetalhes($id), 201);
    }

    public function update(string $id): void
    {
        if (!$this->animais->encontrar((int) $id)) {
            $this->erro('Animal não encontrado.', 404);
        }
        $dados = $this->req->todos();
        $this->validar($dados);
        $this->animais->atualizar((int) $id, $this->animais->doApi($dados));
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    public function destroy(string $id): void
    {
        $removidos = $this->animais->remover((int) $id);
        if ($removidos === 0) {
            $this->erro('Animal não encontrado.', 404);
        }
        $this->ok(['removido' => (int) $id]);
    }

    /**
     * Regras de validação do servidor (antes gravadas só no JavaScript).
     * Encerra a requisição com 422 se algo estiver errado.
     */
    private function validar(array $dados): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('name', 'Nome')->texto('name', 2, 80);
        $v->obrigatorio('species', 'Espécie')->umDe('species', Animal::ESPECIES);
        $v->obrigatorio('status', 'Status')->umDe('status', Animal::STATUS);
        $v->texto('breed', 0, 80)->texto('color', 0, 60)->texto('age', 0, 40);
        $v->umDe('sex', ['Macho', 'Fêmea']);
        $v->umDe('size', ['Pequeno', 'Médio', 'Grande']);
        $v->data('arrival', naoFutura: true);
        $v->numero('weight', 0, 200);
        $v->texto('notes', 0, 1000);

        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
    }
}
