# Plano de ajuste do DFC

## Contexto

Documento criado a partir da reunião de 31/03/2026 15:37 (GMT-03:00) para conciliar:

1. regras de negócio alinhadas com o Karim;
2. comportamento atual do código do DFC;
3. plano de implementação e validação.

## Escopo fechado

Este ajuste deve mexer somente no fluxo do DFC.

Fora de escopo neste trabalho:

- DRE;
- balanço patrimonial;
- importações que não sejam do DFC;
- painel de parametrização de outros demonstrativos;
- qualquer regra de cálculo de outras áreas do sistema.

Regra de segurança de implementação:

- reaproveitar o que já está parametrizado no DFC;
- usar o plano de contas já existente;
- manter o restante do sistema funcionando sem alteração comportamental.

## Fluxo operacional desejado

O fluxo esperado do produto passa a ser:

1. A contabilidade entra no painel do cliente.
2. A contabilidade importa o balancete de um mês no DFC.
3. O mês importado fica disponível para cálculo daquele período.
4. O sistema cruza o balancete importado com o plano de contas já parametrizado no DFC.
5. O sistema pega as contas já vinculadas em cada linha do DFC.
6. O motor do DFC aplica somente as regras definidas na reunião para calcular cada linha.
7. As linhas derivadas do DFC são recalculadas a partir das linhas-base.
8. O resultado aparece no `/portal/dfc` sem interferir nas demais funções do sistema.

## Leitura crítica das anotações da reunião

As anotações do Gemini estão majoritariamente corretas e coerentes com a conversa descrita. Os pontos mais importantes e que devem ser tratados como fonte de verdade funcional são:

- Resultado do exercício: `Receita - Custo - Despesa`.
- O balancete mensal relevante para o DFC usa quatro colunas: `Saldo Anterior`, `Débito`, `Crédito` e `Saldo Atual`.
- Contas de Ativo operacional usam `Saldo Anterior - Saldo Atual`.
- Contas de Passivo operacional usam `Saldo Atual - Saldo Anterior`.
- `Lucro Ajustado` é a soma das linhas anteriores do bloco contábil.
- `Resultado Operacional` parte do `Lucro Ajustado` e soma as linhas até `Parcelamentos`.
- `Resultado de Investimento` cobre recebimento por venda até baixa do ativo.
- `Resultado Financeiro` cobre capital social até variação de empréstimos.
- `Resultado da Geração de Caixa` foi descrito como `Saldo Inicial Disponível - Saldo Final Disponível`.
- `Compras de Imobilizado`, `Aquisições de Investimento` e `Distribuição de Lucros` devem sempre ficar negativas.
- As linhas de total de ativo e passivo não devem existir no arquivo final.

## Estado atual do sistema

### O que já está aderente

- A estrutura das linhas do DFC já existe e está próxima da reunião em `src/lib/dfc-statement.ts`.
- `Lucro Ajustado` já é calculado como soma do bloco contábil.
- `Resultado Operacional`, `Resultado de Investimento` e `Resultado Financeiro` já existem como subtotais derivados.
- `Saldo Inicial Disponível` e `Saldo Final Disponível` já existem como linhas separadas.
- O agrupamento de linhas parametrizáveis no painel também já cobre os itens discutidos.

### O que está divergente hoje

- O cálculo atual do DFC patrimonial é genérico por variação mensal de saldo e não distingue regra por natureza da conta.
- O motor atual usa apenas um array `values` por conta/mês; ele não preserva separadamente `Saldo Anterior`, `Débito`, `Crédito` e `Saldo Atual`.
- `Compras de Imobilizado` e `Aquisições de Investimento` hoje não usam a coluna `Débito`; usam variação patrimonial.
- `Integralização/Aumento de Capital Social` hoje não usa `Crédito - Débito`; usa variação patrimonial.
- `Pagamento de Lucros e Dividendos` hoje não força sinal negativo.
- `Resultado da Geração de Caixa` hoje é calculado como `Resultado Operacional + Resultado de Investimento + Resultado Financeiro`, e não como diferença entre saldo inicial e saldo final disponível.
- A visualização rápida do balancete mostra só `Saldo Atual` preenchido; as demais colunas aparecem vazias.

## Conciliação regra a regra

| Linha / bloco | Regra validada na reunião | Situação atual | Ação |
| --- | --- | --- | --- |
| Resultado Liquido do Exercicio | `Receita - Custo - Despesa` usando saldo atual | Parcialmente aderente via DRE/lucro líquido | Validar se `input.dre.lines.lucroLiquido` bate 100% com a fórmula esperada |
| Depreciacao e Amortizacao | Somar saldo atual em valor positivo | Parcialmente aderente | Garantir `abs()` e origem em saldo atual do balancete quando aplicável |
| Resultado da Venda de Ativo Imobilizado | `Alienação - Dedução`, ambos por saldo atual | Parcialmente aderente | Garantir regra explícita por coluna/família |
| Resultado da Equivalencia Patrimonial | Conta 392 menos 403,87 usando saldo atual | Não explícito | Implementar regra por linha, não só por variação genérica |
| Contas de Ativo operacional | `Saldo Anterior - Saldo Atual` | Divergente | Implementar regra por linha para ativo |
| Contas de Passivo operacional | `Saldo Atual - Saldo Anterior` | Divergente | Implementar regra por linha para passivo |
| Recebimentos por Vendas de Ativo | Saldo atual da conta de alienação | Parcialmente aderente | Garantir uso de saldo atual |
| Compras de Imobilizado | Usar `Débito` e manter negativo | Divergente | Implementar regra por coluna com inversão de sinal |
| Aquisições em Investimentos | Usar `Débito` e manter negativo | Divergente | Implementar regra por coluna com inversão de sinal |
| Integralizacao/Aumento de Capital Social | `Crédito - Débito` | Divergente | Implementar regra específica |
| Pagamento de Lucros e Dividendos | Soma das contas, resultado sempre negativo | Divergente | Forçar sinal negativo após agregação |
| Variação em Empréstimos/Financiamentos | `Saldo Atual - Saldo Anterior` | Parcialmente aderente | Validar e tornar explícito |
| Dividendos Provisionados a Pagar | `Saldo Atual - Saldo Anterior` | Parcialmente aderente | Validar e tornar explícito |
| Lucro Ajustado | Soma dos itens anteriores | Aderente | Manter |
| Resultado Operacional | `Lucro Ajustado + linhas até Parcelamentos` | Aderente na forma | Validar sinais após ajuste das linhas-base |
| Resultado de Investimento | Soma das linhas do bloco investimento | Aderente na forma | Validar sinais |
| Resultado Financeiro | Soma das linhas do bloco financeiro | Aderente na forma | Validar sinais |
| Disponibilidades Base | Deve expor Saldo Inicial e Saldo Final | Aderente | Manter |
| Resultado Geracao de Caixa | `Saldo Inicial Disponível - Saldo Final Disponível` | Divergente | Confirmar fórmula final com Karim antes de trocar, pois é sensível |

## Tabela canônica de regras

Legenda de operação:

- `SA-SA`: `Saldo Anterior - Saldo Atual`
- `AS-SA`: `Saldo Atual - Saldo Anterior`
- `SALDO_ATUAL`: usar saldo atual consolidado
- `DEBITO_NEG`: usar débito e inverter sinal para negativo
- `CREDITO_MENOS_DEBITO`: `Crédito - Débito`
- `SALDO_ATUAL_NEG`: somar saldo atual e forçar resultado negativo
- `DERIVADA`: linha calculada a partir de outras linhas

### Bloco contábil

| Ordem | Linha DFC | Chave técnica | Operação esperada | Origem principal | Sinal esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Resultado Liquido do Exercicio | `resultadoLiquidoExercicio` | `SALDO_ATUAL` ou fórmula do DRE (`Receita - Custo - Despesa`) | DRE | conforme resultado | confirmar origem final |
| 2 | Depreciacao e Amortizacao | `depreciacaoAmortizacao` | `SALDO_ATUAL` | balancete/DRE | positivo | quase fechado |
| 3 | Resultado da Venda de Ativo Imobilizado | `resultadoVendaAtivoImobilizado` | `SALDO_ATUAL` com composição `Alienacao - Deducao` | balancete DRE | conforme composição | confirmar contas exatas |
| 4 | Resultado da Equivalencia Patrimonial | `resultadoEquivalenciaPatrimonial` | `SALDO_ATUAL` com composição específica | balancete DRE | conforme composição | pendente confirmação |
| 5 | Recebimentos de Lucros e Dividendos de Subsidiarias | `recebimentosLucrosDividendosSubsidiarias` | `SALDO_ATUAL` | balancete DRE | positivo | confirmar |
| 6 | Lucro Ajustado | `lucroAjustado` | `DERIVADA` = linhas 1 a 5 | cálculo | conforme soma | fechado |

### Bloco operacional

| Ordem | Linha DFC | Chave técnica | Operação esperada | Origem principal | Sinal esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 7 | Contas a Receber | `contasReceber` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 8 | Adiantamentos | `adiantamentos` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 9 | Impostos a Compensar | `impostosCompensar` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 10 | Estoques | `estoques` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 11 | Despesas Antecipadas | `despesasAntecipadas` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 12 | Outras Contas a Receber | `outrasContasReceber` | `SA-SA` | balancete patrimonial | conforme variação | fechado |
| 13 | Fornecedores | `fornecedores` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 14 | Obrigacoes Trabalhistas | `obrigacoesTrabalhistas` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 15 | Obrigacoes Tributarias | `obrigacoesTributarias` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 16 | Outras Obrigacoes | `outrasObrigacoes` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 17 | Parcelamentos | `parcelamentos` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 18 | Variacao Ativo | `variacaoAtivo` | `DERIVADA` = linhas 7 a 12 | cálculo | conforme soma | fechado |
| 19 | Variacao Passivo | `variacaoPassivo` | `DERIVADA` = linhas 13 a 17 | cálculo | conforme soma | fechado |
| 20 | Resultado Operacional | `resultadoOperacional` | `DERIVADA` = `Lucro Ajustado + Variacao Ativo + Variacao Passivo` | cálculo | conforme soma | fechado |

### Bloco de investimento

| Ordem | Linha DFC | Chave técnica | Operação esperada | Origem principal | Sinal esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | Recebimentos por Vendas de Ativo | `recebimentosVendasAtivo` | `SALDO_ATUAL` | balancete DRE/patrimonial | positivo | fechado |
| 22 | Compras de Imobilizado | `comprasImobilizado` | `DEBITO_NEG` | balancete patrimonial | negativo | fechado |
| 23 | Aquisicoes em Investimentos | `aquisicoesInvestimentos` | `DEBITO_NEG` | balancete patrimonial | negativo | fechado |
| 24 | Baixa de Ativo Imobilizado | `baixaAtivoImobilizado` | `SALDO_ATUAL` | balancete DRE | conforme lançamento | confirmar semântica |
| 25 | Resultado de Investimento | `resultadoInvestimento` | `DERIVADA` = linhas 21 a 24 | cálculo | conforme soma | fechado |

### Bloco financeiro

| Ordem | Linha DFC | Chave técnica | Operação esperada | Origem principal | Sinal esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 26 | Integralizacao ou Aumento de Capital Social | `integralizacaoAumentoCapitalSocial` | `CREDITO_MENOS_DEBITO` | balancete patrimonial | conforme lançamento | fechado |
| 27 | Pagamento de Lucros e Dividendos | `pagamentoLucrosDividendos` | `SALDO_ATUAL_NEG` | balancete patrimonial/equity | negativo | fechado |
| 28 | Variacao em Emprestimos/Financiamentos | `variacaoEmprestimosFinanciamentos` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 29 | Dividendos Provisionados a Pagar | `dividendosProvisionadosPagar` | `AS-SA` | balancete patrimonial | conforme variação | quase fechado |
| 30 | Variacao Emprestimos Pessoas Ligadas PJ/PF | `variacaoEmprestimosPessoasLigadas` | `AS-SA` | balancete patrimonial | conforme variação | fechado |
| 31 | Resultado Financeiro | `resultadoFinanceiro` | `DERIVADA` = linhas 26 a 30 | cálculo | conforme soma | fechado |

### Bloco de caixa

| Ordem | Linha DFC | Chave técnica | Operação esperada | Origem principal | Sinal esperado | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 32 | Saldo Inicial Disponivel | `saldoInicialDisponivel` | saldo inicial do disponível | balancete patrimonial | positivo | fechado |
| 33 | Saldo Final Disponivel | `saldoFinalDisponivel` | saldo final do disponível | balancete patrimonial | positivo | fechado |
| 34 | Resultado Geracao de Caixa | `resultadoGeracaoCaixa` | `DERIVADA` por diferença entre disponível | cálculo | conforme diferença | pendente confirmação |

## Regras adicionais de homologação

- As linhas `Variacao Ativo` e `Variacao Passivo` continuam existindo apenas como subtotal na tela, não como linhas parametrizáveis independentes.
- As linhas `Lucro Ajustado`, `Resultado Operacional`, `Resultado de Investimento`, `Resultado Financeiro` e `Resultado Geracao de Caixa` são sempre derivadas e não devem receber mapeamento manual.
- `Compras de Imobilizado`, `Aquisicoes em Investimentos` e `Pagamento de Lucros e Dividendos` devem sair negativas mesmo que a base venha positiva.
- Se a conta não existir no balancete da empresa, o valor da linha deve ser `0`.
- Linhas de total de ativo e passivo não entram no cálculo nem devem aparecer como regra.
- Diferenças de nomenclatura entre empresas devem ser absorvidas pela parametrização, não pela fórmula.

## Diagnóstico técnico

### Limitação estrutural principal

Hoje o balancete mensal é parseado com as quatro colunas, mas na persistência do DFC mensal só o `Saldo Atual` vai para `monthlyMovement.values`. Isso impede implementar de forma confiável as regras que dependem de:

- `Saldo Anterior`;
- `Débito`;
- `Crédito`;
- distinção explícita entre operação por saldo e operação por movimentação.

### Impacto

Sem mudar o modelo de dados, qualquer ajuste fino no DFC ficará incompleto ou dependerá de heurística.

## Plano de implementação

### Fase 1 - Fechar regra funcional

1. Criar uma tabela canônica de regras por linha do DFC.
2. Confirmar com o Karim apenas os pontos sensíveis:
   - fórmula final de `Resultado da Geração de Caixa`;
   - regra exata de `Resultado da Equivalência Patrimonial`;
   - se `Resultado Liquido do Exercício` vem sempre do DRE ou se precisa aceitar regra manual por contas.
3. Eliminar duplicidades de contas nas linhas de ativo e passivo.

### Fase 2 - Ajustar persistência do balancete

1. Ajustar a persistência apenas do balancete mensal usado pelo DFC com colunas separadas:
   - `saldo_anterior`;
   - `debito`;
   - `credito`;
   - `saldo_atual`.
2. Opções de implementação:
   - adicionar nova tabela dedicada ao balancete DFC mensal;
   - ou expandir a persistência usada pelo DFC sem alterar o comportamento das outras rotinas.
3. Reprocessar os arquivos já importados para preencher a nova base, se necessário.

### Fase 3 - Refatorar motor do DFC

1. Trocar o cálculo genérico de variação por regras por linha.
2. Criar funções explícitas de cálculo:
   - `saldoAnteriorMenosSaldoAtual`;
   - `saldoAtualMenosSaldoAnterior`;
   - `saldoAtualPositivo`;
   - `debitoNegativo`;
   - `creditoMenosDebito`;
   - `somaSempreNegativa`.
3. Aplicar a regra por linha com base numa matriz declarativa.
4. Manter subtotais derivados como composição das linhas-base.
5. Buscar sempre as contas já parametrizadas no DFC antes de calcular.

### Fase 4 - Ajustar API e tela

1. Atualizar `/api/dfc/summary` para usar o novo motor.
2. Garantir que o cálculo use apenas o contexto do cliente/mês importado e os mapeamentos de DFC já existentes.
2. Atualizar `balancete-preview` para exibir de fato:
   - `Saldo Anterior`;
   - `Débito`;
   - `Crédito`;
   - `Saldo Atual`.
3. Remover qualquer menção visual a “total ativo” e “total passivo” se ainda existir em alguma exportação ou preview.
4. Se necessário, mostrar no detalhe das linhas a regra aplicada.
5. Não alterar a experiência das outras áreas do portal.

### Fase 5 - Testes e homologação

1. Criar testes unitários por linha do DFC.
2. Criar fixture com balancete exemplo + DFC esperado do Karim.
3. Validar:
   - empresa com venda de ativo;
   - empresa sem venda de ativo;
   - empresa sem algumas linhas parametrizadas;
   - empresa com apenas parte dos meses importados.
4. Comparar resultado calculado x DFC enviado pelo cliente para o mês 6.

## Ordem sugerida de entrega

1. Tabela de regras validada.
2. Mudança de modelo/persistência do balancete DFC.
3. Refatoração do motor de cálculo.
4. Ajuste das telas e preview.
5. Homologação com arquivo real.

## Critérios de aceite

- Cada linha do DFC tem regra explícita, documentada e testada.
- O sistema usa as colunas corretas do balancete conforme a reunião.
- O sistema pega exatamente as contas já parametrizadas no DFC para compor o cálculo.
- O cálculo acontece após a importação mensal dentro do painel do cliente.
- Linhas com sinal obrigatório negativo sempre saem negativas.
- A soma dos subtotais fecha com o DFC de referência do cliente.
- Contas ausentes não quebram o cálculo; apenas retornam zero.
- O preview do balancete mostra as quatro colunas corretamente.
- Nenhuma outra função do sistema muda de comportamento.

## Pendências para confirmação

- Confirmar se `Resultado da Geração de Caixa` deve mesmo ser exibido por diferença de disponível ou por soma dos blocos. A reunião descreve a diferença de disponível, mas isso pode conflitar com a apresentação tradicional do DFC indireto.
- Confirmar se `Lucros a Distribuir` e `Dividendos Provisionados a Pagar` são a mesma linha operacionalmente ou se haverá duas regras diferentes conforme a conta.
- Confirmar se `Recebimentos de Lucros e Dividendos de Subsidiárias` permanece positivo em qualquer cenário.

## Recomendação final

Ajustar apenas fórmulas no motor atual não resolve o problema inteiro. O caminho mais seguro é:

1. fechar a tabela de regras;
2. preservar as quatro colunas do balancete no fluxo do DFC;
3. refatorar o DFC para operar por regra declarativa por linha;
4. manter o escopo isolado no DFC, sem mexer nas outras funções do sistema.

Esse é o menor caminho para chegar em um DFC auditável e homologável com os arquivos reais enviados pelo cliente.
