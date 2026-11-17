<?php

namespace Core;

/**
 * Validação e formatação de CPF/CNPJ no servidor.
 *
 * Repete, no back-end, a conferência de dígitos que a interface já faz — porque
 * a validação do navegador pode ser contornada pelo console (ver
 * docs/pendencias-backend.md, seção 2).
 */
final class Documento
{
    /** Só os dígitos de um texto. */
    public static function digitos(?string $valor): string
    {
        return preg_replace('/\D/', '', (string) $valor) ?? '';
    }

    public static function cpfValido(?string $valor): bool
    {
        $d = self::digitos($valor);
        if (strlen($d) !== 11 || preg_match('/^(\d)\1{10}$/', $d)) {
            return false;
        }
        for ($t = 9; $t < 11; $t++) {
            $soma = 0;
            for ($i = 0; $i < $t; $i++) {
                $soma += (int) $d[$i] * ($t + 1 - $i);
            }
            $dig = ((10 * $soma) % 11) % 10;
            if ((int) $d[$t] !== $dig) {
                return false;
            }
        }
        return true;
    }

    public static function cnpjValido(?string $valor): bool
    {
        $d = self::digitos($valor);
        if (strlen($d) !== 14 || preg_match('/^(\d)\1{13}$/', $d)) {
            return false;
        }
        foreach ([12, 13] as $t) {
            $pesos = $t === 12
                ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
                : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
            $soma = 0;
            foreach ($pesos as $i => $p) {
                $soma += (int) $d[$i] * $p;
            }
            $resto = $soma % 11;
            $dig = $resto < 2 ? 0 : 11 - $resto;
            if ((int) $d[$t] !== $dig) {
                return false;
            }
        }
        return true;
    }

    public static function formataCpf(string $d): string
    {
        return preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $d);
    }

    public static function formataCnpj(string $d): string
    {
        return preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $d);
    }

    /** Formata conforme o tamanho (11 = CPF, 14 = CNPJ). */
    public static function formata(string $documentoDigitos): string
    {
        $d = self::digitos($documentoDigitos);
        return strlen($d) === 11 ? self::formataCpf($d) : self::formataCnpj($d);
    }
}
