<?php

namespace Core;

/**
 * Representa a requisição HTTP que chegou.
 *
 * Reúne método, caminho, parâmetros da query, corpo (JSON ou formulário) e
 * cabeçalhos, para os controllers não mexerem direto nas variáveis globais.
 */
final class Request
{
    private string $metodo;
    private string $caminho;
    /** @var array<string,mixed> */
    private array $query;
    /** @var array<string,mixed> */
    private array $corpo;
    /** @var array<string,string> */
    private array $cabecalhos;

    public function __construct(
        string $metodo,
        string $caminho,
        array $query,
        array $corpo,
        array $cabecalhos
    ) {
        $this->metodo     = strtoupper($metodo);
        $this->caminho    = $caminho;
        $this->query      = $query;
        $this->corpo      = $corpo;
        $this->cabecalhos = $cabecalhos;
    }

    /**
     * Tira do caminho a pasta onde o projeto está (ex.: /TCC-Projeto-Sistema-Web).
     *
     * Se "app.base_url" estiver preenchido no config, usa ele. Senão, descobre
     * sozinho pela pasta do public/index.php: funciona com qualquer nome de pasta
     * no htdocs do XAMPP, abrindo pela raiz do projeto ou pela pasta public/.
     */
    private static function semBase(string $uri): string
    {
        $bases = [];
        $config = rtrim((string) Config::get('app.base_url', ''), '/');
        if ($config !== '') {
            $bases[] = $config;
        }
        $publica = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/index.php')), '/');
        if ($publica !== '') {
            $bases[] = $publica;                       // .../projeto/public
            if (str_ends_with($publica, '/public')) {
                $bases[] = substr($publica, 0, -7);    // .../projeto (via .htaccess da raiz)
            }
        }
        foreach ($bases as $base) {
            if ($base !== '' && ($uri === $base || str_starts_with($uri, $base . '/'))) {
                return substr($uri, strlen($base));
            }
        }
        return $uri;
    }

    /** Monta a requisição a partir das variáveis globais do PHP. */
    public static function capturar(): self
    {
        $metodo = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // Caminho sem a query string e sem a base_url do projeto.
        $uri     = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        $uri     = self::semBase(rawurldecode($uri));
        $caminho = '/' . trim($uri, '/');

        $cabecalhos = [];
        foreach ($_SERVER as $chave => $valor) {
            if (str_starts_with($chave, 'HTTP_')) {
                $nome = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($chave, 5)))));
                $cabecalhos[$nome] = $valor;
            }
        }

        // Corpo: aceita JSON (fetch da interface) ou formulário tradicional.
        $corpo = $_POST;
        $tipo  = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($tipo, 'application/json')) {
            $bruto = file_get_contents('php://input') ?: '';
            $json  = json_decode($bruto, true);
            if (is_array($json)) {
                $corpo = $json;
            }
        }

        return new self($metodo, $caminho, $_GET, $corpo, $cabecalhos);
    }

    public function metodo(): string  { return $this->metodo; }
    public function caminho(): string { return $this->caminho; }

    /** Valor do corpo (POST/PUT) com padrão. */
    public function input(string $chave, mixed $padrao = null): mixed
    {
        return $this->corpo[$chave] ?? $padrao;
    }

    /** Todo o corpo. */
    public function todos(): array { return $this->corpo; }

    /** Valor da query string (?busca=...). */
    public function query(string $chave, mixed $padrao = null): mixed
    {
        return $this->query[$chave] ?? $padrao;
    }

    public function cabecalho(string $nome, ?string $padrao = null): ?string
    {
        return $this->cabecalhos[$nome] ?? $padrao;
    }

    /** True quando a interface pediu JSON (chamada fetch da API). */
    public function querJson(): bool
    {
        return str_contains($this->cabecalho('Accept', '') ?? '', 'application/json')
            || str_contains($this->cabecalho('Content-Type', '') ?? '', 'application/json')
            || str_starts_with($this->caminho, '/api');
    }
}
