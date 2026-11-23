<?php

namespace Controllers;

use Core\Controller;
use Core\Database;
use Core\Validator;
use Models\Animal;
use Models\RegistroClinico;
use Models\Veterinario;

/**
 * API REST do módulo de Animais — o módulo de referência do sistema.
 *
 * Rotas (ver routes/web.php):
 *   GET    /api/animais                        index   lista (com vacinas, histórico e pesagens)
 *   GET    /api/animais/{id}                   show    um animal com os registros
 *   GET    /api/animais/{id}/foto              foto    a foto enviada (fica fora da pasta pública)
 *   POST   /api/animais                        store   cria                 (animais.cadastrar)
 *   PUT    /api/animais/{id}                   update  edita                (animais.cadastrar)
 *   DELETE /api/animais/{id}                   destroy exclusão lógica      (animais.cadastrar)
 *   PATCH  /api/animais/{id}/status            status  muda só o status     (animais.cadastrar — usado em Adoções)
 *   POST   /api/animais/{id}/{tipo}            registrar  vacina, histórico ou pesagem   (animais.registros)
 *   PUT    /api/animais/{id}/{tipo}/{rid}      corrigir   corrige um registro            (animais.registros)
 *   DELETE /api/animais/{id}/{tipo}/{rid}      removerRegistro  remove (fica guardado)  (animais.registros)
 *   {tipo} = vacinas | historico | pesagens
 */
final class AnimalController extends Controller
{
    private Animal $animais;
    private RegistroClinico $registros;

    public function __construct()
    {
        parent::__construct();
        $this->animais = new Animal();
        $this->registros = new RegistroClinico();
    }

    private function usuarioId(): ?int
    {
        return isset($this->usuario()['id']) ? (int) $this->usuario()['id'] : null;
    }

    private function animalOu404(string $id): array
    {
        $animal = $this->animais->ativo((int) $id);
        if (!$animal) {
            $this->erro('Animal não encontrado.', 404);
        }
        return $animal;
    }

    // ------------------------------------------------------------------
    // Animal
    // ------------------------------------------------------------------

    public function index(): void
    {
        $this->ok($this->animais->listarParaApi());
    }

    public function show(string $id): void
    {
        $this->animalOu404($id);
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados);

        $id = Database::transacao(function () use ($dados): int {
            $id = $this->animais->criar($this->animais->doApi($dados));
            $this->gravarFoto($id, null, $dados);

            $uid = $this->usuarioId();
            $hoje = date('Y-m-d');
            $this->registros->inserir('historico', $id, [
                'tipo' => 'Cadastro', 'data' => $hoje, 'descricao' => 'Animal cadastrado no sistema',
                'veterinario' => 'Equipe PAWSAFE',
            ], $uid);
            if (!empty($dados['weight'])) {
                $this->registros->inserir('pesagens', $id, [
                    'peso' => $dados['weight'], 'data' => $dados['arrival'] ?: $hoje, 'nota' => 'Peso inicial',
                ], $uid);
            }
            // Cadastro vindo de um resgate: registra a origem no histórico.
            $resgate = $dados['rescue'] ?? null;
            if (is_array($resgate) && !empty($resgate['code'])) {
                $this->registros->inserir('historico', $id, [
                    'tipo' => 'Resgate',
                    'data' => $this->dataValidaOuHoje($resgate['date'] ?? ''),
                    'descricao' => mb_substr('Resgate ' . $resgate['code'] . ' — ' . ($resgate['district'] ?? ''), 0, 255),
                    'veterinario' => mb_substr((string) ($resgate['responsible'] ?? ''), 0, 120) ?: null,
                    'observacoes' => mb_substr((string) ($resgate['description'] ?? ''), 0, 2000) ?: null,
                ], $uid);
            }
            return $id;
        });
        $this->ok($this->animais->comDetalhes($id), 201);
    }

    public function update(string $id): void
    {
        $atual = $this->animalOu404($id);
        $dados = $this->req->todos();
        $this->validar($dados);

        // Pesagem, ficha e foto são gravadas juntas: se algo falhar, nada muda.
        Database::transacao(function () use ($id, $atual, $dados): void {
            // Peso mudado na edição da ficha vira uma pesagem (o peso atual sai dela).
            $novoPeso = isset($dados['weight']) && $dados['weight'] !== '' && $dados['weight'] !== null ? (float) $dados['weight'] : null;
            if ($novoPeso !== null && ($atual['peso'] === null || abs((float) $atual['peso'] - $novoPeso) > 0.001)) {
                $this->registros->inserir('pesagens', (int) $id, [
                    'peso' => $novoPeso, 'data' => date('Y-m-d'), 'nota' => 'Peso atualizado na ficha',
                ], $this->usuarioId());
            }
            $this->animais->atualizar((int) $id, $this->animais->doApi($dados));
            $this->gravarFoto((int) $id, $atual, $dados);
        });
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    public function destroy(string $id): void
    {
        $this->animalOu404($id);
        $this->animais->excluir((int) $id, $this->usuarioId());
        $this->ok(['removido' => (int) $id]);
    }

    /** Usado pelo módulo de Adoções ao concluir uma adoção. */
    public function status(string $id): void
    {
        $this->animalOu404($id);
        $v = new Validator($this->req->todos());
        $v->obrigatorio('status', 'Status')->umDe('status', Animal::STATUS);
        if ($v->falhou()) {
            $this->erro('Status inválido.', 422, $v->erros());
        }
        $this->animais->atualizar((int) $id, ['status' => $this->req->input('status')]);
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    /** Entrega a foto enviada (storage/ não é acessível direto pelo navegador). */
    public function foto(string $id): void
    {
        $animal = $this->animalOu404($id);
        $arquivo = $this->animais->arquivoDaFoto($animal);
        if (!$arquivo) {
            $this->erro('Foto não encontrada.', 404);
        }
        header('Content-Type: ' . ((new \finfo(FILEINFO_MIME_TYPE))->file($arquivo) ?: 'image/jpeg'));
        header('Content-Length: ' . filesize($arquivo));
        header('X-Content-Type-Options: nosniff');
        header('Cache-Control: private, max-age=86400');
        readfile($arquivo);
        exit;
    }

    // ------------------------------------------------------------------
    // Registros clínicos (vacinas, histórico, pesagens)
    // ------------------------------------------------------------------

    public function registrar(string $id, string $tipo): void
    {
        $this->tipoOu404($tipo);
        $this->animalOu404($id);
        $dados = $this->req->todos();
        $colunas = $this->validarRegistro($tipo, $dados);
        $colunas = $this->responsavelDoVeterinario($tipo, $colunas, novo: true);

        Database::transacao(function () use ($tipo, $id, $colunas): void {
            $this->registros->inserir($tipo, (int) $id, $colunas, $this->usuarioId());
            if ($tipo === 'historico' && ($colunas['tipo'] ?? '') === 'Castração') {
                $this->animais->marcarCastrado((int) $id);
            }
            $this->animais->sincronizarComRegistros((int) $id);
        });
        $this->ok($this->animais->comDetalhes((int) $id), 201);
    }

    public function corrigir(string $id, string $tipo, string $registroId): void
    {
        $this->tipoOu404($tipo);
        $this->animalOu404($id);
        if (!$this->registros->encontrarDoAnimal($tipo, (int) $id, (int) $registroId)) {
            $this->erro('Registro não encontrado.', 404);
        }
        $colunas = $this->validarRegistro($tipo, $this->req->todos());
        $colunas = $this->responsavelDoVeterinario($tipo, $colunas, novo: false);
        Database::transacao(function () use ($tipo, $id, $registroId, $colunas): void {
            $this->registros->corrigir($tipo, (int) $registroId, $colunas, $this->usuarioId());
            $this->animais->sincronizarComRegistros((int) $id);
        });
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    public function removerRegistro(string $id, string $tipo, string $registroId): void
    {
        $this->tipoOu404($tipo);
        $this->animalOu404($id);
        if (!$this->registros->encontrarDoAnimal($tipo, (int) $id, (int) $registroId)) {
            $this->erro('Registro não encontrado.', 404);
        }
        Database::transacao(function () use ($tipo, $id, $registroId): void {
            $this->registros->removerRegistro($tipo, (int) $registroId, $this->usuarioId());
            $this->animais->sincronizarComRegistros((int) $id);
        });
        $this->ok($this->animais->comDetalhes((int) $id));
    }

    /**
     * Perfil veterinário: o responsável pelo registro é sempre a própria conta,
     * não o que veio do formulário. Num registro novo, grava o nome do usuário
     * logado (e o cadastro de Veterinários com o mesmo nome, se houver). Numa
     * correção, o responsável original é mantido. Administrador e equipe
     * continuam escolhendo o veterinário (registram pelo profissional).
     */
    private function responsavelDoVeterinario(string $tipo, array $colunas, bool $novo): array
    {
        $usuario = $this->usuario();
        if (($usuario['perfil'] ?? '') !== 'veterinario' || $tipo === 'pesagens') {
            return $colunas;
        }
        unset($colunas['veterinario'], $colunas['veterinario_id']);
        if ($novo) {
            $cadastro = (new Veterinario())->doUsuario((string) $usuario['nome']);
            $colunas['veterinario'] = $usuario['nome'];
            $colunas['veterinario_id'] = $cadastro ? (int) $cadastro['id'] : null;
        }
        return $colunas;
    }

    private function tipoOu404(string $tipo): void
    {
        if (!isset(RegistroClinico::TIPOS[$tipo])) {
            $this->erro('Tipo de registro inválido.', 404);
        }
    }

    /** Valida o registro e devolve as colunas prontas para gravar. */
    private function validarRegistro(string $tipo, array $dados): array
    {
        $v = new Validator($dados);
        $v->obrigatorio('date', 'Data')->data('date', naoFutura: true);
        if ($tipo === 'vacinas') {
            $v->obrigatorio('name', 'Vacina')->texto('name', 2, 80);
            $v->data('next')->texto('lot', 0, 60)->texto('vet', 0, 120);
            if (!$v->falhou() && !empty($dados['next']) && $dados['next'] < $dados['date']) {
                $v->marcar('next', 'A próxima dose deve ser depois da aplicação.');
            }
        } elseif ($tipo === 'historico') {
            $v->obrigatorio('type', 'Tipo')->umDe('type', RegistroClinico::TIPOS_DE_EVENTO);
            $v->obrigatorio('description', 'Descrição')->texto('description', 2, 255);
            $v->texto('vet', 0, 120)->texto('notes', 0, 2000);
        } else {
            $v->obrigatorio('weight', 'Peso')->numero('weight', 0.01, 200);
            $v->texto('note', 0, 120);
        }
        if (!empty($dados['vetId']) && !(new Veterinario())->encontrar((int) $dados['vetId'])) {
            $v->marcar('vetId', 'Veterinário não encontrado.');
        }
        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
        return $this->registros->doApi($tipo, $dados);
    }

    // ------------------------------------------------------------------
    // Apoio
    // ------------------------------------------------------------------

    /**
     * Foto no corpo: "photo" com data URL = nova foto; "photo" = "" = remover;
     * ausente = manter a atual.
     */
    private function gravarFoto(int $id, ?array $atual, array $dados): void
    {
        if (!array_key_exists('photo', $dados)) {
            return;
        }
        $foto = (string) $dados['photo'];
        if ($foto !== '' && !str_starts_with($foto, 'data:')) {
            return; // a interface reenviou a URL atual: nada muda
        }
        try {
            $novo = $foto === '' ? null : $this->animais->salvarFoto($id, $foto);
        } catch (\InvalidArgumentException $e) {
            $this->erro($e->getMessage(), 422, ['photo' => $e->getMessage()]);
        } catch (\RuntimeException $e) {
            $this->erro($e->getMessage(), 500);
        }
        if ($atual) {
            $this->animais->apagarArquivoDaFoto($atual);
        }
        $this->animais->atualizar($id, ['foto' => $novo]);
    }

    private function dataValidaOuHoje(string $data): string
    {
        $d = \DateTime::createFromFormat('Y-m-d', $data);
        return $d && $d->format('Y-m-d') === $data ? $data : date('Y-m-d');
    }

    /**
     * Regras de validação do servidor (antes gravadas só no JavaScript).
     * Encerra a requisição com 422 se algo estiver errado.
     */
    private function validar(array $dados): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('name', 'Nome')->texto('name', 2, 80);
        $v->obrigatorio('species', 'Espécie')->umDe('species', Animal::ESPECIES);
        $v->obrigatorio('status', 'Status')->umDe('status', Animal::STATUS);
        $v->texto('breed', 0, 80)->texto('color', 0, 60)->texto('age', 0, 40);
        $v->umDe('sex', Animal::SEXOS);
        $v->umDe('size', Animal::PORTES);
        $v->obrigatorio('arrival', 'Data de chegada')->data('arrival', naoFutura: true);
        $v->numero('weight', 0, 200);
        $v->texto('notes', 0, 1000);

        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
    }
}
