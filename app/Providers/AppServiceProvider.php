<?php

namespace App\Providers;

use App\Models\Animal;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Em desenvolvimento, avisa quando uma consulta é feita dentro de um laço (N+1),
        // o que deixaria as páginas lentas (requisito: carregar em cerca de 2 segundos).
        Model::preventLazyLoading(! $this->app->isProduction());

        // Dados que toda página interna entrega ao JavaScript em window.PAWSAFE.
        // Os módulos ainda não integrados continuam no localStorage; os animais já vêm do MySQL.
        View::composer('layouts.app', function ($view) {
            $user = Auth::user();
            if (! $user) {
                return;
            }

            $view->with('pawsafe', [
                'baseUrl' => url('/'),
                'csrf' => csrf_token(),
                'user' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'perfil' => $user->perfil,
                    'perfilLabel' => $user->perfilLabel(),
                ],
                'animais' => Animal::listaParaTela(),
            ]);
        });
    }
}
