<?php

namespace Controllers;

use Core\Controller;
use Core\Csrf;

/**
 * Rotas utilitárias da API.
 */
final class MetaController extends Controller
{
    /** Devolve o token CSRF para a interface usar nas gravações. */
    public function csrf(): void
    {
        $this->ok(['csrf' => Csrf::token()]);
    }

    /** Teste simples de "o back-end está no ar?". */
    public function ping(): void
    {
        $this->ok(['pong' => true, 'hora' => date('c')]);
    }
}
