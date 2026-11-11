<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\AnimalRequest;
use App\Models\Animal;
use App\Models\AnimalHistorico;
use App\Models\LogAuditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Módulo de Animais — rotas JSON usadas por public/js/animais.js.
 *
 *  GET    /api/animais                 lista completa (com vacinas, histórico e pesagens)
 *  POST   /api/animais                 cadastrar (multipart, por causa da foto)
 *  POST   /api/animais/{id}            editar (multipart com _method=PUT)
 *  DELETE /api/animais/{id}            excluir (só funcionário; exclusão lógica)
 *  POST   /api/animais/{id}/vacinas    registrar vacina
 *  POST   /api/animais/{id}/historico  registrar evento no histórico
 *  POST   /api/animais/{id}/pesagens   registrar pesagem
 *  PATCH  /api/animais/{id}/status     mudar status (usado pelo módulo de Adoções)
 *
 * Toda gravação acontece dentro de uma transação: ou salva tudo, ou nada.
 */
class AnimalController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Animal::listaParaTela());
    }

    public function store(AnimalRequest $request): JsonResponse
    {
        $animal = DB::transaction(function () use ($request) {
            $dados = $request->dadosDoBanco();
            $userId = $request->user()->id;

            if ($request->hasFile('photo')) {
                $dados['foto'] = $request->file('photo')->store('animais', 'public');
            }

            $animal = Animal::create([...$dados, 'user_id' => $userId]);

            $animal->historicos()->create([
                'tipo' => 'Cadastro',
                'data' => now()->toDateString(),
                'descricao' => 'Animal cadastrado no sistema',
                'responsavel' => $request->user()->name,
                'user_id' => $userId,
            ]);

            if ($animal->peso !== null) {
                $animal->pesagens()->create([
                    'peso' => $animal->peso,
                    'data' => $animal->data_chegada,
                    'observacao' => 'Peso inicial',
                    'user_id' => $userId,
                ]);
            }

            // Animal vindo de uma ocorrência: o resgate entra no histórico dele.
            if ($rescue = $request->validated('rescue')) {
                $animal->historicos()->create([
                    'tipo' => 'Resgate',
                    'data' => $rescue['date'],
                    'descricao' => trim('Resgate '.$rescue['code'].' — '.($rescue['district'] ?? ''), ' —'),
                    'responsavel' => $rescue['responsible'] ?? null,
                    'notas' => $rescue['description'] ?? null,
                    'user_id' => $userId,
                ]);
            }

            LogAuditoria::registrar('criar', $animal, "Animal {$animal->nome} cadastrado");

            return $animal;
        });

        return response()->json($this->recarregar($animal), 201);
    }

    public function update(AnimalRequest $request, Animal $animal): JsonResponse
    {
        DB::transaction(function () use ($request, $animal) {
            $dados = $request->dadosDoBanco();
            $pesoAnterior = $animal->peso !== null ? (float) $animal->peso : null;

            if ($request->hasFile('photo')) {
                $animal->apagarArquivoDaFoto();
                $dados['foto'] = $request->file('photo')->store('animais', 'public');
            } elseif ($request->boolean('remove_photo')) {
                $animal->apagarArquivoDaFoto();
                $dados['foto'] = null;
            }

            $animal->update($dados);

            // Peso mudou na ficha: guarda na linha do tempo de pesagens.
            if ($dados['peso'] !== null && (float) $dados['peso'] !== $pesoAnterior) {
                $animal->pesagens()->create([
                    'peso' => $dados['peso'],
                    'data' => now()->toDateString(),
                    'observacao' => 'Peso atualizado na ficha',
                    'user_id' => $request->user()->id,
                ]);
            }

            LogAuditoria::registrar('alterar', $animal, "Ficha de {$animal->nome} alterada");
        });

        return response()->json($this->recarregar($animal));
    }

    public function destroy(Request $request, Animal $animal): Response
    {
        // Exclusão lógica (softDeletes): processos de adoção e despesas antigas continuam válidos.
        DB::transaction(function () use ($animal) {
            $animal->delete();
            LogAuditoria::registrar('excluir', $animal, "Animal {$animal->nome} excluído");
        });

        return response()->noContent();
    }

    public function storeVacina(Request $request, Animal $animal): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'next' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date'],
            'lot' => ['nullable', 'string', 'max:40'],
            'vet' => ['nullable', 'string', 'max:120'],
        ], [], ['name' => 'vacina', 'date' => 'data', 'next' => 'próxima dose', 'lot' => 'lote', 'vet' => 'veterinário']);

        DB::transaction(function () use ($animal, $v, $request) {
            $animal->vacinas()->create([
                'nome' => trim($v['name']),
                'data_aplicacao' => $v['date'],
                'proxima_dose' => $v['next'] ?? null,
                'lote' => $v['lot'] ?? null,
                'veterinario' => $v['vet'] ?? null,
                'user_id' => $request->user()->id,
            ]);
            $animal->update(['vacinado' => true]);
        });

        return response()->json($this->recarregar($animal), 201);
    }

    public function storeHistorico(Request $request, Animal $animal): JsonResponse
    {
        $v = $request->validate([
            'type' => ['required', Rule::in(AnimalHistorico::TIPOS)],
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'description' => ['required', 'string', 'max:200'],
            'vet' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ], [], ['type' => 'tipo de evento', 'date' => 'data', 'description' => 'descrição', 'vet' => 'responsável', 'notes' => 'notas']);

        $animal->historicos()->create([
            'tipo' => $v['type'],
            'data' => $v['date'],
            'descricao' => trim($v['description']),
            'responsavel' => $v['vet'] ?? null,
            'notas' => $v['notes'] ?? null,
            'user_id' => $request->user()->id,
        ]);

        return response()->json($this->recarregar($animal), 201);
    }

    public function storePesagem(Request $request, Animal $animal): JsonResponse
    {
        $v = $request->validate([
            'weight' => ['required', 'numeric', 'min:0.01', 'max:999.99'],
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'note' => ['nullable', 'string', 'max:150'],
        ], [], ['weight' => 'peso', 'date' => 'data', 'note' => 'observação']);

        DB::transaction(function () use ($animal, $v, $request) {
            $animal->pesagens()->create([
                'peso' => $v['weight'],
                'data' => $v['date'],
                'observacao' => $v['note'] ?? 'Pesagem registrada',
                'user_id' => $request->user()->id,
            ]);
            $animal->update(['peso' => $v['weight']]);
        });

        return response()->json($this->recarregar($animal), 201);
    }

    /**
     * Troca só o status (e, opcionalmente, registra o motivo no histórico).
     * Ponte com o módulo de Adoções enquanto ele ainda usa o localStorage:
     * ao concluir uma adoção, o animal passa para "Adotado" aqui no banco.
     */
    public function updateStatus(Request $request, Animal $animal): JsonResponse
    {
        $v = $request->validate([
            'status' => ['required', Rule::in(Animal::STATUS)],
            'history' => ['nullable', 'array'],
            'history.type' => ['required_with:history', Rule::in(AnimalHistorico::TIPOS)],
            'history.date' => ['required_with:history', 'date_format:Y-m-d'],
            'history.description' => ['required_with:history', 'string', 'max:200'],
            'history.vet' => ['nullable', 'string', 'max:120'],
            'history.notes' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($animal, $v, $request) {
            $animal->update(['status' => $v['status']]);

            if (! empty($v['history'])) {
                $animal->historicos()->create([
                    'tipo' => $v['history']['type'],
                    'data' => $v['history']['date'],
                    'descricao' => $v['history']['description'],
                    'responsavel' => $v['history']['vet'] ?? null,
                    'notas' => $v['history']['notes'] ?? null,
                    'user_id' => $request->user()->id,
                ]);
            }

            LogAuditoria::registrar('alterar', $animal, "Status de {$animal->nome}: {$v['status']}");
        });

        return response()->json($this->recarregar($animal));
    }

    /** Busca de novo o animal com as listas da ficha, já no formato do front-end. */
    private function recarregar(Animal $animal): array
    {
        return $animal->fresh(['vacinas', 'historicos', 'pesagens'])->paraTela();
    }
}
