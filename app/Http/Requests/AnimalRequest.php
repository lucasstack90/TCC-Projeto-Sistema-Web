<?php

namespace App\Http\Requests;

use App\Models\Animal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validação do cadastro/edição de animal NO SERVIDOR.
 * As mesmas regras existem no HTML/JavaScript, mas lá elas podem ser contornadas
 * pelo console do navegador; aqui não.
 *
 * Os campos chegam com os nomes do front-end (name, species...) e são convertidos
 * para as colunas do banco em dadosDoBanco().
 */
class AnimalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60'],
            'species' => ['required', Rule::in(Animal::ESPECIES)],
            'breed' => ['required', 'string', 'max:60'],
            'color' => ['required', 'string', 'max:60'],
            'age' => ['nullable', 'string', 'max:30'],
            'arrival' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'sex' => ['required', Rule::in(Animal::SEXOS)],
            'size' => ['required', Rule::in(Animal::PORTES)],
            'status' => ['required', Rule::in(Animal::STATUS)],
            'weight' => ['nullable', 'numeric', 'min:0.01', 'max:999.99'],
            'vaccinated' => ['boolean'],
            'neutered' => ['boolean'],
            'chip' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            // Foto opcional: só imagens, até 4 MB (o JavaScript já reduz antes de enviar).
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:4096'],
            'remove_photo' => ['boolean'],
            // Quando o animal é cadastrado a partir de uma ocorrência do módulo de Resgates.
            'rescue' => ['nullable', 'array'],
            'rescue.code' => ['required_with:rescue', 'string', 'max:20'],
            'rescue.date' => ['required_with:rescue', 'date_format:Y-m-d'],
            'rescue.district' => ['nullable', 'string', 'max:100'],
            'rescue.description' => ['nullable', 'string', 'max:1000'],
            'rescue.responsible' => ['nullable', 'string', 'max:120'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nome',
            'species' => 'espécie',
            'breed' => 'raça / tipo',
            'color' => 'cor / pelagem',
            'age' => 'idade estimada',
            'arrival' => 'data de chegada',
            'sex' => 'sexo',
            'size' => 'porte',
            'status' => 'status',
            'weight' => 'peso',
            'notes' => 'observações de saúde',
            'photo' => 'foto',
        ];
    }

    /** Campos validados já com os nomes das colunas da tabela "animais". */
    public function dadosDoBanco(): array
    {
        $v = $this->validated();

        return [
            'nome' => trim($v['name']),
            'especie' => $v['species'],
            'raca' => trim($v['breed']),
            'cor' => trim($v['color']),
            'idade_estimada' => isset($v['age']) ? trim($v['age']) : null,
            'data_chegada' => $v['arrival'],
            'sexo' => $v['sex'],
            'porte' => $v['size'],
            'status' => $v['status'],
            'peso' => $v['weight'] ?? null,
            'vacinado' => $this->boolean('vaccinated'),
            'castrado' => $this->boolean('neutered'),
            'microchip' => $this->boolean('chip'),
            'observacoes' => isset($v['notes']) ? trim($v['notes']) : null,
        ];
    }
}
