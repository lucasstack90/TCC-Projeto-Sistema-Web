<?php

namespace App\Http\Requests;

use App\Models\Veterinario;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validação do cadastro/edição de veterinário NO SERVIDOR.
 * Os campos chegam com os nomes do front-end e viram colunas em dadosDoBanco().
 */
class VeterinarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        // CRMV só com números e UF em maiúsculas: "12.345" e "12345" são o mesmo registro.
        $this->merge([
            'crmv' => preg_replace('/\D/', '', (string) $this->input('crmv')),
            'crmvUf' => strtoupper((string) $this->input('crmvUf', 'PR')),
        ]);
    }

    public function rules(): array
    {
        $atual = $this->route('veterinario')?->id;

        return [
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'crmv' => [
                'required', 'digits_between:1,10',
                Rule::unique('veterinarios', 'crmv')->where('crmv_uf', $this->input('crmvUf'))->ignore($atual),
            ],
            'crmvUf' => ['required', Rule::in(Veterinario::UFS)],
            'phone' => ['nullable', 'string', 'max:20', 'regex:/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'clinic' => ['nullable', 'string', 'max:120'],
            'specialty' => ['nullable', 'string', 'max:80'],
            'bond' => ['required', Rule::in(Veterinario::VINCULOS)],
            'notes' => ['nullable', 'string', 'max:1000'],
            'active' => ['boolean'],
        ];
    }

    public function attributes(): array
    {
        return [
            'name' => 'nome', 'crmv' => 'CRMV', 'crmvUf' => 'UF do CRMV', 'phone' => 'telefone',
            'email' => 'e-mail', 'clinic' => 'clínica', 'specialty' => 'especialidade',
            'bond' => 'vínculo', 'notes' => 'observações',
        ];
    }

    public function messages(): array
    {
        return ['crmv.unique' => 'Já existe um veterinário cadastrado com este CRMV.'];
    }

    public function dadosDoBanco(): array
    {
        $v = $this->validated();
        $texto = fn (string $campo) => isset($v[$campo]) && trim($v[$campo]) !== '' ? trim($v[$campo]) : null;

        return [
            'nome' => trim($v['name']),
            'crmv' => $v['crmv'],
            'crmv_uf' => $v['crmvUf'],
            'telefone' => $texto('phone'),
            'email' => $texto('email'),
            'clinica' => $texto('clinic'),
            'especialidade' => $texto('specialty'),
            'vinculo' => $v['bond'],
            'observacoes' => $texto('notes'),
            'ativo' => $this->has('active') ? $this->boolean('active') : true,
        ];
    }
}
