<?php

namespace Models;

use Core\Documento;
use Core\Model;

/**
 * Contribuintes do financeiro: doadores frequentes e fornecedores.
 * Pessoa física (CPF) ou jurídica (CNPJ). O documento é guardado só com dígitos.
 */
final class Contribuinte extends Model
{
    protected string $tabela = 'contribuintes';
    protected array $preenchivel = [
        'tipo', 'nome', 'documento', 'nome_fantasia', 'contato', 'telefone', 'email',
        'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf',
        'doador', 'fornecedor', 'observacoes', 'consentimento', 'consentimento_em', 'ativo',
    ];

    public const PF = 'Pessoa física';
    public const PJ = 'Pessoa jurídica';
    public const TIPOS = [self::PF, self::PJ];

    private const MAPA = [
        'type'       => 'tipo',
        'name'       => 'nome',
        'tradeName'  => 'nome_fantasia',
        'contact'    => 'contato',
        'phone'      => 'telefone',
        'email'      => 'email',
        'cep'        => 'cep',
        'street'     => 'logradouro',
        'number'     => 'numero',
        'complement' => 'complemento',
        'district'   => 'bairro',
        'city'       => 'cidade',
        'uf'         => 'uf',
        'notes'      => 'observacoes',
    ];

    public function paraApi(array $linha): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::MAPA as $api => $col) {
            $out[$api] = $linha[$col] ?? null;
        }
        $out['donor']    = (bool) ($linha['doador'] ?? 0);
        $out['supplier'] = (bool) ($linha['fornecedor'] ?? 0);
        $out['active']   = (bool) ($linha['ativo'] ?? 0);
        $out['consent']  = $linha['consentimento'] === null ? null : (bool) $linha['consentimento'];
        // Documento: guardado só com dígitos; a interface recebe já formatado.
        $out['document']       = Documento::formata((string) ($linha['documento'] ?? ''));
        $out['documentMasked'] = $out['document'];
        return $out;
    }

    public function doApi(array $dados): array
    {
        $out = [];
        foreach (self::MAPA as $api => $col) {
            if (array_key_exists($api, $dados)) {
                $out[$col] = is_string($dados[$api]) ? trim($dados[$api]) : $dados[$api];
            }
        }
        if (array_key_exists('document', $dados)) {
            $out['documento'] = Documento::digitos((string) $dados['document']);
        }
        if (array_key_exists('donor', $dados)) {
            $out['doador'] = $dados['donor'] ? 1 : 0;
        }
        if (array_key_exists('supplier', $dados)) {
            $out['fornecedor'] = $dados['supplier'] ? 1 : 0;
        }
        if (array_key_exists('active', $dados)) {
            $out['ativo'] = $dados['active'] ? 1 : 0;
        }
        if (array_key_exists('uf', $dados)) {
            $out['uf'] = $dados['uf'] ? strtoupper((string) $dados['uf']) : null;
        }
        if (array_key_exists('consent', $dados)) {
            $temConsentimento = (bool) $dados['consent'];
            $out['consentimento'] = $dados['consent'] === null ? null : ($temConsentimento ? 1 : 0);
            $out['consentimento_em'] = $temConsentimento ? date('Y-m-d H:i:s') : null;
        }
        return $out;
    }

    public function listarParaApi(): array
    {
        return array_map([$this, 'paraApi'], $this->todos('nome ASC'));
    }

    /** Documento (CPF/CNPJ) já cadastrado em outro registro? */
    public function documentoEmUso(string $documento, ?int $ignorarId = null): bool
    {
        $sql = 'SELECT id FROM contribuintes WHERE documento = :doc';
        $params = [':doc' => Documento::digitos($documento)];
        if ($ignorarId) {
            $sql .= ' AND id <> :id';
            $params[':id'] = $ignorarId;
        }
        $stmt = $this->db()->prepare($sql . ' LIMIT 1');
        $stmt->execute($params);
        return (bool) $stmt->fetch();
    }
}
