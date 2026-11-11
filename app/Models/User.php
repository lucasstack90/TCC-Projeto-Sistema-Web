<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

/**
 * Usuário com login no PAWSAFE.
 * perfil "funcionario": acesso completo. perfil "voluntario": acesso limitado (artigo, seção 2.1).
 */
class User extends Authenticatable
{
    use Notifiable;

    public const FUNCIONARIO = 'funcionario';
    public const VOLUNTARIO = 'voluntario';

    protected $fillable = ['name', 'email', 'password', 'perfil', 'ativo', 'voluntario_id'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'ultimo_acesso_em' => 'datetime',
            'password' => 'hashed', // o Laravel gera o hash automaticamente ao salvar
            'ativo' => 'boolean',
        ];
    }

    public function voluntario(): BelongsTo
    {
        return $this->belongsTo(Voluntario::class);
    }

    public function isFuncionario(): bool
    {
        return $this->perfil === self::FUNCIONARIO;
    }

    public function perfilLabel(): string
    {
        return $this->isFuncionario() ? 'Funcionário(a)' : 'Voluntário(a)';
    }
}
