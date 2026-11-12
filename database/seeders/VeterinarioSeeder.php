<?php

namespace Database\Seeders;

use App\Models\Veterinario;
use Illuminate\Database\Seeder;

/**
 * Veterinários de exemplo — os mesmos nomes que já aparecem nas vacinas e no histórico dos animais
 * e na equipe (VoluntarioSeeder). Números de CRMV fictícios.
 */
class VeterinarioSeeder extends Seeder
{
    public function run(): void
    {
        $vets = [
            [1, 'Dra. Marina Lopes', '12345', '(42) 99654-8899', 'marina.lopes@email.com', 'Clínica geral', 'Voluntário(a)', 'Atende os animais da organização às terças e quintas pela manhã.'],
            [2, 'Dr. Henrique Farias', '23456', '(42) 99545-1010', 'henrique.farias@email.com', 'Felinos', 'Voluntário(a)', 'Atende às segundas e sextas à tarde.'],
        ];

        foreach ($vets as [$id, $nome, $crmv, $telefone, $email, $especialidade, $vinculo, $obs]) {
            (new Veterinario)->forceFill([
                'id' => $id, 'nome' => $nome, 'crmv' => $crmv, 'crmv_uf' => 'PR', 'telefone' => $telefone, 'email' => $email,
                'especialidade' => $especialidade, 'vinculo' => $vinculo, 'observacoes' => $obs, 'ativo' => true,
            ])->save();
        }
    }
}
