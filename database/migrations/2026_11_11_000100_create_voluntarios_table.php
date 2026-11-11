<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Voluntários e Gestão de Equipe.
 * Quem chega pelo formulário público entra como "Interessado".
 * LGPD: guarda quando a pessoa consentiu e permite anonimizar sem apagar o histórico
 * (o voluntário pode ser responsável por resgates já registrados).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('voluntarios', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 120);
            $table->string('email', 150)->unique();
            $table->string('telefone', 20);
            $table->enum('funcao', ['Voluntário', 'Coordenação', 'Veterinário(a)', 'Administração'])->default('Voluntário');
            $table->enum('status', ['Interessado', 'Ativo', 'Inativo'])->default('Interessado');
            $table->json('habilidades')->nullable();   // lista fixa: Resgate, Transporte...
            $table->text('experiencia')->nullable();
            $table->json('dias')->nullable();          // Seg, Ter...
            $table->json('turnos')->nullable();        // Manhã, Tarde, Noite
            $table->text('observacoes')->nullable();
            $table->enum('origem', ['Formulário', 'Cadastro interno'])->default('Cadastro interno');

            // LGPD — base legal: consentimento (art. 7º, I)
            $table->timestamp('consentimento_lgpd_em')->nullable();
            $table->string('consentimento_ip', 45)->nullable();
            $table->timestamp('anonimizado_em')->nullable();

            $table->timestamps();
            $table->softDeletes();
            $table->index('status');
        });

        // Liga o login (users) à pessoa da equipe, quando houver.
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('voluntario_id')->nullable()->after('perfil')
                ->constrained('voluntarios')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('voluntario_id');
        });
        Schema::dropIfExists('voluntarios');
    }
};
