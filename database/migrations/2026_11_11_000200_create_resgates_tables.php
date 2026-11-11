<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Resgate: ocorrências registradas pela equipe (endereço, situação, data e responsável).
 * O responsável é guardado pelo id do voluntário (chave estrangeira), não pelo nome.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resgates', function (Blueprint $table) {
            $table->id();
            $table->date('data');
            $table->string('logradouro', 150);
            $table->string('numero', 20)->nullable();
            $table->string('bairro', 100);
            $table->string('cidade', 100)->default('Guarapuava - PR');
            $table->string('referencia', 200)->nullable();
            $table->enum('especie', ['Cão', 'Gato', 'Outros']);
            $table->unsignedSmallInteger('quantidade')->default(1);
            $table->enum('prioridade', ['Baixa', 'Média', 'Alta', 'Crítica'])->default('Média');
            $table->text('descricao');
            $table->foreignId('responsavel_id')->nullable()->constrained('voluntarios')->nullOnDelete();
            $table->string('denunciante', 120)->nullable(); // pode ser "Denúncia anônima"
            $table->enum('etapa', ['Pendente', 'Em atendimento', 'Concluído', 'Sem sucesso'])->default('Pendente');
            $table->date('encerrado_em')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete(); // quem registrou
            $table->timestamps();
            $table->index(['etapa', 'data']);
        });

        // Linha do tempo da ocorrência ("Equipe a caminho", "Animal recolhido"...).
        Schema::create('resgate_registros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('resgate_id')->constrained('resgates')->cascadeOnDelete();
            $table->date('data');
            $table->string('etapa', 30);
            $table->text('texto');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resgate_registros');
        Schema::dropIfExists('resgates');
    }
};
