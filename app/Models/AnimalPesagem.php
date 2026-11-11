<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AnimalPesagem extends Model
{
    protected $table = 'animal_pesagens';

    protected $fillable = ['animal_id', 'peso', 'data', 'observacao', 'user_id'];

    protected function casts(): array
    {
        return ['data' => 'date', 'peso' => 'decimal:2'];
    }

    public function animal(): BelongsTo
    {
        return $this->belongsTo(Animal::class);
    }
}
