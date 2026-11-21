<?php

namespace Core;

/**
 * Controller base. Todos os controllers herdam daqui e ganham acesso rápido
 * à requisição atual e a atalhos de resposta JSON.
 */
abstract class Controller
{
    protected Request $req;

    public function __construct()
    {
        $this->req = App::request();
    }

    /** Resposta de sucesso. */
    protected function ok(mixed $dados = null, int $status = 200): never
    {
        Response::ok($dados, $status);
    }

    /** Resposta de erro. */
    protected function erro(string $msg, int $status = 400, array $campos = []): never
    {
        Response::erro($msg, $status, $campos);
    }

    /** Usuário logado (ou null). */
    protected function usuario(): ?array
    {
        return Session::usuario();
    }
}
