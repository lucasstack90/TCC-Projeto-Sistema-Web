<?php

namespace Controllers;

use Core\Config;
use Core\Controller;
use Core\Documento;
use Core\Validator;
use Models\Adotante;

/**
 * API do cadastro de adotantes e dos documentos anexados (módulo de Adoções).
 * Todas as rotas exigem a permissão adotantes.gerenciar (administrador e equipe).
 *
 *   GET    /api/adotantes                          index
 *   GET    /api/adotantes/{id}                     show
 *   POST   /api/adotantes                          store
 *   PUT    /api/adotantes/{id}                     update
 *   DELETE /api/adotantes/{id}                     destroy           (exclusão lógica)
 *   POST   /api/adotantes/{id}/documentos          enviarDocumento   { name, file: dataURL }
 *   GET    /api/adotantes/{id}/documentos/{doc}    documento         abre o arquivo no navegador
 *   DELETE /api/adotantes/{id}/documentos/{doc}    removerDocumento  (fica guardado com quem removeu)
 *
 * Os processos de adoção ainda ficam no navegador; por isso a regra "adotante
 * com processo não pode ser excluído" é conferida na tela de Adoções.
 */
final class AdotanteController extends Controller
{
    private Adotante $adotantes;

    public function __construct()
    {
        parent::__construct();
        $this->adotantes = new Adotante();
    }

    private function usuarioId(): ?int
    {
        return isset($this->usuario()['id']) ? (int) $this->usuario()['id'] : null;
    }

    private function adotanteOu404(string $id): array
    {
        $adotante = $this->adotantes->ativo((int) $id);
        if (!$adotante) {
            $this->erro('Adotante não encontrado.', 404);
        }
        return $adotante;
    }

    public function index(): void
    {
        $this->ok($this->adotantes->listarParaApi());
    }

    public function show(string $id): void
    {
        $this->adotanteOu404($id);
        $this->ok($this->adotantes->comDocumentos((int) $id));
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados, null);
        $colunas = $this->adotantes->doApi($dados);
        $colunas['consentimento_em'] = date('Y-m-d H:i:s');
        $colunas['criado_por'] = $this->usuarioId();
        $id = $this->adotantes->criar($colunas);
        $this->ok($this->adotantes->comDocumentos($id), 201);
    }

    public function update(string $id): void
    {
        $atual = $this->adotanteOu404($id);
        $dados = $this->req->todos();
        $this->validar($dados, (int) $id);
        $colunas = $this->adotantes->doApi($dados);
        if (!(int) $atual['consentimento'] && !empty($colunas['consentimento'])) {
            $colunas['consentimento_em'] = date('Y-m-d H:i:s');
        }
        $colunas['atualizado_por'] = $this->usuarioId();
        $this->adotantes->atualizar((int) $id, $colunas);
        $this->ok($this->adotantes->comDocumentos((int) $id));
    }

    public function destroy(string $id): void
    {
        $this->adotanteOu404($id);
        $this->adotantes->excluir((int) $id, $this->usuarioId());
        $this->ok(['removido' => (int) $id]);
    }

    // ------------------------------------------------------------------
    // Documentos
    // ------------------------------------------------------------------

    public function enviarDocumento(string $id): void
    {
        $this->adotanteOu404($id);
        $limite = (int) Config::get('uploads.documentos.max_por_adotante', 5);
        if ($this->adotantes->contarDocumentos((int) $id) >= $limite) {
            $this->erro("Limite de {$limite} documentos por adotante. Remova um antes de enviar outro.", 422);
        }
        $nome = (string) $this->req->input('name', '');
        $arquivo = (string) $this->req->input('file', '');
        if ($arquivo === '') {
            $this->erro('Escolha um arquivo.', 422, ['file' => 'Escolha um arquivo.']);
        }
        try {
            $this->adotantes->salvarDocumento((int) $id, $nome, $arquivo, $this->usuarioId());
        } catch (\InvalidArgumentException $e) {
            $this->erro($e->getMessage(), 422, ['file' => $e->getMessage()]);
        } catch (\RuntimeException $e) {
            $this->erro($e->getMessage(), 500);
        }
        $this->ok($this->adotantes->comDocumentos((int) $id), 201);
    }

    /** Abre o documento no navegador (a pasta storage não é acessível direto). */
    public function documento(string $id, string $doc): void
    {
        $this->adotanteOu404($id);
        $registro = $this->adotantes->documento((int) $id, (int) $doc);
        $arquivo = $registro ? $this->adotantes->arquivoDoDocumento($registro) : null;
        if (!$arquivo) {
            $this->erro('Documento não encontrado.', 404);
        }
        $nome = str_replace(['"', "\r", "\n"], '', (string) $registro['nome_original']);
        header('Content-Type: ' . $registro['tipo']);
        header('Content-Length: ' . filesize($arquivo));
        header('Content-Disposition: inline; filename="' . $nome . '"; filename*=UTF-8\'\'' . rawurlencode($nome));
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, no-store'); // dado pessoal: não fica no cache do navegador
        readfile($arquivo);
        exit;
    }

    public function removerDocumento(string $id, string $doc): void
    {
        $this->adotanteOu404($id);
        if (!$this->adotantes->documento((int) $id, (int) $doc)) {
            $this->erro('Documento não encontrado.', 404);
        }
        $this->adotantes->removerDocumento((int) $doc, $this->usuarioId());
        $this->ok($this->adotantes->comDocumentos((int) $id));
    }

    // ------------------------------------------------------------------
    // Validação (as mesmas regras da tela, agora também no servidor)
    // ------------------------------------------------------------------

    private function validar(array $dados, ?int $id): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('name', 'Nome')->texto('name', 3, 120);
        $v->obrigatorio('cpf', 'CPF');
        $v->obrigatorio('birth', 'Data de nascimento')->data('birth', naoFutura: true);
        $v->obrigatorio('phone', 'Telefone')->texto('phone', 10, 20);
        $v->obrigatorio('email', 'E-mail')->email('email')->texto('email', 0, 160);
        $v->obrigatorio('street', 'Rua')->texto('street', 0, 120);
        $v->obrigatorio('number', 'Número')->texto('number', 0, 10);
        $v->obrigatorio('district', 'Bairro')->texto('district', 0, 80);
        $v->obrigatorio('city', 'Cidade')->texto('city', 0, 80);
        $v->obrigatorio('housingType', 'Tipo de moradia')->umDe('housingType', Adotante::MORADIAS);
        $v->obrigatorio('ownership', 'Imóvel')->umDe('ownership', Adotante::PROPRIEDADES);
        $v->obrigatorio('residents', 'Moradores')->numero('residents', 1, 20);
        $v->numero('hoursAlone', 0, 24);
        $v->texto('otherPets', 0, 200)->texto('experience', 0, 500);
        $v->obrigatorio('motivation', 'Motivação')->texto('motivation', 0, 500);

        if (empty($dados['consent'])) {
            $v->marcar('consent', 'É preciso a autorização do adotante (LGPD).');
        }
        $cpf = Documento::digitos((string) ($dados['cpf'] ?? ''));
        if ($cpf !== '' && !Documento::cpfValido($cpf)) {
            $v->marcar('cpf', 'CPF inválido.');
        } elseif ($cpf !== '' && $this->adotantes->cpfEmUso($cpf, $id)) {
            $v->marcar('cpf', 'Já existe um adotante com este CPF.');
        }
        if (!$v->falhou() && !empty($dados['birth'])) {
            $idade = (new \DateTime($dados['birth']))->diff(new \DateTime('today'))->y;
            if ($idade < 18) {
                $v->marcar('birth', 'O adotante precisa ter 18 anos ou mais.');
            }
        }
        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
    }
}
