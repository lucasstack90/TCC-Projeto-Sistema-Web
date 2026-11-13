<?php

namespace Core;

/**
 * Sessão do usuário logado.
 *
 * Guarda o id, o nome e o perfil de quem entrou. O login é validado em
 * AuthController; aqui ficam só os utilitários de ler/gravar a sessão.
 */
final class Session
{
    public static function iniciar(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        $nome = Config::get('sessao.nome', 'pawsafe_sessao');
        session_name($nome);
        session_set_cookie_params([
            'httponly' => true,   // o cookie não fica acessível pelo JavaScript
            'samesite' => 'Lax',
            'secure'   => false,  // em produção com HTTPS, troque para true
        ]);
        session_start();
        self::checarExpiracao();
    }

    /** Expira a sessão após o tempo de inatividade configurado. */
    private static function checarExpiracao(): void
    {
        $limite = (int) Config::get('sessao.tempo_minutos', 120) * 60;
        $agora  = time();
        if (isset($_SESSION['ultimo_acesso']) && ($agora - $_SESSION['ultimo_acesso']) > $limite) {
            self::destruir();
            session_start();
        }
        $_SESSION['ultimo_acesso'] = $agora;
    }

    public static function set(string $chave, mixed $valor): void
    {
        $_SESSION[$chave] = $valor;
    }

    public static function get(string $chave, mixed $padrao = null): mixed
    {
        return $_SESSION[$chave] ?? $padrao;
    }

    /** Grava o usuário autenticado (chamado após o login dar certo). */
    public static function logar(array $usuario): void
    {
        session_regenerate_id(true); // evita fixação de sessão
        $_SESSION['usuario'] = [
            'id'     => $usuario['id'],
            'nome'   => $usuario['nome'],
            'email'  => $usuario['email'],
            'perfil' => $usuario['perfil'],
        ];
    }

    public static function usuario(): ?array
    {
        return $_SESSION['usuario'] ?? null;
    }

    public static function logado(): bool
    {
        return isset($_SESSION['usuario']);
    }

    public static function destruir(): void
    {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
        }
        session_destroy();
    }
}
