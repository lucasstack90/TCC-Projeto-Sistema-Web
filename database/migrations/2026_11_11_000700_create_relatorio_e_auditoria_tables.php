<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Relatório técnico (obrigatório quando a ONG recebe recursos públicos municipais)
 * e registro de auditoria exigido pela LGPD (art. 37: registro das operações de tratamento).
 */
return new class extends Migration
{
    public function up(): void
    {
        // Uma única linha com a identificação da ONG, a parceria e as metas mensais.
        Schema::create('configuracoes_relatorio', function (Blueprint $table) {
            $table->id();
            $table->json('organizacao');  // nome, CNPJ, endereço, representante legal...
            $table->json('parceria');     // termo de colaboração, órgão concedente, vigência
            $table->json('metas');        // resgates, adoções, vacinas, atendimentos por mês
            $table->timestamps();
        });

        // Análise escrita pela equipe para cada período do relatório.
        Schema::create('relatorio_narrativas', function (Blueprint $table) {
            $table->id();
            $table->date('periodo_inicio');
            $table->date('periodo_fim');
            $table->longText('texto');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->unique(['periodo_inicio', 'periodo_fim']);
        });

        // Quem fez o quê e quando (login, criação, alteração, exclusão, acesso a dado pessoal).
        Schema::create('log_auditoria', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('acao', 40);          // login, logout, criar, alterar, excluir, visualizar_documento...
            $table->string('tabela', 60)->nullable();
            $table->unsignedBigInteger('registro_id')->nullable();
            $table->string('descricao', 255)->nullable();
            $table->string('ip', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['tabela', 'registro_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('log_auditoria');
        Schema::dropIfExists('relatorio_narrativas');
        Schema::dropIfExists('configuracoes_relatorio');
    }
};
