<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Libera a rota só para os perfis informados.
 * Uso nas rotas: ->middleware('perfil:funcionario')
 * Os voluntários têm acesso limitado a alguns módulos (artigo, seção 2.1).
 */
class VerificaPerfil
{
    public function handle(Request $request, Closure $next, string ...$perfis): Response
    {
        $user = $request->user();

        if (! $user || ! in_array($user->perfil, $perfis, true)) {
            abort(403, 'Seu perfil não tem permissão para acessar esta área.');
        }

        return $next($request);
    }
}
