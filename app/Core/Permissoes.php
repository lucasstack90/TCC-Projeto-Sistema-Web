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
 * Os perfis descrevem a FUNÇÃO da pessoa na ONG, não o vínculo de trabalho:
 * um voluntário de confiança que conduz adoções pode receber o perfil "equipe".
 *
 *   administrador  coordenação/diretoria — tudo, inclusive o módulo de Cadastros
 *                  (usuários, veterinários, contribuintes) e a configuração do
 *                  relatório para a prefeitura
 *   financeiro     responsável pelo caixa — doações em dinheiro, despesas, saldo,
 *                  orçamento e a execução financeira do relatório
 *   equipe         operação do dia a dia — animais, adoções, resgates, estoque,
 *                  doações materiais, aprova voluntários, preenche o relatório;
 *                  não mexe no caixa
 *   veterinario    parte clínica — vacinas, histórico, pesagens, resgates,
 *                  estoque e consulta ao relatório
 *   voluntario     apoio no abrigo — consulta animais, registra resgates e dá
 *                  baixa de consumo no estoque; não vê dados pessoais nem finanças
 */
final class Permissoes
{
    public const ADMINISTRADOR = 'administrador';
    public const FINANCEIRO    = 'financeiro';
    public const EQUIPE        = 'equipe';
    public const VETERINARIO   = 'veterinario';
    public const VOLUNTARIO    = 'voluntario';

    public const PERFIS = [self::ADMINISTRADOR, self::FINANCEIRO, self::EQUIPE, self::VETERINARIO, self::VOLUNTARIO];

    /** Nome para exibir na interface. */
    public const ROTULOS = [
        self::ADMINISTRADOR => 'Administrador(a)',
        self::FINANCEIRO    => 'Financeiro',
        self::EQUIPE        => 'Equipe',
        self::VETERINARIO   => 'Veterinário(a)',
        self::VOLUNTARIO    => 'Voluntário(a)',
    ];

    /** Todas as permissões existentes (o "*" do administrador expande para esta lista). */
    public const TODAS = [
        // Páginas (itens do menu)
        'pagina.dashboard', 'pagina.animais', 'pagina.adocoes', 'pagina.resgates',
        'pagina.voluntarios', 'pagina.doacoes', 'pagina.estoque', 'pagina.relatorios',
        'pagina.cadastros',
        // Ações
        'animais.cadastrar',     // cadastrar, editar e excluir animais
        'animais.registros',     // vacinas, histórico e pesagens
        'veterinarios.ver',      // lista de veterinários (para registrar vacinas)
        'contribuintes.ver',     // lista de contribuintes, com CPF/CNPJ (LGPD)
        'veterinarios.gerenciar',  // criar/editar/excluir veterinários
        'contribuintes.gerenciar', // criar/editar/excluir contribuintes
        'usuarios.gerenciar',    // contas de acesso ao sistema
        'financeiro.gerenciar',  // caixa: doações em dinheiro, despesas, saldo, orçamento
                                 // (ver e registrar; inclusive no dashboard e no relatório)
        'doacoes.material',      // registrar doações materiais (ração, remédios, utensílios)
        'voluntarios.aprovar',   // aprovar ou arquivar inscrições
        'voluntarios.gerenciar', // cadastrar, editar, inativar e excluir voluntários
        'estoque.movimentar',    // entradas, saídas, inventário e estornos
        'estoque.consumo',       // só saída por consumo / uso em animal
        'relatorio.preencher',   // escrever a análise da equipe
        'relatorio.configurar',  // dados da ONG, metas pactuadas, responsáveis
    ];

    /** Permissões de cada perfil. */
    private const MAPA = [
        self::ADMINISTRADOR => ['*'],

        self::FINANCEIRO => [
            'pagina.dashboard', 'pagina.doacoes', 'pagina.relatorios',
            'financeiro.gerenciar', 'contribuintes.ver', 'relatorio.preencher',
        ],

        self::EQUIPE => [
            'pagina.dashboard', 'pagina.animais', 'pagina.adocoes', 'pagina.resgates',
            'pagina.voluntarios', 'pagina.doacoes', 'pagina.estoque', 'pagina.relatorios',
            'animais.cadastrar', 'animais.registros', 'veterinarios.ver', 'contribuintes.ver',
            'doacoes.material', 'voluntarios.aprovar',
            'estoque.movimentar', 'estoque.consumo', 'relatorio.preencher',
        ],

        self::VETERINARIO => [
            'pagina.dashboard', 'pagina.animais', 'pagina.resgates', 'pagina.estoque', 'pagina.relatorios',
            'animais.registros', 'veterinarios.ver', 'estoque.movimentar', 'estoque.consumo',
        ],

        self::VOLUNTARIO => [
            'pagina.dashboard', 'pagina.animais', 'pagina.resgates', 'pagina.estoque',
            'estoque.consumo',
        ],
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
