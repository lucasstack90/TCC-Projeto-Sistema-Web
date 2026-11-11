<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Estoque — segue docs/modulo-estoque-backend.md.
 * O saldo nunca é editado: é SUM(entradas) − SUM(saídas) da tabela movimentacoes.
 * Erro se corrige com estorno (movimentação inversa), por isso movimentacoes não tem updated_at.
 * Quantidades em DECIMAL(10,3), sempre na unidade de controle do item.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categorias_estoque', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 60)->unique();
            $table->timestamps();
        });

        Schema::create('itens_estoque', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_id')->constrained('categorias_estoque');
            $table->string('nome', 120)->unique();
            $table->enum('unidade', ['kg', 'g', 'L', 'mL', 'un']);
            $table->decimal('estoque_minimo', 10, 3)->default(0);
            $table->boolean('controla_validade')->default(false);
            $table->text('observacoes')->nullable();
            $table->boolean('ativo')->default(true); // item com movimentação não é excluído, só inativado
            $table->timestamps();
        });

        // "Saco 15 kg" → converte 2 sacos em 30 kg no servidor.
        Schema::create('embalagens', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('itens_estoque')->cascadeOnDelete();
            $table->string('nome', 60);
            $table->decimal('quantidade', 10, 3);
            $table->timestamps();
        });

        Schema::create('lotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('itens_estoque');
            $table->string('codigo', 40);
            $table->date('data_validade');
            $table->timestamps();
            $table->unique(['item_id', 'codigo']); // um lote não pode ter duas validades
        });

        Schema::create('movimentacoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('item_id')->constrained('itens_estoque');
            $table->enum('tipo', ['entrada', 'saida']);
            $table->enum('motivo', ['doacao', 'compra', 'consumo', 'uso_animal', 'perda', 'repasse', 'ajuste', 'estorno']);
            $table->decimal('quantidade', 10, 3);              // na unidade de controle
            $table->decimal('quantidade_informada', 10, 3)->nullable(); // o que foi digitado (ex.: 2)
            $table->foreignId('embalagem_id')->nullable()->constrained('embalagens')->nullOnDelete();
            $table->foreignId('animal_id')->nullable()->constrained('animais')->nullOnDelete();
            $table->foreignId('doacao_id')->nullable()->constrained('doacoes')->nullOnDelete();
            $table->string('origem_destino', 150)->nullable(); // doador, fornecedor ou ONG de destino
            $table->text('observacao')->nullable();
            $table->foreignId('estorno_de_id')->nullable()->constrained('movimentacoes');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->date('data');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['item_id', 'tipo', 'data']);
        });

        // Uma saída pode sair de mais de um lote (FEFO: vence primeiro, sai primeiro).
        Schema::create('movimentacao_lotes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('movimentacao_id')->constrained('movimentacoes')->cascadeOnDelete();
            $table->foreignId('lote_id')->constrained('lotes');
            $table->decimal('quantidade', 10, 3);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimentacao_lotes');
        Schema::dropIfExists('movimentacoes');
        Schema::dropIfExists('lotes');
        Schema::dropIfExists('embalagens');
        Schema::dropIfExists('itens_estoque');
        Schema::dropIfExists('categorias_estoque');
    }
};
