<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/** Pessoa da equipe (ou interessada vinda do formulário público). */
class Voluntario extends Model
{
    use SoftDeletes;

    protected $table = 'voluntarios';

    protected $fillable = [
        'nome', 'email', 'telefone', 'funcao', 'status', 'habilidades', 'experiencia', 'dias', 'turnos',
        'observacoes', 'origem', 'consentimento_lgpd_em', 'consentimento_ip',
    ];

    protected function casts(): array
    {
        return [
            'habilidades' => 'array',
            'dias' => 'array',
            'turnos' => 'array',
            'consentimento_lgpd_em' => 'datetime',
            'anonimizado_em' => 'datetime',
        ];
    }

    /**
     * LGPD — direito de eliminação (art. 18, VI) sem quebrar o histórico de resgates:
     * troca os dados pessoais por valores neutros e mantém o registro.
     */
    public function anonimizar(): void
    {
        $this->forceFill([
            'nome' => 'Voluntário removido #'.$this->id,
            'email' => 'anonimizado-'.$this->id.'@pawsafe.invalid',
            'telefone' => '',
            'experiencia' => null,
            'observacoes' => null,
            'consentimento_ip' => null,
            'status' => 'Inativo',
            'anonimizado_em' => now(),
        ])->save();
    }
}
