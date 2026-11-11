<?php

namespace App\Http\Controllers;

use App\Models\LogAuditoria;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

/**
 * Login real: a senha digitada é comparada com o hash (bcrypt) guardado no banco.
 * Proteções: limite de 5 tentativas por minuto (por e-mail + IP), troca do ID da sessão
 * após o login (evita sequestro de sessão) e só usuários ativos entram.
 */
class AuthController extends Controller
{
    private const TENTATIVAS = 5;

    public function create(): View
    {
        return view('auth.login');
    }

    public function store(Request $request): RedirectResponse
    {
        $dados = $request->validate([
            'email' => ['required', 'email', 'max:150'],
            'password' => ['required', 'string', 'min:6'],
        ]);

        $chave = Str::lower($dados['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($chave, self::TENTATIVAS)) {
            $segundos = RateLimiter::availableIn($chave);
            throw ValidationException::withMessages([
                'email' => "Muitas tentativas. Tente de novo em {$segundos} segundos.",
            ]);
        }

        $credenciais = [...$dados, 'ativo' => true];

        if (! Auth::attempt($credenciais, $request->boolean('remember'))) {
            RateLimiter::hit($chave, 60);
            throw ValidationException::withMessages([
                'email' => 'E-mail ou senha incorretos.',
            ]);
        }

        RateLimiter::clear($chave);
        $request->session()->regenerate();

        $user = $request->user();
        $user->forceFill(['ultimo_acesso_em' => now()])->save();
        LogAuditoria::registrar('login', $user);

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        LogAuditoria::registrar('logout', $request->user());

        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
