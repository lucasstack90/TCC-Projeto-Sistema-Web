<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Cadastro de contribuintes do módulo financeiro: doadores frequentes e fornecedores /
 * prestadores de serviço. Pessoa física (CPF) ou pessoa jurídica (CNPJ).
 * Ao registrar uma doação ou despesa, a equipe seleciona o cadastro em vez de digitar o nome.
 *
 * LGPD:
 *  - CPF/CNPJ criptografado (cast "encrypted", chave APP_KEY). O documento_hash (HMAC-SHA256)
 *    tem índice único: impede cadastro repetido sem precisar descriptografar a tabela.
 *  - Data do consentimento da pessoa física para o uso dos dados.
 *  - Exclusão = anonimização: a doação antiga continua na prestação de contas,
 *    mas sem os dados pessoais do titular.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contribuintes', function (Blueprint $table) {
            $table->id();
            $table->enum('tipo', ['Pessoa física', 'Pessoa jurídica']); // mesmos valores de doacoes.origem
            $table->string('nome', 150);                  // nome completo ou razão social
            $table->string('nome_fantasia', 150)->nullable();
            $table->text('documento');                    // CPF ou CNPJ, só números, criptografado
            $table->char('documento_hash', 64)->unique(); // HMAC para unicidade e busca
            $table->string('responsavel', 120)->nullable(); // pessoa de contato (pessoa jurídica)
            $table->string('telefone', 20);
            $table->string('email', 150)->nullable();
            $table->char('cep', 9)->nullable();
            $table->string('logradouro', 150)->nullable();
            $table->string('numero', 20)->nullable();
            $table->string('complemento', 60)->nullable();
            $table->string('bairro', 100)->nullable();
            $table->string('cidade', 100)->nullable();
            $table->char('uf', 2)->nullable();
            // Um mesmo cadastro pode doar e também ser pago (ex.: clínica que doa vacinas e cobra cirurgias).
            $table->boolean('doador')->default(true);
            $table->boolean('fornecedor')->default(false);
            $table->text('observacoes')->nullable();
            $table->timestamp('consentimento_lgpd_em')->nullable();
            $table->boolean('ativo')->default(true);
            $table->timestamp('anonimizado_em')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('alterado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['tipo', 'nome']);
        });

        // Doação e despesa passam a apontar para o cadastro. As colunas de texto (doador / pago_a)
        // continuam com o nome da época e servem para lançamentos avulsos, sem cadastro.
        Schema::table('doacoes', function (Blueprint $table) {
            $table->foreignId('contribuinte_id')->nullable()->after('doador')
                ->constrained('contribuintes')->nullOnDelete();
        });

        Schema::table('despesas', function (Blueprint $table) {
            $table->foreignId('contribuinte_id')->nullable()->after('pago_a')
                ->constrained('contribuintes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('despesas', fn (Blueprint $table) => $table->dropConstrainedForeignId('contribuinte_id'));
        Schema::table('doacoes', fn (Blueprint $table) => $table->dropConstrainedForeignId('contribuinte_id'));
        Schema::dropIfExists('contribuintes');
    }
};
