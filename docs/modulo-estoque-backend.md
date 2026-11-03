# Módulo de Estoque — regras para o back-end (Laravel + MySQL)

O front-end (`Pages/estoque.html`, `js/estoque.js`) já segue estas regras com dados no
localStorage. Na integração, o cálculo de `PawData.stockInfo()` (em `js/dados.js`) passa
para o servidor e as funções `loadStock*`/`saveStock*` viram chamadas à API.

## 1. Princípio: o saldo nunca é editado

- Não existe coluna `saldo` editável. O saldo é `SUM(entradas) - SUM(saídas)` das movimentações.
- Movimentação não é editada nem apagada. Erro se corrige com **estorno**: uma movimentação
  inversa (`motivo = estorno`) que aponta para a original (`estorno_de_id`).
- Só é possível estornar uma entrada se a quantidade ainda estiver no estoque (por lote).
- A tabela `movimentacoes` não tem `updated_at` nem `deleted_at`.

## 2. Tabelas

```
categorias_estoque  id, nome
itens_estoque       id, categoria_id, nome (único), unidade (kg|g|L|mL|un),
                    estoque_minimo DECIMAL(10,3), controla_validade BOOL,
                    observacoes, ativo BOOL, timestamps
embalagens          id, item_id, nome ("Saco 15 kg"), quantidade DECIMAL(10,3)
lotes               id, item_id, codigo, data_validade
                    UNIQUE(item_id, codigo)   -- um lote não pode ter duas validades
movimentacoes       id, item_id, tipo (entrada|saida),
                    motivo (doacao|compra|consumo|uso_animal|perda|repasse|ajuste|estorno),
                    quantidade DECIMAL(10,3)  -- sempre na unidade de controle
                    quantidade_informada DECIMAL(10,3), embalagem_id NULL
                                              -- o que foi digitado: "2" × "Saco 15 kg"
                    animal_id NULL, doacao_id NULL (módulo financeiro),
                    origem_destino NULL (doador, fornecedor ou ONG de destino),
                    observacao, estorno_de_id NULL, user_id, data, created_at
movimentacao_lotes  id, movimentacao_id, lote_id, quantidade DECIMAL(10,3)
                    -- uma saída pode sair de mais de um lote (FEFO)
```

Quantidades sempre em `DECIMAL(10,3)`, nunca `FLOAT`.

## 3. Embalagens e conversão

- O item é controlado em uma unidade (ex.: kg). Embalagens convertem para ela:
  "2 × Saco 15 kg" grava `quantidade = 30`, `quantidade_informada = 2`, `embalagem_id`.
- A conversão é feita **no servidor** (não confiar no valor calculado pelo navegador).
- Unidade e "controla validade" não podem mudar depois que o item tem movimentações.

## 4. Lotes, validade e FEFO

- Item com `controla_validade`: toda entrada exige lote e validade; não aceita lote já vencido.
- Saída automática segue **FEFO** (vence primeiro, sai primeiro), dividindo entre lotes se preciso.
- Lote vencido só sai com motivo `perda` (descarte). Nunca para consumo ou uso em animal.
- Saldo **disponível** = saldo total menos lotes vencidos. O status usa o disponível.

## 5. Status e alertas

| Status     | Regra (saldo disponível)        |
|------------|----------------------------------|
| Em falta   | = 0                              |
| Crítico    | < estoque mínimo                 |
| Baixo      | ≤ 1,5 × estoque mínimo           |
| Disponível | acima disso                      |

- Lote **vencendo**: validade em até 30 dias. **Vencido**: validade < hoje.
- Consumo médio diário: soma das saídas `consumo` + `uso_animal` não estornadas nos últimos
  30 dias ÷ 30. Cobertura = saldo disponível ÷ consumo médio.
- Contadores do menu e do dashboard: itens em falta + críticos.

## 6. Validações obrigatórias no servidor (em transação)

- Saída nunca maior que o saldo do(s) lote(s) — travar as linhas (`lockForUpdate`) para dois
  usuários não tirarem o mesmo saldo ao mesmo tempo.
- `uso_animal` exige `animal_id`; `repasse` exige destino; `perda` e `ajuste` exigem observação.
- Data não pode ser futura.
- Item com movimentações não é excluído, só inativado; e só inativa com saldo zero.

## 7. Permissões

| Ação                                    | Voluntário | Funcionário |
|-----------------------------------------|:----------:|:-----------:|
| Ver estoque e histórico                 | sim        | sim         |
| Registrar entrada e saída               | sim        | sim         |
| Cadastrar/editar/inativar item          | não        | sim         |
| Inventário (ajuste) e estorno           | não        | sim         |

## 8. Integrações

- **Doações/Financeiro:** doação material registrada lá gera a entrada no estoque
  (`doacao_id`), sem digitação dupla.
- **Animais:** saída `uso_animal` aparece no histórico de saúde do animal.
- **Relatório técnico:** entradas por origem, consumo e perdas por período.
- **Auditoria:** `user_id` + `created_at` em toda movimentação (LGPD e prestação de contas).
