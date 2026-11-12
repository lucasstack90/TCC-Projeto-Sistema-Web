<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * php artisan migrate --seed   (ou: php artisan db:seed)
 * Dados de demonstração para a apresentação do TCC.
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            VoluntarioSeeder::class,
            UsuarioSeeder::class,
            VeterinarioSeeder::class, // antes dos animais: as vacinas de exemplo apontam para eles
            AnimalSeeder::class,
            ConfiguracaoSeeder::class,
        ]);
    }
}
