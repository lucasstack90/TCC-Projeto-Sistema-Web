<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Animal sob cuidado da organização (tabela "animais").
 * Os nomes das colunas estão em português; o JavaScript do front-end usa os nomes em inglês
 * do protótipo (name, species...). A conversão fica toda em paraTela() e em AnimalRequest.
 */
class Animal extends Model
{
    use SoftDeletes;

    protected $table = 'animais';

    public const ESPECIES = ['Cão', 'Gato', 'Outros'];
    public const SEXOS = ['Macho', 'Fêmea', 'Não identificado'];
    public const PORTES = ['Pequeno', 'Médio', 'Grande'];
    public const STATUS = ['Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário'];

    protected $fillable = [
        'nome', 'especie', 'raca', 'cor', 'idade_estimada', 'data_chegada', 'sexo', 'porte',
        'status', 'peso', 'vacinado', 'castrado', 'microchip', 'observacoes', 'foto',
        'resgate_id', 'user_id',
    ];

    protected function casts(): array
    {
        return [
            'data_chegada' => 'date',
            'peso' => 'decimal:2',
            'vacinado' => 'boolean',
            'castrado' => 'boolean',
            'microchip' => 'boolean',
        ];
    }

    public function vacinas(): HasMany
    {
        return $this->hasMany(AnimalVacina::class)->orderByDesc('data_aplicacao')->orderByDesc('id');
    }

    public function historicos(): HasMany
    {
        return $this->hasMany(AnimalHistorico::class)->orderByDesc('data')->orderByDesc('id');
    }

    public function pesagens(): HasMany
    {
        return $this->hasMany(AnimalPesagem::class)->orderByDesc('data')->orderByDesc('id');
    }

    public function cadastradoPor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /** Foto enviada pelo sistema (storage/app/public) ou URL externa dos dados de exemplo. */
    public function fotoUrl(): string
    {
        if (! $this->foto) {
            return '';
        }

        return Str::startsWith($this->foto, ['http://', 'https://'])
            ? $this->foto
            : asset('storage/'.$this->foto);
    }

    /** Apaga do disco a foto enviada (as URLs externas de exemplo não são arquivos nossos). */
    public function apagarArquivoDaFoto(): void
    {
        if ($this->foto && ! Str::startsWith($this->foto, ['http://', 'https://'])) {
            Storage::disk('public')->delete($this->foto);
        }
    }

    /** Formato que o JavaScript do front-end já conhece (o mesmo do protótipo em localStorage). */
    public function paraTela(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->nome,
            'species' => $this->especie,
            'breed' => $this->raca,
            'color' => $this->cor,
            'age' => $this->idade_estimada ?? '',
            'arrival' => $this->data_chegada?->format('Y-m-d') ?? '',
            'sex' => $this->sexo,
            'size' => $this->porte,
            'status' => $this->status,
            'photo' => $this->fotoUrl(),
            'weight' => $this->peso !== null ? (float) $this->peso : null,
            'vaccinated' => $this->vacinado,
            'neutered' => $this->castrado,
            'chip' => $this->microchip,
            'notes' => $this->observacoes ?? '',
            'vaccines' => $this->vacinas->map(fn (AnimalVacina $v) => [
                'id' => $v->id,
                'name' => $v->nome,
                'date' => $v->data_aplicacao?->format('Y-m-d') ?? '',
                'next' => $v->proxima_dose?->format('Y-m-d') ?? '',
                'lot' => $v->lote ?? '',
                'vet' => $v->veterinario ?? '',
            ])->values()->all(),
            'history' => $this->historicos->map(fn (AnimalHistorico $h) => [
                'id' => $h->id,
                'type' => $h->tipo,
                'date' => $h->data?->format('Y-m-d') ?? '',
                'description' => $h->descricao,
                'vet' => $h->responsavel ?? '',
                'notes' => $h->notas ?? '',
            ])->values()->all(),
            'weights' => $this->pesagens->map(fn (AnimalPesagem $p) => [
                'id' => $p->id,
                'weight' => (float) $p->peso,
                'date' => $p->data?->format('Y-m-d') ?? '',
                'note' => $p->observacao ?? '',
            ])->values()->all(),
        ];
    }

    /** Lista completa na ordem da tela: cadastros mais novos primeiro. */
    public static function listaParaTela(): array
    {
        return static::with(['vacinas', 'historicos', 'pesagens'])
            ->orderByDesc('created_at')
            ->orderBy('id')
            ->get()
            ->map->paraTela()
            ->all();
    }
}
