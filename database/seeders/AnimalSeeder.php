<?php

namespace Database\Seeders;

use App\Models\Animal;
use Illuminate\Database\Seeder;

/**
 * Os mesmos 8 animais de exemplo do protótipo (js/dados.js), com os MESMOS ids (PAW-0001 a PAW-0008).
 * Assim os módulos que ainda usam o localStorage (adoções, resgates, estoque) continuam
 * apontando para os animais certos.
 */
class AnimalSeeder extends Seeder
{
    private function foto(string $id): string
    {
        return "https://images.unsplash.com/photo-{$id}?auto=format&fit=crop&w=900&q=80";
    }

    public function run(): void
    {
        $animais = [
            [
                'id' => 1, 'nome' => 'Thor', 'especie' => 'Cão', 'raca' => 'Labrador', 'cor' => 'Dourado', 'idade_estimada' => '3 anos',
                'data_chegada' => '2026-03-14', 'sexo' => 'Macho', 'porte' => 'Grande', 'status' => 'Disponível',
                'foto' => $this->foto('1552053831-71594a27632d'), 'peso' => 26.4,
                'vacinado' => true, 'castrado' => true, 'microchip' => false, 'observacoes' => 'Sociável e ativo. Gosta de passeios.',
                'vacinas' => [['V8', '2026-03-15', '2027-03-15', 'V8-2048', 'Dra. Marina Lopes']],
                'historico' => [['Consulta', '2026-03-14', 'Avaliação geral de chegada', 'Dra. Marina Lopes', 'Saúde geral boa.']],
                'pesagens' => [[26.4, '2026-03-14', 'Avaliação inicial']],
            ],
            [
                'id' => 2, 'nome' => 'Mia', 'especie' => 'Gato', 'raca' => 'Siamês', 'cor' => 'Creme e marrom', 'idade_estimada' => '2 anos',
                'data_chegada' => '2026-02-09', 'sexo' => 'Fêmea', 'porte' => 'Pequeno', 'status' => 'Disponível',
                'foto' => $this->foto('1573865526739-10659f8f3bcf'), 'peso' => 4.2,
                'vacinado' => true, 'castrado' => true, 'microchip' => false, 'observacoes' => 'Tranquila e aparentemente saudável.',
                'vacinas' => [
                    ['Tríplice Felina', '2026-02-10', '2027-02-10', 'TF-2026-220', 'Dr. Henrique Farias'],
                    ['Antirrábica', '2026-02-10', '2027-02-10', 'AR-2026-046', 'Dr. Henrique Farias'],
                ],
                'historico' => [
                    ['Consulta', '2026-03-10', 'Retorno — avaliação nutricional', 'Dr. Henrique Farias', 'Ganhou 400 g. Ótima evolução.'],
                    ['Consulta', '2026-02-09', 'Avaliação geral de chegada', 'Dr. Henrique Farias', 'Dieta de recuperação prescrita.'],
                ],
                'pesagens' => [[4.2, '2026-03-10', 'Retorno'], [3.8, '2026-02-09', 'Chegada']],
            ],
            [
                'id' => 3, 'nome' => 'Bolinha', 'especie' => 'Cão', 'raca' => 'Vira-lata', 'cor' => 'Branco e marrom', 'idade_estimada' => '1 ano',
                'data_chegada' => '2026-04-02', 'sexo' => 'Macho', 'porte' => 'Médio', 'status' => 'Em Tratamento',
                'foto' => $this->foto('1543466835-00a7907e9de1'), 'peso' => 12.1,
                'vacinado' => false, 'castrado' => false, 'microchip' => false, 'observacoes' => 'Em acompanhamento veterinário.',
                'vacinas' => [],
                'historico' => [['Tratamento', '2026-04-02', 'Início de tratamento dermatológico', 'Dra. Marina Lopes', 'Retorno agendado.']],
                'pesagens' => [[12.1, '2026-04-02', 'Pesagem de chegada']],
            ],
            [
                'id' => 4, 'nome' => 'Nina', 'especie' => 'Gato', 'raca' => 'Persa', 'cor' => 'Caramelo', 'idade_estimada' => '4 anos',
                'data_chegada' => '2026-01-20', 'sexo' => 'Fêmea', 'porte' => 'Médio', 'status' => 'Em Lar Temporário',
                'foto' => $this->foto('1574158622682-e40e69881006'), 'peso' => 3.9,
                'vacinado' => true, 'castrado' => true, 'microchip' => true, 'observacoes' => 'Em lar temporário.',
                'vacinas' => [['Antirrábica', '2026-01-20', '2027-01-20', 'AR-9012', 'Dr. Henrique Farias']],
                'historico' => [],
                'pesagens' => [[3.9, '2026-01-20', 'Chegada']],
            ],
            [
                'id' => 5, 'nome' => 'Rex', 'especie' => 'Cão', 'raca' => 'Pastor Alemão', 'cor' => 'Preto e caramelo', 'idade_estimada' => '5 anos',
                'data_chegada' => '2025-12-11', 'sexo' => 'Macho', 'porte' => 'Grande', 'status' => 'Adotado',
                'foto' => $this->foto('1568572933382-74d440642117'), 'peso' => 31.5,
                'vacinado' => true, 'castrado' => true, 'microchip' => true, 'observacoes' => 'Adoção concluída.',
                'vacinas' => [],
                'historico' => [['Adoção', '2025-12-20', 'Adoção concluída', 'Equipe PAWSAFE', 'Termo arquivado.']],
                'pesagens' => [[31.5, '2025-12-11', 'Chegada']],
            ],
            [
                'id' => 6, 'nome' => 'Pérola', 'especie' => 'Outros', 'raca' => 'Coelho angorá', 'cor' => 'Branco', 'idade_estimada' => '8 meses',
                'data_chegada' => '2026-05-02', 'sexo' => 'Fêmea', 'porte' => 'Pequeno', 'status' => 'Disponível',
                'foto' => $this->foto('1591382386627-349b692688ff'), 'peso' => 1.8,
                'vacinado' => true, 'castrado' => false, 'microchip' => false, 'observacoes' => 'Coelha dócil.',
                'vacinas' => [], 'historico' => [],
                'pesagens' => [[1.8, '2026-05-02', 'Chegada']],
            ],
            [
                'id' => 7, 'nome' => 'Mel', 'especie' => 'Cão', 'raca' => 'Golden Retriever', 'cor' => 'Dourado', 'idade_estimada' => '2 anos',
                'data_chegada' => '2026-04-12', 'sexo' => 'Fêmea', 'porte' => 'Grande', 'status' => 'Resgatado',
                'foto' => $this->foto('1516734212186-a967f81ad0d7'), 'peso' => 24.7,
                'vacinado' => false, 'castrado' => false, 'microchip' => false, 'observacoes' => 'Resgate recente. Aguardando avaliação veterinária.',
                'vacinas' => [],
                'historico' => [['Resgate', '2026-04-12', 'Resgate em área urbana', 'Equipe PAWSAFE', 'Encaminhada para avaliação.']],
                'pesagens' => [[24.7, '2026-04-12', 'Chegada']],
            ],
            [
                'id' => 8, 'nome' => 'Simba', 'especie' => 'Gato', 'raca' => 'Maine Coon', 'cor' => 'Laranja', 'idade_estimada' => '3 anos',
                'data_chegada' => '2026-02-18', 'sexo' => 'Macho', 'porte' => 'Grande', 'status' => 'Disponível',
                'foto' => $this->foto('1514888286974-6c03e2ca1dba'), 'peso' => 6.2,
                'vacinado' => true, 'castrado' => true, 'microchip' => true, 'observacoes' => 'Sociável com pessoas.',
                'vacinas' => [['Tríplice Felina', '2026-02-18', '2027-02-18', 'TF-2210', 'Dr. Henrique Farias']],
                'historico' => [],
                'pesagens' => [[6.2, '2026-02-18', 'Chegada']],
            ],
        ];

        foreach ($animais as $dados) {
            ['vacinas' => $vacinas, 'historico' => $historico, 'pesagens' => $pesagens] = $dados;
            unset($dados['vacinas'], $dados['historico'], $dados['pesagens']);

            // forceFill para manter o id do protótipo; mesma data de criação para a lista
            // aparecer na ordem PAW-0001...0008 (cadastros novos ficam acima deles).
            $animal = new Animal;
            $animal->forceFill([...$dados, 'created_at' => '2026-05-02 12:00:00', 'updated_at' => '2026-05-02 12:00:00'])->save();

            foreach ($vacinas as [$nome, $data, $proxima, $lote, $vet]) {
                $animal->vacinas()->create([
                    'nome' => $nome, 'data_aplicacao' => $data, 'proxima_dose' => $proxima, 'lote' => $lote, 'veterinario' => $vet,
                ]);
            }
            foreach ($historico as [$tipo, $data, $descricao, $responsavel, $notas]) {
                $animal->historicos()->create([
                    'tipo' => $tipo, 'data' => $data, 'descricao' => $descricao, 'responsavel' => $responsavel, 'notas' => $notas,
                ]);
            }
            foreach ($pesagens as [$peso, $data, $obs]) {
                $animal->pesagens()->create(['peso' => $peso, 'data' => $data, 'observacao' => $obs]);
            }
        }
    }
}
