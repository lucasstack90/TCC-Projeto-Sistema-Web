<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Eventos da ficha: consulta, cirurgia, tratamento, exame, resgate, adoção... */
class AnimalHistorico extends Model
{
    protected $table = 'animal_historicos';

    public const TIPOS = ['Cadastro', 'Consulta', 'Cirurgia', 'Tratamento', 'Exame', 'Banho e Tosa', 'Resgate', 'Adoção', 'Outro'];

    protected $fillable = ['animal_id', 'tipo', 'data', 'descricao', 'responsavel', 'notas', 'user_id'];

    protected function casts(): array
    {
        return ['data' => 'date'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class);
    }
}
