<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

/**
 * Confere os dígitos verificadores do CPF (11 dígitos) ou do CNPJ (14 dígitos).
 * Uso: new DocumentoValido('cpf') ou new DocumentoValido('cnpj'). Aceita com ou sem máscara.
 * A mesma conta existe no JavaScript (PawUtils.isValidCpf / isValidCnpj), mas lá pode ser contornada.
 */
class DocumentoValido implements ValidationRule
{
    public function __construct(private string $tipo) {}

    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $digitos = preg_replace('/\D/', '', (string) $value);
        $valido = $this->tipo === 'cnpj' ? self::cnpj($digitos) : self::cpf($digitos);

        if (! $valido) {
            $fail($this->tipo === 'cnpj' ? 'CNPJ inválido. Confira os números.' : 'CPF inválido. Confira os números.');
        }
    }

    public static function cpf(string $d): bool
    {
        if (strlen($d) !== 11 || preg_match('/^(\d)\1{10}$/', $d)) {
            return false;
        }
        for ($t = 9; $t < 11; $t++) {
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += (int) $d[$i] * (($t + 1) - $i);
            }
            if ((int) $d[$t] !== ((10 * $soma) % 11) % 10) {
                return false;
            }
        }

        return true;
    }

    public static function cnpj(string $d): bool
    {
        if (strlen($d) !== 14 || preg_match('/^(\d)\1{13}$/', $d)) {
            return false;
        }
        foreach ([12, 13] as $t) {
            $pesos = $t === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += (int) $d[$i] * $pesos[$i];
            }
            $resto = $soma % 11;
            if ((int) $d[$t] !== ($resto < 2 ? 0 : 11 - $resto)) {
                return false;
            }
        }

        return true;
    }
}
