<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Logins de demonstração. TROQUE AS SENHAS antes de usar com dados reais.
 *   Funcionária: renata.oliveira@email.com / pawsafe123  (acesso completo)
 *   Voluntário:  marcos.ribeiro@email.com  / pawsafe123  (acesso limitado)
 */
class UsuarioSeeder extends Seeder
{
    public function run(): void
    {
        User::create([
            'name' => 'Renata Oliveira',
            'email' => 'renata.oliveira@email.com',
            'password' => 'pawsafe123', // o cast "hashed" do model transforma em hash bcrypt
            'perfil' => User::FUNCIONARIO,
            'voluntario_id' => 1,
        ]);

        User::create([
            'name' => 'Marcos Ribeiro',
            'email' => 'marcos.ribeiro@email.com',
            'password' => 'pawsafe123',
            'perfil' => User::VOLUNTARIO,
            'voluntario_id' => 2,
        ]);
    }
}
