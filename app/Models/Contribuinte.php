<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * Contribuinte do módulo financeiro: doador frequente e/ou fornecedor, pessoa física ou jurídica.
 * O CPF/CNPJ é salvo criptografado; documento_hash (HMAC-SHA256 com a APP_KEY) permite conferir
 * se o documento já existe sem descriptografar a tabela inteira (mesma técnica dos adotantes).
 */
class Contribuinte extends Model
{
    use SoftDeletes;

    protected $table = 'contribuintes';

    public const PF = 'Pessoa física';
    public const PJ = 'Pessoa jurídica';
    public const TIPOS = [self::PF, self::PJ];

    protected $fillable = [
        'tipo', 'nome', 'nome_fantasia', 'documento', 'responsavel', 'telefone', 'email',
        'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
        'doador', 'fornecedor', 'observacoes', 'consentimento_lgpd_em', 'ativo', 'user_id', 'alterado_por',
    ];

    protected $hidden = ['documento_hash'];

    protected function casts(): array
    {
        return [
            'doador' => 'boolean',
            'fornecedor' => 'boolean',
            'ativo' => 'boolean',
            'consentimento_lgpd_em' => 'datetime',
            'anonimizado_em' => 'datetime',
        ];
    }

    /** Hash usado para unicidade e busca. Recebe o documento com ou sem máscara. */
    public static function hashDocumento(string $documento): string
    {
        return hash_hmac('sha256', preg_replace('/\D/', '', $documento), (string) config('app.key'));
    }

    /** Guarda só os números (criptografados) e atualiza o hash; ao ler, devolve os números. */
    protected function documento(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value) => $value ? decrypt($value, false) : '',
            set: fn (string $value) => [
                'documento' => encrypt(preg_replace('/\D/', '', $value), false),
                'documento_hash' => self::hashDocumento($value),
            ],
        );
    }

    /** 000.000.000-00 ou 00.000.000/0000-00 */
    public function documentoFormatado(): string
    {
        $d = $this->documento;

        return match (strlen($d)) {
            11 => preg_replace('/(\d{3})(\d{3})(\d{3})(\d{2})/', '$1.$2.$3-$4', $d),
            14 => preg_replace('/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/', '$1.$2.$3/$4-$5', $d),
            default => '',
        };
    }

    /**
     * Nas listas, o CPF aparece parcialmente oculto (***.982.247-**).
     * O CNPJ é dado público da empresa e aparece completo (vai para a prestação de contas).
     */
    public function documentoParaLista(): string
    {
        $d = $this->documento;

        return strlen($d) === 11
            ? '***.'.substr($d, 3, 3).'.'.substr($d, 6, 3).'-**'
            : $this->documentoFormatado();
    }

    /**
     * LGPD — direito de eliminação (art. 18, VI) sem quebrar a prestação de contas:
     * troca os dados pessoais por valores neutros e mantém o registro (excluído logicamente).
     */
    public function anonimizar(?int $userId = null): void
    {
        $this->forceFill([
            'nome' => ($this->tipo === self::PJ ? 'Empresa removida #' : 'Contribuinte removido #').$this->id,
            'nome_fantasia' => null,
            'documento' => '00000000000',
            'responsavel' => null,
            'telefone' => '',
            'email' => null,
            'cep' => null, 'logradouro' => null, 'numero' => null, 'complemento' => null, 'bairro' => null,
            'observacoes' => null,
            'ativo' => false,
            'anonimizado_em' => now(),
            'alterado_por' => $userId,
        ]);
        // Hash aleatório: o documento original pode ser cadastrado de novo no futuro.
        $this->forceFill(['documento_hash' => hash('sha256', Str::random(40))]);
        $this->save();
    }

    /** Formato usado pelo JavaScript (nomes em inglês, como no restante do front-end). */
    public function paraTela(): array
    {
        return [
            'id' => $this->id,
            'type' => $this->tipo,
            'name' => $this->nome,
            'tradeName' => $this->nome_fantasia ?? '',
            // O formulário de edição precisa do documento completo; só a equipe (perfil funcionário) acessa a rota.
            'document' => $this->documentoFormatado(),
            'documentMasked' => $this->documentoParaLista(),
            'contact' => $this->responsavel ?? '',
            'phone' => $this->telefone,
            'email' => $this->email ?? '',
            'cep' => $this->cep ?? '',
            'street' => $this->logradouro ?? '',
            'number' => $this->numero ?? '',
            'complement' => $this->complemento ?? '',
            'district' => $this->bairro ?? '',
            'city' => $this->cidade ?? '',
            'uf' => $this->uf ?? '',
            'donor' => $this->doador,
            'supplier' => $this->fornecedor,
            'notes' => $this->observacoes ?? '',
            'consent' => $this->consentimento_lgpd_em?->format('Y-m-d') ?? '',
            'active' => $this->ativo,
        ];
    }

    public static function listaParaTela(): array
    {
        return static::orderByDesc('ativo')->orderBy('nome')->get()->map->paraTela()->all();
    }
}
