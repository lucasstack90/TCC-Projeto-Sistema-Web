<?php

namespace Models;

use Core\Config;
use Core\Documento;
use Core\Model;

/**
 * Adotantes (módulo de Adoções) e os documentos anexados a eles.
 *
 * Dados pessoais (LGPD): só administrador e equipe acessam (adotantes.gerenciar).
 * O CPF fica só com os dígitos no banco e sai formatado para a interface.
 *
 * Documentos: o arquivo é salvo em storage/uploads/adotantes/ com nome
 * aleatório (fora da pasta pública) e entregue pela rota
 * GET /api/adotantes/{id}/documentos/{doc}. Remover não apaga o registro:
 * guarda quem removeu e quando.
 */
final class Adotante extends Model
{
    protected string $tabela = 'adotantes';
    protected array $preenchivel = [
        'nome', 'cpf', 'nascimento', 'telefone', 'email', 'rua', 'numero', 'bairro', 'cidade',
        'tipo_moradia', 'propriedade', 'tem_quintal', 'tem_telas', 'moradores', 'tem_criancas',
        'outros_animais', 'horas_sozinho', 'experiencia', 'motivacao', 'consentimento',
        'consentimento_em', 'criado_por', 'atualizado_por',
    ];

    public const MORADIAS     = ['Casa', 'Apartamento', 'Chácara / sítio'];
    public const PROPRIEDADES = ['Própria', 'Alugada', 'Cedida'];

    /** chave da API (inglês, herdada do protótipo) => coluna do banco */
    private const MAPA = [
        'name' => 'nome', 'cpf' => 'cpf', 'birth' => 'nascimento', 'phone' => 'telefone',
        'email' => 'email', 'street' => 'rua', 'number' => 'numero', 'district' => 'bairro',
        'city' => 'cidade', 'housingType' => 'tipo_moradia', 'ownership' => 'propriedade',
        'hasYard' => 'tem_quintal', 'hasScreens' => 'tem_telas', 'residents' => 'moradores',
        'hasChildren' => 'tem_criancas', 'otherPets' => 'outros_animais', 'hoursAlone' => 'horas_sozinho',
        'experience' => 'experiencia', 'motivation' => 'motivacao', 'consent' => 'consentimento',
    ];
    private const BOOLEANOS = ['tem_quintal', 'tem_telas', 'tem_criancas', 'consentimento'];
    private const INTEIROS  = ['moradores', 'horas_sozinho'];

    // ------------------------------------------------------------------
    // Conversão banco <-> interface
    // ------------------------------------------------------------------

    public function paraApi(array $linha, array $documentos = []): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::MAPA as $api => $col) {
            $valor = $linha[$col] ?? null;
            if (in_array($col, self::BOOLEANOS, true)) {
                $valor = (bool) $valor;
            } elseif (in_array($col, self::INTEIROS, true)) {
                $valor = $valor === null ? null : (int) $valor;
            } elseif ($col === 'cpf') {
                $valor = Documento::formataCpf((string) $valor);
            } elseif ($valor === null) {
                $valor = '';
            }
            $out[$api] = $valor;
        }
        $out['createdAt'] = substr((string) ($linha['criado_em'] ?? ''), 0, 10);
        $out['documents'] = $documentos;
        return $out;
    }

    public function doApi(array $dados): array
    {
        $out = [];
        foreach (self::MAPA as $api => $col) {
            if (!array_key_exists($api, $dados)) {
                continue;
            }
            $valor = is_string($dados[$api]) ? trim($dados[$api]) : $dados[$api];
            if (in_array($col, self::BOOLEANOS, true)) {
                $valor = $valor ? 1 : 0;
            } elseif ($col === 'cpf') {
                $valor = Documento::digitos((string) $valor);
            } elseif ($valor === '' || $valor === null) {
                $valor = null;
            } elseif (in_array($col, self::INTEIROS, true)) {
                $valor = (int) $valor;
            }
            $out[$col] = $valor;
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Consultas (sempre sem os excluídos)
    // ------------------------------------------------------------------

    public function ativo(int $id): ?array
    {
        $stmt = $this->db()->prepare('SELECT * FROM adotantes WHERE id = :id AND excluido_em IS NULL LIMIT 1');
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    public function listarParaApi(): array
    {
        $linhas = $this->db()->query('SELECT * FROM adotantes WHERE excluido_em IS NULL ORDER BY nome')->fetchAll();
        $docs = $this->documentosPorAdotante(array_column($linhas, 'id'));
        return array_map(fn ($l) => $this->paraApi($l, $docs[(int) $l['id']] ?? []), $linhas);
    }

    public function comDocumentos(int $id): ?array
    {
        $linha = $this->ativo($id);
        if (!$linha) {
            return null;
        }
        return $this->paraApi($linha, $this->documentosPorAdotante([$id])[$id] ?? []);
    }

    /** CPF (só dígitos) já usado por outro adotante ativo? */
    public function cpfEmUso(string $cpf, ?int $ignorarId = null): bool
    {
        $stmt = $this->db()->prepare(
            'SELECT id FROM adotantes WHERE cpf = :cpf AND (:ign IS NULL OR id <> :ign2) LIMIT 1'
        );
        $stmt->execute([':cpf' => $cpf, ':ign' => $ignorarId, ':ign2' => $ignorarId]);
        return (bool) $stmt->fetchColumn();
    }

    public function excluir(int $id, ?int $usuarioId): void
    {
        $this->db()->prepare(
            'UPDATE adotantes SET excluido_em = NOW(), excluido_por = :u WHERE id = :id AND excluido_em IS NULL'
        )->execute([':u' => $usuarioId, ':id' => $id]);
    }

    // ------------------------------------------------------------------
    // Documentos
    // ------------------------------------------------------------------

    private function pastaDocumentos(): string
    {
        return rtrim((string) Config::get('uploads.pasta'), '/\\') . '/adotantes';
    }

    /** Documentos ativos: [adotanteId => [ {id, name, type, size, uploadedBy, uploadedAt, url}, ... ]] */
    public function documentosPorAdotante(array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return [];
        }
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db()->prepare(
            "SELECT d.*, u.nome AS enviado_nome
               FROM documentos_adotante d
               LEFT JOIN usuarios u ON u.id = d.enviado_por
              WHERE d.adotante_id IN ({$marcas}) AND d.removido_em IS NULL
              ORDER BY d.criado_em, d.id"
        );
        $stmt->execute($ids);
        $saida = [];
        foreach ($stmt->fetchAll() as $d) {
            $saida[(int) $d['adotante_id']][] = [
                'id'         => (int) $d['id'],
                'name'       => $d['nome_original'],
                'type'       => $d['tipo'],
                'size'       => (int) $d['tamanho'],
                'uploadedBy' => $d['enviado_nome'],
                'uploadedAt' => $d['criado_em'],
                // a interface completa com o endereço do sistema (Api.base + '/api')
                'path'       => "/adotantes/{$d['adotante_id']}/documentos/{$d['id']}",
            ];
        }
        return $saida;
    }

    public function contarDocumentos(int $adotanteId): int
    {
        $stmt = $this->db()->prepare(
            'SELECT COUNT(*) FROM documentos_adotante WHERE adotante_id = :a AND removido_em IS NULL'
        );
        $stmt->execute([':a' => $adotanteId]);
        return (int) $stmt->fetchColumn();
    }

    public function documento(int $adotanteId, int $docId): ?array
    {
        $stmt = $this->db()->prepare(
            'SELECT * FROM documentos_adotante WHERE id = :id AND adotante_id = :a AND removido_em IS NULL LIMIT 1'
        );
        $stmt->execute([':id' => $docId, ':a' => $adotanteId]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Salva um documento enviado como data URL. Confere o tipo pelo conteúdo do
     * arquivo (não pelo nome) e o tamanho. Lança \InvalidArgumentException
     * (dado inválido) ou \RuntimeException (pasta sem permissão de gravação).
     */
    public function salvarDocumento(int $adotanteId, string $nome, string $dataUrl, ?int $usuarioId): int
    {
        $cfg = (array) Config::get('uploads.documentos', []);
        if (!preg_match('#^data:[^;,]*;base64,(.+)$#s', $dataUrl, $m)) {
            throw new \InvalidArgumentException('Arquivo em formato inválido.');
        }
        $bytes = base64_decode($m[1], true);
        if ($bytes === false || $bytes === '') {
            throw new \InvalidArgumentException('Arquivo corrompido.');
        }
        if (strlen($bytes) > (int) ($cfg['max_bytes'] ?? 5 * 1024 * 1024)) {
            throw new \InvalidArgumentException('O arquivo passou de 5 MB.');
        }
        $tipo = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';
        $extensoes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'application/pdf' => 'pdf'];
        if (!in_array($tipo, (array) ($cfg['tipos'] ?? []), true) || !isset($extensoes[$tipo])) {
            throw new \InvalidArgumentException('Envie uma imagem (JPG, PNG, WEBP) ou um PDF.');
        }

        $pasta = $this->pastaDocumentos();
        $arquivo = sprintf('%d-%s.%s', $adotanteId, bin2hex(random_bytes(8)), $extensoes[$tipo]);
        if ((!is_dir($pasta) && !@mkdir($pasta, 0775, true))
            || @file_put_contents($pasta . '/' . $arquivo, $bytes) === false) {
            throw new \RuntimeException('Não foi possível salvar o documento: confira se a pasta storage/uploads/adotantes pode ser gravada.');
        }

        $nome = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', $nome)) ?: 'documento.' . $extensoes[$tipo];
        $stmt = $this->db()->prepare(
            'INSERT INTO documentos_adotante (adotante_id, nome_original, arquivo, tipo, tamanho, enviado_por)
             VALUES (:a, :n, :f, :t, :s, :u)'
        );
        $stmt->execute([
            ':a' => $adotanteId, ':n' => mb_substr($nome, 0, 160), ':f' => $arquivo,
            ':t' => $tipo, ':s' => strlen($bytes), ':u' => $usuarioId,
        ]);
        return (int) $this->db()->lastInsertId();
    }

    /** Caminho do arquivo no disco (ou null se sumiu). */
    public function arquivoDoDocumento(array $doc): ?string
    {
        $caminho = $this->pastaDocumentos() . '/' . basename((string) $doc['arquivo']);
        return is_file($caminho) ? $caminho : null;
    }

    public function removerDocumento(int $docId, ?int $usuarioId): void
    {
        $this->db()->prepare(
            'UPDATE documentos_adotante SET removido_em = NOW(), removido_por = :u WHERE id = :id AND removido_em IS NULL'
        )->execute([':u' => $usuarioId, ':id' => $docId]);
    }
}
