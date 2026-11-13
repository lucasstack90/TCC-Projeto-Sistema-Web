<?php

namespace Controllers;

use Core\Controller;
use Core\Csrf;
use Core\Session;
use Core\Validator;
use Models\Usuario;

/**
 * Login, logout e dados da sessão atual.
 *
 * O login de verdade acontece aqui (o protótipo só simulava). A senha é
 * conferida contra o hash bcrypt do banco; em caso de erro, a mensagem é
 * genérica de propósito, para não revelar se o e-mail existe.
 */
final class AuthController extends Controller
{
    public function login(): void
    {
        $v = new Validator($this->req->todos());
        $v->obrigatorio('email', 'E-mail')->email('email');
        $v->obrigatorio('senha', 'Senha');
        if ($v->falhou()) {
            $this->erro('Confira o e-mail e a senha.', 422, $v->erros());
        }

        $model   = new Usuario();
        $usuario = $model->porEmail((string) $this->req->input('email'));

        $ok = $usuario
            && (int) ($usuario['ativo'] ?? 0) === 1
            && $model->senhaConfere($usuario, (string) $this->req->input('senha'));

        if (!$ok) {
            // Mensagem única para e-mail inexistente, senha errada ou conta inativa.
            $this->erro('E-mail ou senha incorretos.', 401);
        }

        Session::logar($usuario);
        $this->ok([
            'usuario' => Session::usuario(),
            'csrf'    => Csrf::token(),
        ]);
    }

    public function logout(): void
    {
        Session::destruir();
        $this->ok(['mensagem' => 'Sessão encerrada.']);
    }

    /** A interface usa para saber se ainda está logada e quem é o usuário. */
    public function eu(): void
    {
        if (!Session::logado()) {
            $this->erro('Não autenticado.', 401);
        }
        $this->ok(['usuario' => Session::usuario(), 'csrf' => Csrf::token()]);
    }
}
