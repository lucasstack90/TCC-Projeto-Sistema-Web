<?php

namespace Database\Seeders;

use App\Models\Voluntario;
use Illuminate\Database\Seeder;

/** Equipe de exemplo do protótipo (mesmos ids, nomes batem com resgates e fichas). */
class VoluntarioSeeder extends Seeder
{
    public function run(): void
    {
        $equipe = [
            [1, 'Renata Oliveira', 'renata.oliveira@email.com', '(42) 99901-2233', 'Administração', 'Ativo', ['Resgate', 'Redes sociais', 'Arrecadação'], 'Coordena a organização desde a fundação.', ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], ['Manhã', 'Tarde'], null, 'Cadastro interno', '2025-03-01'],
            [2, 'Marcos Ribeiro', 'marcos.ribeiro@email.com', '(42) 99812-4455', 'Voluntário', 'Ativo', ['Resgate', 'Transporte'], 'Tem caminhonete e ajuda nos resgates de fim de semana.', ['Qua', 'Sáb', 'Dom'], ['Manhã', 'Tarde'], null, 'Formulário', '2025-08-12'],
            [3, 'Ana Paula Souza', 'anapaula.souza@email.com', '(42) 99733-6677', 'Coordenação', 'Ativo', ['Resgate', 'Cuidados e limpeza', 'Lar temporário'], 'Já foi lar temporário de mais de 20 gatos.', ['Seg', 'Qua', 'Sex'], ['Tarde', 'Noite'], 'Responsável pela escala de limpeza.', 'Formulário', '2025-06-20'],
            [4, 'Dra. Marina Lopes', 'marina.lopes@email.com', '(42) 99654-8899', 'Veterinário(a)', 'Ativo', ['Cuidados veterinários'], 'Médica-veterinária, atende os animais da organização.', ['Ter', 'Qui'], ['Manhã'], null, 'Cadastro interno', '2025-04-10'],
            [5, 'Dr. Henrique Farias', 'henrique.farias@email.com', '(42) 99545-1010', 'Veterinário(a)', 'Ativo', ['Cuidados veterinários'], 'Médico-veterinário, foco em felinos.', ['Seg', 'Sex'], ['Tarde'], null, 'Cadastro interno', '2025-09-02'],
            [6, 'Paulo Henrique Lima', 'paulo.lima@email.com', '(42) 99476-2020', 'Voluntário', 'Inativo', ['Cuidados e limpeza'], null, ['Sáb'], ['Manhã'], 'Mudou de cidade em agosto de 2026.', 'Formulário', '2025-11-15'],
            [7, 'Bruna Carvalho', 'bruna.carvalho@email.com', '(42) 99367-3030', 'Voluntário', 'Interessado', ['Redes sociais', 'Eventos e feiras'], 'Ajudou a organizar uma feira de adoção na faculdade.', ['Sáb'], ['Manhã', 'Tarde'], null, 'Formulário', '2026-10-24'],
            [8, 'Diego Martins', 'diego.martins@email.com', '(42) 99258-4040', 'Voluntário', 'Interessado', ['Transporte', 'Resgate'], 'Tem carro e já levou animais à clínica para uma vizinha.', ['Dom'], ['Manhã'], null, 'Formulário', '2026-10-27'],
        ];

        foreach ($equipe as [$id, $nome, $email, $telefone, $funcao, $status, $habilidades, $experiencia, $dias, $turnos, $obs, $origem, $criado]) {
            (new Voluntario)->forceFill([
                'id' => $id, 'nome' => $nome, 'email' => $email, 'telefone' => $telefone, 'funcao' => $funcao,
                'status' => $status, 'habilidades' => $habilidades, 'experiencia' => $experiencia, 'dias' => $dias,
                'turnos' => $turnos, 'observacoes' => $obs, 'origem' => $origem,
                'consentimento_lgpd_em' => $criado, 'created_at' => $criado, 'updated_at' => $criado,
            ])->save();
        }
    }
}
