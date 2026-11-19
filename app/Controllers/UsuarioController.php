<?php

namespace Controllers;

use Core\Controller;
use Core\Permissoes;
use Core\Validator;
use Models\Usuario;

/**
 * Gestão dos usuários do sistema (só o perfil administrador).
 *   GET    /api/usuarios        index
 *   POST   /api/usuarios        store
 *   PUT    /api/usuarios/{id}   update   (senha opcional: em branco mantém a atual)
 *   DELETE /api/usuarios/{id}   destroy
 *
 * Travas: ninguém exclui, desativa ou rebaixa a própria conta, e o sistema nunca
 * fica sem pelo menos um administrador ativo.
 */
final class UsuarioController extends Controller
{
    private Usuario $usuarios;

    public function __construct()
    {
        parent::__construct();
        $this->usuarios = new Usuario();
    }

    public function index(): void
    {
        $this->ok([
            'usuarios' => $this->usuarios->listarParaApi(),
            'perfis'   => array_map(
                fn ($p) => ['valor' => $p, 'rotulo' => Permissoes::ROTULOS[$p]],
                Permissoes::PERFIS
            ),
        ]);
    }

    public function store(): void
    {
        $dados = $this->req->todos();
        $this->validar($dados, null, senhaObrigatoria: true);

        $id = $this->usuarios->criar([
            'nome'       => trim((string) $dados['nome']),
            'email'      => mb_strtolower(trim((string) $dados['email'])),
            'senha_hash' => Usuario::hash((string) $dados['senha']),
            'perfil'     => $dados['perfil'],
            'ativo'      => 1,
        ]);
        $this->ok($this->usuarios->paraApi($this->usuarios->encontrar($id)), 201);
    }

    public function update(string $id): void
    {
        $id = (int) $id;
        $atual = $this->usuarios->encontrar($id);
        if (!$atual) {
            $this->erro('Usuário não encontrado.', 404);
        }

        $dados = $this->req->todos();
        $this->validar($dados, $id, senhaObrigatoria: false);

        $ativo = array_key_exists('ativo', $dados) ? (bool) $dados['ativo'] : (bool) $atual['ativo'];
        $eu = (int) ($this->usuario()['id'] ?? 0) === $id;

        if ($eu && ($dados['perfil'] !== $atual['perfil'] || !$ativo)) {
            $this->erro('Você não pode mudar o próprio perfil nem desativar a própria conta.', 422);
        }
        $deixaDeSerAdmin = $atual['perfil'] === Permissoes::ADMINISTRADOR
            && ($dados['perfil'] !== Permissoes::ADMINISTRADOR || !$ativo);
        if ($deixaDeSerAdmin && $this->usuarios->administradoresAtivos($id) === 0) {
            $this->erro('O sistema precisa de pelo menos um administrador ativo.', 422);
        }

        $alteracoes = [
            'nome'   => trim((string) $dados['nome']),
            'email'  => mb_strtolower(trim((string) $dados['email'])),
            'perfil' => $dados['perfil'],
            'ativo'  => $ativo ? 1 : 0,
        ];
        if (!empty($dados['senha'])) {
            $alteracoes['senha_hash'] = Usuario::hash((string) $dados['senha']);
        }
        $this->usuarios->atualizar($id, $alteracoes);
        $this->ok($this->usuarios->paraApi($this->usuarios->encontrar($id)));
    }

    public function destroy(string $id): void
    {
        $id = (int) $id;
        $atual = $this->usuarios->encontrar($id);
        if (!$atual) {
            $this->erro('Usuário não encontrado.', 404);
        }
        if ((int) ($this->usuario()['id'] ?? 0) === $id) {
            $this->erro('Você não pode excluir a própria conta.', 422);
        }
        if ($atual['perfil'] === Permissoes::ADMINISTRADOR && (int) $atual['ativo'] === 1
            && $this->usuarios->administradoresAtivos($id) === 0) {
            $this->erro('O sistema precisa de pelo menos um administrador ativo.', 422);
        }
        $this->usuarios->remover($id);
        $this->ok(['removido' => $id]);
    }

    private function validar(array $dados, ?int $id, bool $senhaObrigatoria): void
    {
        $v = new Validator($dados);
        $v->obrigatorio('nome', 'Nome')->texto('nome', 3, 120);
        $v->obrigatorio('email', 'E-mail')->email('email');
        $v->obrigatorio('perfil', 'Perfil')->umDe('perfil', Permissoes::PERFIS);
        if ($senhaObrigatoria) {
            $v->obrigatorio('senha', 'Senha');
        }
        $v->texto('senha', 8, 72);
        if ($v->falhou()) {
            $this->erro('Há campos para corrigir.', 422, $v->erros());
        }
        if ($this->usuarios->emailEmUso((string) $dados['email'], $id)) {
            $this->erro('Este e-mail já é usado por outro usuário.', 422, [
                'email' => 'E-mail já cadastrado.',
            ]);
        }
    }
}
