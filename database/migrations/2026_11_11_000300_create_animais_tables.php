<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de cadastro de animais (artigo, seção 2.1): raça, espécie, idade estimada,
 * data de chegada, sexo, status, observação de saúde e foto opcional.
 * A ficha também guarda vacinas, histórico de cuidados e pesagens.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('animais', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 60);
            $table->enum('especie', ['Cão', 'Gato', 'Outros']);
            $table->string('raca', 60);
            $table->string('cor', 60);
            $table->string('idade_estimada', 30)->nullable();
            $table->date('data_chegada');
            $table->enum('sexo', ['Macho', 'Fêmea', 'Não identificado'])->default('Não identificado');
            $table->enum('porte', ['Pequeno', 'Médio', 'Grande'])->default('Médio');
            $table->enum('status', ['Resgatado', 'Em Tratamento', 'Disponível', 'Em Lar Temporário', 'Adotado'])->default('Resgatado');
            $table->decimal('peso', 6, 2)->nullable(); // kg — DECIMAL, nunca FLOAT
            $table->boolean('vacinado')->default(false);
            $table->boolean('castrado')->default(false);
            $table->boolean('microchip')->default(false);
            $table->text('observacoes')->nullable();
            // Caminho do arquivo em storage/app/public/animais (ou URL externa nos dados de exemplo).
            // A foto não fica dentro do banco em base64.
            $table->string('foto')->nullable();
            $table->foreignId('resgate_id')->nullable()->constrained('resgates')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // quem cadastrou
            $table->timestamps();
            $table->softDeletes(); // "Excluir" não apaga de verdade: adoções antigas continuam apontando para o animal
            $table->index(['status', 'especie']);
        });

        Schema::create('animal_vacinas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('animal_id')->constrained('animais')->cascadeOnDelete();
            $table->string('nome', 80);
            $table->date('data_aplicacao');
            $table->date('proxima_dose')->nullable();
            $table->string('lote', 40)->nullable();
            $table->string('veterinario', 120)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('animal_historicos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('animal_id')->constrained('animais')->cascadeOnDelete();
            $table->string('tipo', 30); // Cadastro, Consulta, Cirurgia, Tratamento, Exame, Banho e Tosa, Resgate, Adoção, Outro
            $table->date('data');
            $table->string('descricao', 200);
            $table->string('responsavel', 120)->nullable();
            $table->text('notas')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('animal_pesagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('animal_id')->constrained('animais')->cascadeOnDelete();
            $table->decimal('peso', 6, 2);
            $table->date('data');
            $table->string('observacao', 150)->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('animal_pesagens');
        Schema::dropIfExists('animal_historicos');
        Schema::dropIfExists('animal_vacinas');
        Schema::dropIfExists('animais');
    }
};
