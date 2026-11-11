<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Foto de documento do adotante, guardada em storage/app/private (nunca na pasta pública). */
class AdotanteDocumento extends Model
{
    protected $table = 'adotante_documentos';

    protected $fillable = ['adotante_id', 'caminho', 'nome_original', 'mime', 'tamanho', 'user_id'];

    public function adotante(): BelongsTo
    {
        return $this->belongsTo(Adotante::class);
    }
}
