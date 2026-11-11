<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnimalVacina extends Model
{
    protected $table = 'animal_vacinas';

    protected $fillable = ['animal_id', 'nome', 'data_aplicacao', 'proxima_dose', 'lote', 'veterinario', 'user_id'];

    protected function casts(): array
    {
        return ['data_aplicacao' => 'date', 'proxima_dose' => 'date'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class);
    }
}
