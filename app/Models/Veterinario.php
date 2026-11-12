<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Veterinário(a) que aplica vacinas e faz procedimentos nos animais.
 * Também assina o Relatório técnico junto com o responsável legal da organização.
 */
class Veterinario extends Model
{
    protected $table = 'veterinarios';

    public const VINCULOS = ['Equipe da organização', 'Voluntário(a)', 'Clínica parceira', 'Serviço público'];

    public const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
        'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

    protected $fillable = [
        'nome', 'crmv', 'crmv_uf', 'telefone', 'email', 'clinica', 'especialidade', 'vinculo',
        'observacoes', 'ativo', 'user_id',
    ];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function vacinas(): HasMany
    {
        return $this->hasMany(AnimalVacina::class);
    }

    public function historicos(): HasMany
    {
        return $this->hasMany(AnimalHistorico::class);
    }

    /** "CRMV-PR 12345" — forma usada em carimbos e assinaturas. */
    public function registro(): string
    {
        return "CRMV-{$this->crmv_uf} {$this->crmv}";
    }

    /** Formato usado pelo JavaScript (nomes em inglês, como no restante do front-end). */
    public function paraTela(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->nome,
            'crmv' => $this->crmv,
            'crmvUf' => $this->crmv_uf,
            'registry' => $this->registro(),
            'phone' => $this->telefone ?? '',
            'email' => $this->email ?? '',
            'clinic' => $this->clinica ?? '',
            'specialty' => $this->especialidade ?? '',
            'bond' => $this->vinculo,
            'notes' => $this->observacoes ?? '',
            'active' => $this->ativo,
            // Quantos registros usam o cadastro (com withCount); decide entre excluir e inativar.
            'uses' => (int) ($this->vacinas_count ?? 0) + (int) ($this->historicos_count ?? 0),
        ];
    }

    /** Lista completa (ativos primeiro, em ordem alfabética). */
    public static function listaParaTela(): array
    {
        return static::withCount(['vacinas', 'historicos'])
            ->orderByDesc('ativo')
            ->orderBy('nome')
            ->get()
            ->map->paraTela()
            ->all();
    }
}
