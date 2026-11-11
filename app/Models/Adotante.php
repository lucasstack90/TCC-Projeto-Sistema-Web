<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Adotante — dados pessoais protegidos pela LGPD.
 * O CPF é salvo criptografado; cpf_hash (HMAC-SHA256 com a APP_KEY) permite conferir
 * se o CPF já existe sem precisar descriptografar a tabela inteira.
 */
class Adotante extends Model
{
    use SoftDeletes;

    protected $table = 'adotantes';

    protected $fillable = [
        'nome', 'cpf', 'data_nascimento', 'telefone', 'email', 'logradouro', 'numero', 'bairro', 'cidade',
        'tipo_moradia', 'posse_moradia', 'tem_quintal', 'tem_telas', 'moradores', 'tem_criancas',
        'outros_animais', 'horas_sozinho', 'experiencia', 'motivacao',
        'consentimento_lgpd_em', 'consentimento_versao', 'user_id',
    ];

    protected $hidden = ['cpf_hash'];

    protected function casts(): array
    {
        return [
            'cpf' => 'encrypted',
            'data_nascimento' => 'date',
            'tem_quintal' => 'boolean',
            'tem_telas' => 'boolean',
            'tem_criancas' => 'boolean',
            'consentimento_lgpd_em' => 'datetime',
            'anonimizado_em' => 'datetime',
        ];
    }

    /** Hash usado para unicidade e busca. Recebe o CPF com ou sem máscara. */
    public static function hashCpf(string $cpf): string
    {
        return hash_hmac('sha256', preg_replace('/\D/', '', $cpf), (string) config('app.key'));
    }

    /** Ao gravar o CPF, guarda só os números (criptografados) e atualiza o hash. */
    protected function cpf(): Attribute
    {
        return Attribute::make(
            set: fn (string $value) => [
                'cpf' => encrypt(preg_replace('/\D/', '', $value), false),
                'cpf_hash' => self::hashCpf($value),
            ],
        );
    }

    /** CPF parcialmente oculto para as listas (***.982.247-**). */
    public function cpfMascarado(): string
    {
        $d = (string) $this->cpf;

        return strlen($d) === 11 ? '***.'.substr($d, 3, 3).'.'.substr($d, 6, 3).'-**' : '';
    }

    public function documentos(): HasMany
    {
        return $this->hasMany(AdotanteDocumento::class);
    }
}
