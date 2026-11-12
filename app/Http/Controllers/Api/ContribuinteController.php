<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContribuinteRequest;
use App\Models\Contribuinte;
use App\Models\LogAuditoria;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

/**
 * Cadastro de contribuintes do módulo financeiro (doadores frequentes e fornecedores).
 * Rotas JSON usadas por public/js/contribuintes.js — só para o perfil funcionário.
 *
 *  GET    /api/contribuintes        lista
 *  POST   /api/contribuintes        cadastrar
 *  PUT    /api/contribuintes/{id}   editar (também ativa/inativa)
 *  DELETE /api/contribuintes/{id}   excluir = anonimizar (LGPD); lançamentos antigos continuam
 */
class ContribuinteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // Acesso a dados pessoais fica registrado (LGPD, art. 37), sem guardar o conteúdo.
        LogAuditoria::registrar('visualizar', null, 'Lista de contribuintes consultada');

        return response()->json(Contribuinte::listaParaTela());
    }

    public function store(ContribuinteRequest $request): JsonResponse
    {
        $contribuinte = DB::transaction(function () use ($request) {
            $c = Contribuinte::create([...$request->dadosDoBanco(), 'user_id' => $request->user()->id]);
            LogAuditoria::registrar('criar', $c, "Contribuinte #{$c->id} cadastrado ({$c->tipo})");

            return $c;
        });

        return response()->json($contribuinte->fresh()->paraTela(), 201);
    }

    public function update(ContribuinteRequest $request, Contribuinte $contribuinte): JsonResponse
    {
        DB::transaction(function () use ($request, $contribuinte) {
            $contribuinte->update([...$request->dadosDoBanco($contribuinte), 'alterado_por' => $request->user()->id]);
            LogAuditoria::registrar('alterar', $contribuinte, "Contribuinte #{$contribuinte->id} alterado");
        });

        return response()->json($contribuinte->fresh()->paraTela());
    }

    public function destroy(Request $request, Contribuinte $contribuinte): Response
    {
        DB::transaction(function () use ($request, $contribuinte) {
            $contribuinte->anonimizar($request->user()->id);
            $contribuinte->delete(); // exclusão lógica
            LogAuditoria::registrar('excluir', $contribuinte, "Contribuinte #{$contribuinte->id} anonimizado e excluído");
        });

        return response()->noContent();
    }
}
