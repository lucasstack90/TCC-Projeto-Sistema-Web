<?php

namespace Core;

use RuntimeException;

/**
 * Roteador: liga um método HTTP + caminho a um controller.
 *
 * Exemplo:
 *   $router->get('/api/animais', [AnimalController::class, 'index']);
 *   $router->get('/api/animais/{id}', [AnimalController::class, 'show']);
 *
 * Partes entre chaves ({id}) viram argumentos passados ao método do controller.
 */
final class Router
{
    /** @var array<int,array{metodo:string,regex:string,parametros:string[],acao:callable|array,middlewares:string[]}> */
    private array $rotas = [];

    /** @var string[] middlewares aplicados a tudo que for registrado dentro de um grupo */
    private array $grupoMiddlewares = [];

    public function get(string $caminho, array|callable $acao, array $mw = []): void    { $this->adicionar('GET', $caminho, $acao, $mw); }
    public function post(string $caminho, array|callable $acao, array $mw = []): void   { $this->adicionar('POST', $caminho, $acao, $mw); }
    public function put(string $caminho, array|callable $acao, array $mw = []): void    { $this->adicionar('PUT', $caminho, $acao, $mw); }
    public function patch(string $caminho, array|callable $acao, array $mw = []): void  { $this->adicionar('PATCH', $caminho, $acao, $mw); }
    public function delete(string $caminho, array|callable $acao, array $mw = []): void { $this->adicionar('DELETE', $caminho, $acao, $mw); }

    /** Aplica os mesmos middlewares a um conjunto de rotas. */
    public function grupo(array $middlewares, callable $definir): void
    {
        $anterior = $this->grupoMiddlewares;
        $this->grupoMiddlewares = array_merge($anterior, $middlewares);
        $definir($this);
        $this->grupoMiddlewares = $anterior;
    }

    private function adicionar(string $metodo, string $caminho, array|callable $acao, array $mw): void
    {
        $parametros = [];
        $regex = preg_replace_callback('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', function ($m) use (&$parametros) {
            $parametros[] = $m[1];
            return '([^/]+)';
        }, '/' . trim($caminho, '/'));

        $this->rotas[] = [
            'metodo'      => $metodo,
            'regex'       => '#^' . $regex . '$#',
            'parametros'  => $parametros,
            'acao'        => $acao,
            'middlewares' => array_merge($this->grupoMiddlewares, $mw),
        ];
    }

    /** Encontra a rota que casa com a requisição e a executa. */
    public function despachar(Request $req): void
    {
        $caminho = '/' . trim($req->caminho(), '/');
        $houveCaminho = false;

        foreach ($this->rotas as $rota) {
            if (!preg_match($rota['regex'], $caminho, $m)) {
                continue;
            }
            $houveCaminho = true;
            if ($rota['metodo'] !== $req->metodo()) {
                continue;
            }

            // Middlewares (ex.: exigir login) rodam antes do controller.
            // Um middleware pode vir com parâmetros: [ExigirPermissao::class, 'animais.cadastrar'].
            foreach ($rota['middlewares'] as $mw) {
                $instancia = is_array($mw) ? new $mw[0](...array_slice($mw, 1)) : new $mw();
                $instancia->tratar($req);
            }

            array_shift($m); // remove o match completo, sobram os parâmetros
            $this->executar($rota['acao'], $m);
            return;
        }

        // Caminho existe mas com outro método -> 405; senão -> 404.
        if ($houveCaminho) {
            Response::erro('Método não permitido para esta rota.', 405);
        }
        Response::erro('Rota não encontrada: ' . $caminho, 404);
    }

    private function executar(array|callable $acao, array $args): void
    {
        if (is_array($acao)) {
            [$classe, $metodo] = $acao;
            $controller = new $classe();
            if (!method_exists($controller, $metodo)) {
                throw new RuntimeException("Método {$metodo} não existe em {$classe}.");
            }
            $controller->$metodo(...$args);
            return;
        }
        $acao(...$args);
    }
}
