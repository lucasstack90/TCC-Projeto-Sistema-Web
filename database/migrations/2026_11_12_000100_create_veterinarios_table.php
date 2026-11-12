<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cadastro de veterinários (módulo de Animais).
 * Antes o nome do veterinário era digitado à mão em cada vacina e evento do histórico.
 * Agora a vacina/evento aponta para o cadastro (veterinario_id) e a coluna de texto
 * continua guardando o nome usado na época (o histórico não muda se o cadastro for editado).
 *
 * O cadastro também é usado no Relatório técnico: o(a) veterinário(a) responsável técnico(a)
 * assina o relatório junto com o responsável legal da organização.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('veterinarios', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 120);
            $table->string('crmv', 10);                    // número do registro no Conselho
            $table->char('crmv_uf', 2)->default('PR');     // estado do Conselho Regional
            $table->string('telefone', 20)->nullable();
            $table->string('email', 150)->nullable();
            $table->string('clinica', 120)->nullable();    // clínica ou hospital onde atende
            $table->string('especialidade', 80)->nullable();
            $table->enum('vinculo', ['Equipe da organização', 'Voluntário(a)', 'Clínica parceira', 'Serviço público'])
                ->default('Clínica parceira');
            $table->text('observacoes')->nullable();
            // Inativar em vez de excluir: vacinas antigas continuam apontando para o cadastro.
            $table->boolean('ativo')->default(true);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['crmv_uf', 'crmv']); // o mesmo CRMV não pode ser cadastrado duas vezes
            $table->index(['ativo', 'nome']);
        });

        Schema::table('animal_vacinas', function (Blueprint $table) {
            $table->foreignId('veterinario_id')->nullable()->after('veterinario')
                ->constrained('veterinarios')->nullOnDelete();
        });

        Schema::table('animal_historicos', function (Blueprint $table) {
            $table->foreignId('veterinario_id')->nullable()->after('responsavel')
                ->constrained('veterinarios')->nullOnDelete();
        });

        // Relatório técnico: veterinário(a) responsável técnico(a) que assina junto com o responsável legal.
        Schema::table('configuracoes_relatorio', function (Blueprint $table) {
            $table->foreignId('veterinario_id')->nullable()->after('metas')
                ->constrained('veterinarios')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('configuracoes_relatorio', fn (Blueprint $table) => $table->dropConstrainedForeignId('veterinario_id'));
        Schema::table('animal_historicos', fn (Blueprint $table) => $table->dropConstrainedForeignId('veterinario_id'));
        Schema::table('animal_vacinas', fn (Blueprint $table) => $table->dropConstrainedForeignId('veterinario_id'));
        Schema::dropIfExists('veterinarios');
    }
};
