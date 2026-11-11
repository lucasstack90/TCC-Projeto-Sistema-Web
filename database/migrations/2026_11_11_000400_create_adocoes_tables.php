<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Módulo de Adoções: cadastro do adotante e acompanhamento do processo
 * (Novo → Em análise → Aprovada → Concluída, ou Recusada / Cancelada).
 *
 * LGPD (tabela com os dados mais sensíveis do sistema):
 *  - CPF criptografado (cast "encrypted" do Laravel, chave APP_KEY). Para impedir CPF repetido
 *    sem descriptografar, guarda-se também um hash HMAC-SHA256 com índice único (cpf_hash).
 *  - Documentos em fotos ficam em storage/app/private (fora da pasta pública) e só a equipe logada baixa.
 *  - Consentimento registrado com data e versão do termo; anonimização em vez de exclusão
 *    quando o processo precisa continuar na prestação de contas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('adotantes', function (Blueprint $table) {
            $table->id();
            $table->string('nome', 120);
            $table->text('cpf');                       // criptografado
            $table->char('cpf_hash', 64)->unique();    // HMAC para busca e unicidade
            $table->date('data_nascimento');           // regra: maior de 18 anos
            $table->string('telefone', 20);
            $table->string('email', 150);
            $table->string('logradouro', 150);
            $table->string('numero', 20)->nullable();
            $table->string('bairro', 100);
            $table->string('cidade', 100)->default('Guarapuava - PR');

            // Estrutura da residência e dinâmica familiar (formulário do artigo)
            $table->enum('tipo_moradia', ['Casa', 'Apartamento', 'Chácara / sítio', 'Outro']);
            $table->enum('posse_moradia', ['Própria', 'Alugada', 'Cedida']);
            $table->boolean('tem_quintal')->default(false);
            $table->boolean('tem_telas')->default(false);
            $table->unsignedTinyInteger('moradores')->default(1);
            $table->boolean('tem_criancas')->default(false);
            $table->string('outros_animais', 200)->nullable();
            $table->unsignedTinyInteger('horas_sozinho')->nullable();
            $table->text('experiencia')->nullable();
            $table->text('motivacao')->nullable();

            $table->timestamp('consentimento_lgpd_em')->nullable();
            $table->string('consentimento_versao', 20)->nullable();
            $table->timestamp('anonimizado_em')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('adotante_documentos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adotante_id')->constrained('adotantes')->cascadeOnDelete();
            $table->string('caminho');           // storage/app/private/adotantes/...
            $table->string('nome_original', 150);
            $table->string('mime', 60);
            $table->unsignedInteger('tamanho');  // bytes
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('adocoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('animal_id')->constrained('animais');
            $table->foreignId('adotante_id')->constrained('adotantes');
            $table->enum('etapa', ['Novo', 'Em análise', 'Aprovada', 'Concluída', 'Recusada', 'Cancelada'])->default('Novo');
            $table->date('aberta_em');
            $table->date('encerrada_em')->nullable();
            // Verificação da equipe: aprovar exige as três primeiras; concluir exige o termo.
            $table->boolean('entrevista')->default(false);
            $table->boolean('visita')->default(false);
            $table->boolean('documentos_conferidos')->default(false);
            $table->boolean('termo_assinado')->default(false);
            $table->string('motivo_encerramento', 300)->nullable(); // obrigatório em Recusada / Cancelada
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->index(['etapa', 'animal_id']);
        });

        Schema::create('adocao_registros', function (Blueprint $table) {
            $table->id();
            $table->foreignId('adocao_id')->constrained('adocoes')->cascadeOnDelete();
            $table->date('data');
            $table->string('etapa', 30);
            $table->text('texto');
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('adocao_registros');
        Schema::dropIfExists('adocoes');
        Schema::dropIfExists('adotante_documentos');
        Schema::dropIfExists('adotantes');
    }
};
