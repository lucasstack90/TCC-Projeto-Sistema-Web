<?php

namespace Core\Middleware;

use Core\Request;

/**
 * Contrato dos middlewares. Um middleware roda antes do controller e pode
 * barrar a requisição (ex.: sem login) respondendo e encerrando.
 */
interface Middleware
{
    public function tratar(Request $req): void;
}
