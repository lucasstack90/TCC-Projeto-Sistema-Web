<?php

namespace Models;

use Core\Config;
use Core\Model;

/**
 * Animais abrigados.
 *
 * As colunas do banco ficam em português (nome, especie, ...). A interface já
 * usa chaves em inglês (name, species, ...), herdadas do protótipo; por isso o
 * model traduz nos dois sentidos (paraApi / doApi).
 *
 * Exclusão lógica: excluir marca "excluido_em" — o animal some das listas, mas a
 * ficha clínica, as adoções e as despesas ligadas a ele continuam guardadas.
 *
 * Foto: a coluna "foto" guarda uma URL externa (dados de exemplo) ou
 * "upload:<arquivo>" para uma foto enviada, salva em storage/uploads/animais/
 * (fora da pasta pública) e servida por GET /api/animais/{id}/foto.
 */
final class Animal extends Model
{
    protected string $tabela = 'animais';
    protected array $preenchivel = [
        'nome', 'especie', 'raca', 'cor', 'idade', 'data_chegada',
        'sexo', 'porte', 'status', 'foto', 'peso',
        'vacinado', 'castrado', 'microchip', 'observacoes',
    ];

    public const STATUS   = ['Disponível', 'Adotado', 'Em Tratamento', 'Resgatado', 'Em Lar Temporário'];
    public const ESPECIES = ['Cão', 'Gato', 'Outros'];
    public const SEXOS    = ['Macho', 'Fêmea', 'Não identificado'];
    public const PORTES   = ['Pequeno', 'Médio', 'Grande'];

    /** chave da API (inglês) => coluna do banco (português) */
    private const MAPA = [
        'name'       => 'nome',
        'species'    => 'especie',
        'breed'      => 'raca',
        'color'      => 'cor',
        'age'        => 'idade',
        'arrival'    => 'data_chegada',
        'sex'        => 'sexo',
        'size'       => 'porte',
        'status'     => 'status',
        'weight'     => 'peso',
        'vaccinated' => 'vacinado',
        'neutered'   => 'castrado',
        'chip'       => 'microchip',
        'notes'      => 'observacoes',
    ];

    // ------------------------------------------------------------------
    // Conversão banco <-> interface
    // ------------------------------------------------------------------

    /** Converte uma linha do banco para o formato que a interface espera. */
    public function paraApi(array $linha): array
    {
        $out = ['id' => (int) $linha['id']];
        foreach (self::MAPA as $api => $col) {
            $valor = $linha[$col] ?? null;
            if (in_array($col, ['vacinado', 'castrado', 'microchip'], true)) {
                $valor = (bool) $valor;
            } elseif ($col === 'peso' && $valor !== null) {
                $valor = (float) $valor;
            }
            $out[$api] = $valor;
        }
        // Foto enviada: a interface monta a URL completa a partir de photoPath.
        $foto = (string) ($linha['foto'] ?? '');
        if (str_starts_with($foto, 'upload:')) {
            $out['photo'] = '';
            $out['photoPath'] = '/animais/' . (int) $linha['id'] . '/foto?v=' . substr(md5($foto), 0, 8);
        } else {
            $out['photo'] = $foto;
        }
        return $out;
    }

    /** Converte o corpo vindo da interface para colunas do banco (sem a foto). */
    public function doApi(array $dados): array
    {
        $out = [];
        foreach (self::MAPA as $api => $col) {
            if (!array_key_exists($api, $dados)) {
                continue;
            }
            $valor = $dados[$api];
            if (in_array($col, ['vacinado', 'castrado', 'microchip'], true)) {
                $valor = $valor ? 1 : 0;
            } elseif ($valor === '') {
                $valor = null;
            }
            $out[$col] = $valor;
        }
        return $out;
    }

    // ------------------------------------------------------------------
    // Consultas (sempre sem os excluídos)
    // ------------------------------------------------------------------

    /** Busca um animal que não foi excluído. */
    public function ativo(int $id): ?array
    {
        $stmt = $this->db()->prepare('SELECT * FROM animais WHERE id = :id AND excluido_em IS NULL LIMIT 1');
        $stmt->execute([':id' => $id]);
        return $stmt->fetch() ?: null;
    }

    /**
     * Lista no formato da interface, já com vacinas, histórico e pesagens
     * (as outras telas — dashboard, relatório — usam esses dados).
     */
    public function listarParaApi(): array
    {
        $linhas = $this->db()->query('SELECT * FROM animais WHERE excluido_em IS NULL ORDER BY id DESC')->fetchAll();
        $registros = (new RegistroClinico())->porAnimais(array_column($linhas, 'id'));
        return array_map(fn ($l) => $this->paraApi($l) + $registros[(int) $l['id']], $linhas);
    }

    /** Um animal com as coleções relacionadas (vacinas, histórico, pesagens). */
    public function comDetalhes(int $id): ?array
    {
        $linha = $this->ativo($id);
        if (!$linha) {
            return null;
        }
        $registros = (new RegistroClinico())->porAnimais([$id]);
        return $this->paraApi($linha) + $registros[$id];
    }

    /** Exclusão lógica (guarda quem excluiu). */
    public function excluir(int $id, ?int $usuarioId): int
    {
        $stmt = $this->db()->prepare(
            'UPDATE animais SET excluido_em = NOW(), excluido_por = :u WHERE id = :id AND excluido_em IS NULL'
        );
        $stmt->execute([':u' => $usuarioId, ':id' => $id]);
        return $stmt->rowCount();
    }

    /**
     * Recalcula os campos da ficha que dependem dos registros clínicos:
     * peso atual = pesagem mais recente; vacinado = existe vacina registrada.
     * (Vacinado só é ligado aqui: a equipe pode marcar à mão um animal que
     * chegou com a carteira de vacinação.)
     */
    public function sincronizarComRegistros(int $id): void
    {
        $db = $this->db();
        $peso = $db->prepare(
            'SELECT peso FROM pesagens WHERE animal_id = :id AND removido_em IS NULL ORDER BY data DESC, id DESC LIMIT 1'
        );
        $peso->execute([':id' => $id]);
        $atual = $peso->fetchColumn();

        $vac = $db->prepare('SELECT COUNT(*) FROM vacinas WHERE animal_id = :id AND removido_em IS NULL');
        $vac->execute([':id' => $id]);
        $temVacina = (int) $vac->fetchColumn() > 0;

        $sql = 'UPDATE animais SET peso = :peso' . ($temVacina ? ', vacinado = 1' : '') . ' WHERE id = :id';
        $db->prepare($sql)->execute([':peso' => $atual === false ? null : $atual, ':id' => $id]);
    }

    /** Marca o animal como castrado (registro de castração no histórico). */
    public function marcarCastrado(int $id): void
    {
        $this->db()->prepare('UPDATE animais SET castrado = 1 WHERE id = :id')->execute([':id' => $id]);
    }

    // ------------------------------------------------------------------
    // Foto
    // ------------------------------------------------------------------

    private function pastaFotos(): string
    {
        return rtrim((string) Config::get('uploads.pasta'), '/\\') . '/animais';
    }

    /**
     * Salva a foto enviada como data URL (a interface já reduz a imagem) e
     * devolve o valor da coluna "foto". Lança \InvalidArgumentException se o
     * arquivo não for uma imagem aceita ou passar do tamanho.
     */
    public function salvarFoto(int $id, string $dataUrl): string
    {
        if (!preg_match('#^data:(image/[a-z+.-]+);base64,(.+)$#s', $dataUrl, $m)) {
            throw new \InvalidArgumentException('Formato de imagem inválido.');
        }
        $bytes = base64_decode($m[2], true);
        if ($bytes === false) {
            throw new \InvalidArgumentException('Imagem corrompida.');
        }
        if (strlen($bytes) > (int) Config::get('uploads.max_bytes', 4 * 1024 * 1024)) {
            throw new \InvalidArgumentException('A imagem passou do tamanho máximo.');
        }
        // Confere o tipo pelo conteúdo do arquivo, não pelo que o navegador disse.
        $tipo = (new \finfo(FILEINFO_MIME_TYPE))->buffer($bytes) ?: '';
        $extensoes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
        if (!in_array($tipo, (array) Config::get('uploads.tipos', []), true) || !isset($extensoes[$tipo])) {
            throw new \InvalidArgumentException('Use uma imagem JPG, PNG ou WEBP.');
        }

        $pasta = $this->pastaFotos();
        $arquivo = sprintf('%d-%s.%s', $id, bin2hex(random_bytes(6)), $extensoes[$tipo]);
        if ((!is_dir($pasta) && !@mkdir($pasta, 0775, true))
            || @file_put_contents($pasta . '/' . $arquivo, $bytes) === false) {
            throw new \RuntimeException('Não foi possível salvar a foto: confira se a pasta storage/uploads/animais pode ser gravada.');
        }
        return 'upload:' . $arquivo;
    }

    /** Caminho do arquivo da foto enviada (ou null se o animal não tem). */
    public function arquivoDaFoto(array $linha): ?string
    {
        $foto = (string) ($linha['foto'] ?? '');
        if (!str_starts_with($foto, 'upload:')) {
            return null;
        }
        $caminho = $this->pastaFotos() . '/' . basename(substr($foto, 7));
        return is_file($caminho) ? $caminho : null;
    }

    /** Apaga do disco a foto enviada anteriormente (ao trocar ou remover). */
    public function apagarArquivoDaFoto(array $linha): void
    {
        $arquivo = $this->arquivoDaFoto($linha);
        if ($arquivo) {
            @unlink($arquivo);
        }
    }
}
