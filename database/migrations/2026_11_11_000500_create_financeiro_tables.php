<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Gestão Financeira: doações (pessoa física ou jurídica; financeira ou material),
 * despesas, orçamento mensal e saldo inicial.
 * - Dinheiro em DECIMAL(10,2), nunca FLOAT (evita erro de centavos).
 * - Doações e despesas não são apagadas de verdade (softDeletes + quem alterou): prestação de contas.
 * - O saldo NÃO é uma coluna: é calculado pela view vw_saldo_financeiro.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doacoes', function (Blueprint $table) {
            $table->id();
            $table->date('data');
            $table->enum('origem', ['Pessoa física', 'Pessoa jurídica']);
            $table->string('doador', 150)->nullable(); // vazio = doação anônima
            $table->enum('tipo', ['Financeira', 'Material']);
            $table->decimal('valor', 10, 2)->nullable();              // só Financeira
            $table->enum('forma_pagamento', ['PIX', 'Dinheiro', 'Transferência', 'Cartão', 'Boleto'])->nullable();
            $table->string('item', 120)->nullable();                  // só Material
            $table->decimal('quantidade', 10, 3)->nullable();
            $table->enum('unidade', ['kg', 'g', 'L', 'mL', 'un'])->nullable();
            $table->text('observacoes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('alterado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tipo', 'data']);
        });

        Schema::create('despesas', function (Blueprint $table) {
            $table->id();
            $table->date('data');
            $table->enum('categoria', ['Veterinário', 'Medicamentos', 'Ração e alimentação', 'Higiene e limpeza', 'Transporte', 'Manutenção', 'Outros']);
            $table->string('descricao', 200);
            $table->decimal('valor', 10, 2);
            $table->string('pago_a', 150)->nullable();
            $table->foreignId('animal_id')->nullable()->constrained('animais')->nullOnDelete();
            $table->text('observacoes')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('alterado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['categoria', 'data']);
        });

        Schema::create('orcamentos', function (Blueprint $table) {
            $table->id();
            $table->string('categoria', 40)->unique();
            $table->decimal('valor_mensal', 10, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('configuracoes_financeiras', function (Blueprint $table) {
            $table->id();
            $table->decimal('saldo_inicial', 10, 2)->default(0);
            $table->date('data_inicio');
            $table->timestamps();
        });

        // Saldo = saldo inicial + doações financeiras − despesas (registros não excluídos).
        DB::statement(<<<'SQL'
            CREATE OR REPLACE VIEW vw_saldo_financeiro AS
            SELECT
                COALESCE((SELECT saldo_inicial FROM configuracoes_financeiras ORDER BY id LIMIT 1), 0) AS saldo_inicial,
                COALESCE((SELECT SUM(valor) FROM doacoes WHERE tipo = 'Financeira' AND deleted_at IS NULL), 0) AS total_doacoes,
                COALESCE((SELECT SUM(valor) FROM despesas WHERE deleted_at IS NULL), 0) AS total_despesas,
                COALESCE((SELECT saldo_inicial FROM configuracoes_financeiras ORDER BY id LIMIT 1), 0)
                  + COALESCE((SELECT SUM(valor) FROM doacoes WHERE tipo = 'Financeira' AND deleted_at IS NULL), 0)
                  - COALESCE((SELECT SUM(valor) FROM despesas WHERE deleted_at IS NULL), 0) AS saldo
        SQL);
    }

    public function down(): void
    {
        DB::statement('DROP VIEW IF EXISTS vw_saldo_financeiro');
        Schema::dropIfExists('configuracoes_financeiras');
        Schema::dropIfExists('orcamentos');
        Schema::dropIfExists('despesas');
        Schema::dropIfExists('doacoes');
    }
};
