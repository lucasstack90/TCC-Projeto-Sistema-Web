<?php

namespace Core;

/**
 * Mapa de permissões por perfil — a ÚNICA fonte da regra de acesso do sistema.
 *
 * O back-end usa este mapa para proteger as rotas da API (middleware
 * ExigirPermissao) e devolve a lista de permissões no login; a interface só
 * esconde menus e botões com base nessa lista. Para mudar o que um perfil pode
 * fazer, altere só este arquivo.
 *
 * Perfis:
 *   funcionario  equipe administrativa da ONG — acesso total, gerencia usuários
 *   veterinario  cuida da parte clínica: fichas (vacinas, histórico, peso),
 *                resgates, estoque e relatório técnico
 *   voluntario   apoio no dia a dia: consulta animais e registra resgates;
 *                não vê dados pessoais (adotantes, contribuintes) nem finanças
 */
final class Permissoes
{
    public const FUNCIONARIO = 'funcionario';
    public const VETERINARIO = 'veterinario';
    public const VOLUNTARIO  = 'voluntario';

    public const PERFIS = [self::FUNCIONARIO, self::VETERINARIO, self::VOLUNTARIO];

    /** Nome para exibir na interface. */
    public const ROTULOS = [
        self::FUNCIONARIO => 'Funcionário(a)',
        self::VETERINARIO => 'Veterinário(a)',
        self::VOLUNTARIO  => 'Voluntário(a)',
    ];

    /**
     * Permissões de cada perfil.
     * "pagina.X" libera a tela X no menu; as demais liberam ações.
     */
    private const MAPA = [
        self::FUNCIONARIO => ['*'], // tudo

        self::VETERINARIO => [
            'pagina.dashboard', 'pagina.animais', 'pagina.resgates',
            'pagina.estoque', 'pagina.relatorios',
            'animais.registros',   // vacinas, histórico e pesagens
            'veterinarios.ver',
        ],

        self::VOLUNTARIO => [
            'pagina.dashboard', 'pagina.animais', 'pagina.resgates',
        ],
    ];

    /** Todas as permissões existentes (o "*" do funcionário expande para esta lista). */
    public const TODAS = [
        'pagina.dashboard', 'pagina.animais', 'pagina.adocoes', 'pagina.resgates',
        'pagina.voluntarios', 'pagina.doacoes', 'pagina.estoque', 'pagina.relatorios',
        'pagina.cadastros',
        'animais.cadastrar',     // cadastrar, editar e excluir animais
        'animais.registros',     // vacinas, histórico e pesagens
        'veterinarios.ver',
        'contribuintes.ver',     // dados pessoais (CPF/CNPJ) — LGPD
        'cadastros.gerenciar',   // criar/editar veterinários e contribuintes
        'usuarios.gerenciar',
        'financeiro.ver',        // valores e saldo (inclusive no dashboard)
    ];

    /** Lista de permissões do perfil (já expandida). */
    public static function doPerfil(?string $perfil): array
    {
        $lista = self::MAPA[$perfil] ?? [];
        return in_array('*', $lista, true) ? self::TODAS : $lista;
    }

    public static function pode(?string $perfil, string $permissao): bool
    {
        return in_array($permissao, self::doPerfil($perfil), true);
    }
}
