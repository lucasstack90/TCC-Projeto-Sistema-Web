<?php

use App\Http\Controllers\Api\AnimalController;
use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Rotas do PAWSAFE
|--------------------------------------------------------------------------
| Páginas: views Blade em resources/views (o HTML do protótipo).
| /api/*:  rotas JSON chamadas pelo JavaScript (fetch), protegidas pela mesma
|          sessão do login e pelo token CSRF.
*/

// ---------- Acesso ----------
Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'create'])->name('login');
    Route::post('/login', [AuthController::class, 'store']);
});

// Formulário público de voluntários (único sem login). Proteções previstas em docs/pendencias-backend.md.
Route::view('/voluntario-cadastro', 'voluntario-cadastro')->name('voluntario.cadastro');

// ---------- Área interna (exige login) ----------
Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'destroy'])->name('logout');

    Route::view('/', 'dashboard')->name('dashboard');
    Route::view('/animais', 'animais')->name('animais');
    Route::view('/adocoes', 'adocoes')->name('adocoes');
    Route::view('/resgates', 'resgates')->name('resgates');
    Route::view('/estoque', 'estoque')->name('estoque');

    // Voluntários têm acesso limitado: gestão de equipe, financeiro e relatório são da equipe fixa.
    Route::middleware('perfil:funcionario')->group(function () {
        Route::view('/voluntarios', 'voluntarios')->name('voluntarios');
        Route::view('/doacoes', 'doacoes')->name('doacoes');
        Route::view('/relatorios', 'relatorios')->name('relatorios');
    });

    // ---------- API JSON ----------
    Route::prefix('api')->name('api.')->group(function () {
        Route::get('/animais', [AnimalController::class, 'index'])->name('animais.index');
        Route::post('/animais', [AnimalController::class, 'store'])->name('animais.store');
        // POST (com _method=PUT) porque o PHP só lê arquivos enviados por POST.
        Route::put('/animais/{animal}', [AnimalController::class, 'update'])->name('animais.update');
        Route::delete('/animais/{animal}', [AnimalController::class, 'destroy'])
            ->middleware('perfil:funcionario')->name('animais.destroy');
        Route::post('/animais/{animal}/vacinas', [AnimalController::class, 'storeVacina'])->name('animais.vacinas');
        Route::post('/animais/{animal}/historico', [AnimalController::class, 'storeHistorico'])->name('animais.historico');
        Route::post('/animais/{animal}/pesagens', [AnimalController::class, 'storePesagem'])->name('animais.pesagens');
        Route::patch('/animais/{animal}/status', [AnimalController::class, 'updateStatus'])->name('animais.status');
    });
});

// Endereços antigos do protótipo (index.html, Pages/animais.html...) continuam funcionando.
Route::redirect('/index.html', '/');
Route::get('/Pages/Pg_Login.html', fn () => redirect()->route('login'));
Route::get('/{pagina}.html', fn (string $pagina) => redirect(basename($pagina)))
    ->where('pagina', '(Pages/)?(animais|adocoes|resgates|voluntarios|doacoes|estoque|relatorios|voluntario-cadastro)');
