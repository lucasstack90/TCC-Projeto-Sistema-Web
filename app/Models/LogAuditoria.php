<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

/** Registro de quem fez o quê e quando (LGPD, art. 37). Não guarda o conteúdo dos dados pessoais. */
class LogAuditoria extends Model
{
    protected $table = 'log_auditoria';

    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'acao', 'tabela', 'registro_id', 'descricao', 'ip'];

    public static function registrar(string $acao, ?Model $registro = null, ?string $descricao = null, ?int $userId = null): void
    {
        static::create([
            'user_id' => $userId ?? Auth::id(),
            'acao' => $acao,
            'tabela' => $registro?->getTable(),
            'registro_id' => $registro?->getKey(),
            'descricao' => $descricao ? mb_substr($descricao, 0, 255) : null,
            'ip' => request()?->ip(),
        ]);
    }
}
