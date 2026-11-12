<?php

namespace App\Http\Requests;

use App\Models\Contribuinte;
use App\Models\Veterinario;
use App\Rules\DocumentoValido;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * Validação do cadastro/edição de contribuinte (pessoa física ou jurídica) NO SERVIDOR.
 * CPF/CNPJ: dígitos verificadores conferidos e cadastro repetido bloqueado pelo hash.
 */
class ContribuinteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isFuncionario() ?? false;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'document' => preg_replace('/\D/', '', (string) $this->input('document')),
            'cep' => $this->filled('cep') ? preg_replace('/\D/', '', (string) $this->input('cep')) : null,
            'uf' => $this->filled('uf') ? strtoupper((string) $this->input('uf')) : null,
        ]);
    }

    public function rules(): array
    {
        $pj = $this->input('type') === Contribuinte::PJ;

        return [
            'type' => ['required', Rule::in(Contribuinte::TIPOS)],
            'name' => ['required', 'string', 'min:3', 'max:150'],
            'tradeName' => ['nullable', 'string', 'max:150'],
            'document' => ['required', new DocumentoValido($pj ? 'cnpj' : 'cpf')],
            'contact' => ['nullable', 'string', 'max:120'],
            'phone' => ['required', 'string', 'max:20', 'regex:/^\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/'],
            'email' => ['nullable', 'email', 'max:150'],
            'cep' => ['nullable', 'digits:8'],
            'street' => ['nullable', 'string', 'max:150'],
            'number' => ['nullable', 'string', 'max:20'],
            'complement' => ['nullable', 'string', 'max:60'],
            'district' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'uf' => ['nullable', Rule::in(Veterinario::UFS)],
            'donor' => ['boolean'],
            'supplier' => ['boolean'],
            'notes' => ['nullable', 'string', 'max:1000'],
            // Pessoa física: a equipe confirma que a pessoa autorizou o uso dos dados (LGPD).
            'consent' => [$pj ? 'nullable' : 'accepted'],
            'active' => ['boolean'],
        ];
    }

    /** Regras que dependem de mais de um campo. */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->boolean('donor') && ! $this->boolean('supplier')) {
                    $validator->errors()->add('donor', 'Marque se o contribuinte é doador, fornecedor ou os dois.');
                }

                // Documento repetido: compara o hash (o documento em si está criptografado).
                $documento = (string) $this->input('document');
                if ($documento !== '') {
                    $repetido = Contribuinte::withTrashed()
                        ->where('documento_hash', Contribuinte::hashDocumento($documento))
                        ->when($this->route('contribuinte'), fn ($q, $c) => $q->whereKeyNot($c->id))
                        ->first();
                    if ($repetido) {
                        $validator->errors()->add('document', $repetido->trashed()
                            ? 'Este documento pertence a um cadastro excluído.'
                            : "Este documento já está cadastrado ({$repetido->nome}).");
                    }
                }
            },
        ];
    }

    public function attributes(): array
    {
        return [
            'type' => 'tipo', 'name' => 'nome / razão social', 'tradeName' => 'nome fantasia',
            'document' => 'CPF / CNPJ', 'contact' => 'pessoa de contato', 'phone' => 'telefone',
            'email' => 'e-mail', 'cep' => 'CEP', 'street' => 'logradouro', 'number' => 'número',
            'complement' => 'complemento', 'district' => 'bairro', 'city' => 'cidade', 'uf' => 'UF',
            'notes' => 'observações', 'consent' => 'consentimento',
        ];
    }

    public function messages(): array
    {
        return ['consent.accepted' => 'Confirme que a pessoa autorizou o uso dos dados (LGPD).'];
    }

    public function dadosDoBanco(?Contribuinte $atual = null): array
    {
        $v = $this->validated();
        $texto = fn (string $campo) => isset($v[$campo]) && trim((string) $v[$campo]) !== '' ? trim($v[$campo]) : null;
        $pj = $v['type'] === Contribuinte::PJ;

        return [
            'tipo' => $v['type'],
            'nome' => trim($v['name']),
            'nome_fantasia' => $pj ? $texto('tradeName') : null,
            'documento' => $v['document'],
            'responsavel' => $pj ? $texto('contact') : null,
            'telefone' => trim($v['phone']),
            'email' => $texto('email'),
            'cep' => $v['cep'] ? substr($v['cep'], 0, 5).'-'.substr($v['cep'], 5) : null,
            'logradouro' => $texto('street'),
            'numero' => $texto('number'),
            'complemento' => $texto('complement'),
            'bairro' => $texto('district'),
            'cidade' => $texto('city'),
            'uf' => $v['uf'] ?? null,
            'doador' => $this->boolean('donor'),
            'fornecedor' => $this->boolean('supplier'),
            'observacoes' => $texto('notes'),
            // Mantém a data original do consentimento; registra agora se ainda não havia.
            'consentimento_lgpd_em' => $pj ? null : ($atual?->consentimento_lgpd_em ?? now()),
            'ativo' => $this->has('active') ? $this->boolean('active') : true,
        ];
    }
}
