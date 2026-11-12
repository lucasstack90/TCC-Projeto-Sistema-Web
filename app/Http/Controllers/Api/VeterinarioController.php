<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\VeterinarioRequest;
use App\Models\LogAuditoria;
use App\Models\Veterinario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Cadastro de veterinários — rotas JSON usadas por public/js/veterinarios.js.
 *
 *  GET    /api/veterinarios        lista (ativos primeiro)
 *  POST   /api/veterinarios        cadastrar
 *  PUT    /api/veterinarios/{id}   editar (também ativa/inativa)
 *  DELETE /api/veterinarios/{id}   excluir — só funcionário e só se nunca foi usado
 */
class VeterinarioController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(Veterinario::listaParaTela());
    }

    public function store(VeterinarioRequest $request): JsonResponse
    {
        $vet = DB::transaction(function () use ($request) {
            $vet = Veterinario::create([...$request->dadosDoBanco(), 'user_id' => $request->user()->id]);
            LogAuditoria::registrar('criar', $vet, "Veterinário {$vet->nome} cadastrado");

            return $vet;
        });

        return response()->json($this->recarregar($vet), 201);
    }

    public function update(VeterinarioRequest $request, Veterinario $veterinario): JsonResponse
    {
        DB::transaction(function () use ($request, $veterinario) {
            $veterinario->update($request->dadosDoBanco());
            LogAuditoria::registrar('alterar', $veterinario, "Cadastro do veterinário {$veterinario->nome} alterado");
        });

        return response()->json($this->recarregar($veterinario));
    }

    public function destroy(Veterinario $veterinario): JsonResponse|Response
    {
        // Quem já aplicou vacina ou atendeu algum animal fica no histórico: só pode ser inativado.
        if ($veterinario->vacinas()->exists() || $veterinario->historicos()->exists()) {
            return response()->json([
                'message' => 'Este veterinário tem vacinas ou atendimentos registrados. Inative o cadastro em vez de excluir.',
            ], 409);
        }

        DB::transaction(function () use ($veterinario) {
            LogAuditoria::registrar('excluir', $veterinario, "Veterinário {$veterinario->nome} excluído");
            $veterinario->delete();
        });

        return response()->noContent();
    }

    private function recarregar(Veterinario $vet): array
    {
        return Veterinario::withCount(['vacinas', 'historicos'])->findOrFail($vet->id)->paraTela();
    }
}
