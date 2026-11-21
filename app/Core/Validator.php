<?php

namespace Core;

/**
 * Validação no servidor.
 *
 * Repete, no back-end, as regras que o protótipo só tinha no JavaScript
 * (ver docs/pendencias-backend.md, seção 2). Nunca confie na validação do
 * navegador: ela pode ser contornada pelo console.
 *
 * Uso:
 *   $v = new Validator($req->todos());
 *   $v->obrigatorio('nome')->texto('nome', 2, 80);
 *   $v->obrigatorio('especie')->umDe('especie', ['Cão', 'Gato', 'Outros']);
 *   if ($v->falhou()) Response::erro('Confira os campos.', 422, $v->erros());
 */
final class Validator
{
    private array $dados;
    /** @var array<string,string> */
    private array $erros = [];

    public function __construct(array $dados)
    {
        $this->dados = $dados;
    }

    private function valor(string $campo): mixed
    {
        $v = $this->dados[$campo] ?? null;
        return is_string($v) ? trim($v) : $v;
    }

    /** Marca um erro num campo (também usado para regras próprias de cada controller). */
    public function marcar(string $campo, string $msg): void
    {
        // Mantém só o primeiro erro de cada campo.
        $this->erros[$campo] ??= $msg;
    }

    public function obrigatorio(string $campo, string $rotulo = null): self
    {
        $v = $this->valor($campo);
        if ($v === null || $v === '' || $v === []) {
            $this->marcar($campo, ($rotulo ?? $campo) . ' é obrigatório.');
        }
        return $this;
    }

    public function texto(string $campo, int $min = 0, int $max = 255): self
    {
        $v = $this->valor($campo);
        if ($v === null || $v === '') {
            return $this; // obrigatoriedade é checada separadamente
        }
        $tam = mb_strlen((string) $v);
        if ($tam < $min) {
            $this->marcar($campo, "Deve ter ao menos {$min} caractere(s).");
        } elseif ($tam > $max) {
            $this->marcar($campo, "Deve ter no máximo {$max} caractere(s).");
        }
        return $this;
    }

    public function email(string $campo): self
    {
        $v = $this->valor($campo);
        if ($v && !filter_var($v, FILTER_VALIDATE_EMAIL)) {
            $this->marcar($campo, 'E-mail inválido.');
        }
        return $this;
    }

    public function umDe(string $campo, array $permitidos): self
    {
        $v = $this->valor($campo);
        if ($v !== null && $v !== '' && !in_array($v, $permitidos, true)) {
            $this->marcar($campo, 'Valor fora da lista permitida.');
        }
        return $this;
    }

    public function numero(string $campo, ?float $min = null, ?float $max = null): self
    {
        $v = $this->valor($campo);
        if ($v === null || $v === '') {
            return $this;
        }
        if (!is_numeric($v)) {
            $this->marcar($campo, 'Deve ser um número.');
            return $this;
        }
        $n = (float) $v;
        if ($min !== null && $n < $min) {
            $this->marcar($campo, "Deve ser maior ou igual a {$min}.");
        } elseif ($max !== null && $n > $max) {
            $this->marcar($campo, "Deve ser menor ou igual a {$max}.");
        }
        return $this;
    }

    public function data(string $campo, bool $naoFutura = false): self
    {
        $v = $this->valor($campo);
        if (!$v) {
            return $this;
        }
        // "!" zera a hora: sem ele a data de hoje (com a hora atual) contaria como futura.
        $d = \DateTime::createFromFormat('!Y-m-d', (string) $v);
        if (!$d || $d->format('Y-m-d') !== $v) {
            $this->marcar($campo, 'Data inválida (use AAAA-MM-DD).');
            return $this;
        }
        if ($naoFutura && $d > new \DateTime('today')) {
            $this->marcar($campo, 'A data não pode ser futura.');
        }
        return $this;
    }

    public function falhou(): bool { return $this->erros !== []; }
    public function erros(): array { return $this->erros; }
}
