<?php

namespace Controllers;

use Core\Controller;
use Core\Csrf;
use Core\Permissoes;
use Core\Session;
use Core\Validator;
use Models\Usuario;

/**
 * Login, logout e dados da sessão atual.
 *
 * O login confere a senha contra o hash bcrypt do banco; em caso de erro, a
 * mensagem é genérica de propósito, para não revelar se o e-mail existe.
 * As respostas trazem o perfil e a lista de permissões (Core\Permissoes), que a
 * interface usa para montar o menu e esconder ações.
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
            && in_array($usuario['perfil'] ?? '', Permissoes::PERFIS, true)
            && $model->senhaConfere($usuario, (string) $this->req->input('senha'));

        if (!$ok) {
            // Mensagem única para e-mail inexistente, senha errada ou conta inativa.
            $this->erro('E-mail ou senha incorretos.', 401);
        }

        Session::logar($usuario);
        $this->ok($this->dadosDaSessao());
    }

    public function logout(): void
    {
        Session::destruir();
        $this->ok(['mensagem' => 'Sessão encerrada.']);
    }

    /**
     * Quem está logado. Relê o usuário no banco: se o perfil mudou ou a conta foi
     * desativada, vale já no próximo carregamento de página.
     */
    public function eu(): void
    {
        $sessao = Session::usuario();
        $atual = $sessao ? (new Usuario())->encontrar((int) $sessao['id']) : null;

        if (!$atual || (int) $atual['ativo'] !== 1) {
            Session::destruir();
            $this->erro('Sessão encerrada. Faça login novamente.', 401);
        }

        Session::atualizarUsuario($atual);
        $this->ok($this->dadosDaSessao());
    }

    private function dadosDaSessao(): array
    {
        $u = Session::usuario();
        return [
            'usuario'    => $u + ['perfilRotulo' => Permissoes::ROTULOS[$u['perfil']] ?? $u['perfil']],
            'permissoes' => Permissoes::doPerfil($u['perfil']),
            'todas'      => Permissoes::TODAS, // a interface marca o que falta (classes "sem-...")
            'csrf'       => Csrf::token(),
        ];
    }
}
