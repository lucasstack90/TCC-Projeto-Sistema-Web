<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/** Tabelas de apoio: orçamento, saldo inicial, categorias do estoque e dados do relatório (exemplo). */
class ConfiguracaoSeeder extends Seeder
{
    public function run(): void
    {
        $agora = now();

        $orcamento = [
            'Veterinário' => 600, 'Medicamentos' => 200, 'Ração e alimentação' => 400, 'Higiene e limpeza' => 100,
            'Transporte' => 150, 'Manutenção' => 100, 'Outros' => 100,
        ];
        foreach ($orcamento as $categoria => $valor) {
            DB::table('orcamentos')->insert(['categoria' => $categoria, 'valor_mensal' => $valor, 'created_at' => $agora, 'updated_at' => $agora]);
        }

        DB::table('configuracoes_financeiras')->insert([
            'saldo_inicial' => 400, 'data_inicio' => '2026-08-01', 'created_at' => $agora, 'updated_at' => $agora,
        ]);

        foreach (['Ração', 'Medicamento', 'Vacina', 'Higiene e limpeza', 'Utensílio'] as $nome) {
            DB::table('categorias_estoque')->insert(['nome' => $nome, 'created_at' => $agora, 'updated_at' => $agora]);
        }

        DB::table('configuracoes_relatorio')->insert([
            'organizacao' => json_encode([
                'name' => 'Associação de Proteção Animal (exemplo)', 'cnpj' => '00.000.000/0001-00',
                'address' => 'Rua XV de Novembro, 1000 — Centro', 'city' => 'Guarapuava - PR',
                'phone' => '(42) 3000-0000', 'email' => 'contato@ong-exemplo.org.br',
                'legalRep' => 'Renata Oliveira', 'legalRole' => 'Presidente',
            ], JSON_UNESCAPED_UNICODE),
            'parceria' => json_encode([
                'publicFunding' => true, 'instrument' => 'Termo de Colaboração nº 000/2026 (exemplo)',
                'grantor' => 'Prefeitura Municipal de Guarapuava — Secretaria Municipal de Meio Ambiente',
                'object' => 'Resgate, tratamento veterinário e encaminhamento para adoção responsável de cães e gatos em situação de vulnerabilidade.',
                'start' => '2026-01-01', 'end' => '2026-12-31',
            ], JSON_UNESCAPED_UNICODE),
            'metas' => json_encode(['rescues' => 2, 'adoptions' => 2, 'vaccines' => 4, 'healthCare' => 3]),
            'veterinario_id' => 1, // Dra. Marina Lopes (VeterinarioSeeder) assina junto com o responsável legal
            'created_at' => $agora, 'updated_at' => $agora,
        ]);
    }
}
