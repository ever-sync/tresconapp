import bcrypt from "bcryptjs";

import prisma from "../src/lib/prisma";
import { rebuildStatements } from "../src/lib/statement-snapshots";

const TEST_PASSWORD = "Teste1234!";
const TEST_ACCOUNTING_EMAIL = "contato@exemplo.com.br";
const TEST_STAFF_EMAIL = "teste.login@exemplo.com";
const REPORT_YEAR = 2026;
const PREVIOUS_YEAR = REPORT_YEAR - 1;

type MockClientDefinition = {
  name: string;
  cnpj: string;
  email: string;
  taxRegime: "simples" | "presumido" | "real" | "mei";
  industry: string;
  signals: Array<{
    category:
      | "fiscal"
      | "trabalhista"
      | "tributario"
      | "financeiro"
      | "comportamento"
      | "societario"
      | "evento_critico";
    severity: "low" | "medium" | "high" | "critical";
    status: "open" | "in_progress" | "resolved";
    title: string;
    internalNote: string;
    clientTalkingPoint: string;
    estimatedValue?: number;
    dueDate?: string;
    periodMonth?: number;
  }>;
  documents: Array<{
    displayName: string;
    category: string;
    documentType: string;
    periodMonth: number | null;
    viewed: boolean;
  }>;
  tickets: Array<{
    subject: string;
    message: string;
    priority: "low" | "medium" | "high";
    status: "open" | "in_progress" | "closed";
  }>;
  dreRows: Array<{
    code: string;
    name: string;
    category: string;
    values: number[];
  }>;
  patrimonialRowsCurrent: Array<{
    code: string;
    name: string;
    category: string;
    values: number[];
  }>;
  patrimonialRowsPrevious: Array<{
    code: string;
    name: string;
    category: string;
    values: number[];
  }>;
};

const MOCK_CLIENTS: MockClientDefinition[] = [
  {
    name: "Tech Solutions SA",
    cnpj: "98765432000188",
    email: "contato@techsolutions.com.br",
    taxRegime: "simples",
    industry: "Tecnologia",
    signals: [
      {
        category: "fiscal",
        severity: "high",
        status: "open",
        title: "Guia de ISS sem confirmacao de pagamento",
        internalNote: "A guia de ISS de abril segue em aberto e o vencimento ocorre antes do fechamento do mes.",
        clientTalkingPoint: "Identificamos uma guia de ISS proxima do vencimento e recomendamos priorizar a regularizacao para evitar multa.",
        estimatedValue: 3200,
        dueDate: "2026-04-10T12:00:00.000Z",
        periodMonth: 4,
      },
      {
        category: "trabalhista",
        severity: "medium",
        status: "in_progress",
        title: "Pro-labore sem consistencia com a folha",
        internalNote: "O pro-labore atual nao acompanha o crescimento da folha e pode exigir revisao com o socio.",
        clientTalkingPoint: "Vale revisar a estrutura de pro-labore e encargos para manter a folha coerente com a operacao.",
        estimatedValue: 1800,
        periodMonth: 4,
      },
      {
        category: "tributario",
        severity: "high",
        status: "open",
        title: "Empresa perto de mudanca de faixa no Simples",
        internalNote: "A receita acumulada do ano indica aproximacao da proxima faixa e pode alterar a carga tributaria do proximo trimestre.",
        clientTalkingPoint: "Sua receita esta proxima da proxima faixa do Simples; recomendamos simular cenarios para evitar surpresa de carga tributaria.",
        estimatedValue: 9400,
        periodMonth: 4,
      },
      {
        category: "comportamento",
        severity: "medium",
        status: "open",
        title: "Envio de documentos concentrado no fim do prazo",
        internalNote: "Os documentos de suporte chegaram perto do fechamento e aumentaram o retrabalho da equipe.",
        clientTalkingPoint: "Se conseguirmos antecipar o envio dos documentos-chave, ganhamos previsibilidade e reduzimos retrabalho no fechamento.",
        periodMonth: 4,
      },
      {
        category: "evento_critico",
        severity: "critical",
        status: "open",
        title: "Certidao fiscal vence nos proximos dias",
        internalNote: "A certidao usada em processos comerciais vence nesta semana e depende de regularizacao imediata.",
        clientTalkingPoint: "Identificamos um vencimento importante de certidao e vamos tratar a renovacao para evitar bloqueios operacionais.",
        dueDate: "2026-04-08T12:00:00.000Z",
        periodMonth: 4,
      },
      {
        category: "societario",
        severity: "low",
        status: "resolved",
        title: "CNAE secundario revisado",
        internalNote: "O CNAE secundario foi revisado e ja nao representa risco imediato.",
        clientTalkingPoint: "O enquadramento societario foi revisado e ficou alinhado com a operacao atual.",
        periodMonth: 3,
      },
    ],
    documents: [
      {
        displayName: "Balancete abril 2026.xlsx",
        category: "Contabil",
        documentType: "general",
        periodMonth: 4,
        viewed: false,
      },
      {
        displayName: "Folha pro-labore abril 2026.pdf",
        category: "Pessoal",
        documentType: "general",
        periodMonth: 4,
        viewed: false,
      },
      {
        displayName: "Guias municipais abril 2026.pdf",
        category: "Fiscal",
        documentType: "general",
        periodMonth: 4,
        viewed: true,
      },
    ],
    tickets: [
      {
        subject: "Validar pagamento de ISS",
        message: "Precisamos confirmar a guia do ISS antes do vencimento e validar a baixa no financeiro.",
        priority: "high",
        status: "open",
      },
      {
        subject: "Revisao de pro-labore",
        message: "Cliente pediu apoio para ajustar pro-labore e alinhamento com crescimento da equipe.",
        priority: "medium",
        status: "in_progress",
      },
    ],
    dreRows: [
      {
        code: "3.1.01",
        name: "Receita Bruta de Servicos",
        category: "receita_bruta",
        values: [250000, 255000, 262000, 268000, 274000, 280000, 286000, 292000, 300000, 308000, 316000, 324000],
      },
      {
        code: "3.2.01",
        name: "Custos dos Servicos",
        category: "custos_servicos",
        values: [-98000, -100000, -101000, -104000, -105000, -107000, -108000, -109000, -111000, -112000, -114000, -115000],
      },
      {
        code: "3.2.02",
        name: "Custos das Vendas",
        category: "custos_vendas",
        values: [-18000, -19000, -19500, -19800, -20500, -20800, -21000, -21400, -21800, -22000, -22500, -23000],
      },
      {
        code: "3.3.01",
        name: "Despesas Administrativas",
        category: "despesas_administrativas",
        values: [-36000, -36500, -37000, -37500, -38000, -38200, -38500, -38800, -39200, -39600, -40000, -40500],
      },
      {
        code: "3.3.02",
        name: "Despesas Comerciais",
        category: "despesas_comerciais",
        values: [-14500, -14800, -15000, -15200, -15400, -15600, -15700, -15900, -16000, -16200, -16400, -16500],
      },
      {
        code: "3.3.03",
        name: "Despesas Tributarias",
        category: "despesas_tributarias",
        values: [-8200, -8300, -8350, -8450, -8500, -8600, -8650, -8700, -8800, -8850, -8900, -9000],
      },
      {
        code: "3.4.01",
        name: "Receitas Financeiras",
        category: "receitas_financeiras",
        values: [1200, 1250, 1300, 1300, 1350, 1400, 1420, 1450, 1480, 1500, 1520, 1550],
      },
      {
        code: "3.4.02",
        name: "Despesas Financeiras",
        category: "despesas_financeiras",
        values: [-2500, -2550, -2600, -2620, -2650, -2680, -2720, -2750, -2780, -2820, -2850, -2880],
      },
      {
        code: "3.4.03",
        name: "Depreciacao e Amortizacao",
        category: "depreciacao_amortizacao",
        values: [-6000, -6000, -6000, -6000, -6000, -6000, -6000, -6000, -6000, -6000, -6000, -6000],
      },
      {
        code: "3.5.01",
        name: "IRPJ e CSLL",
        category: "irpj_csll",
        values: [-8200, -8400, -8500, -8600, -8750, -8900, -9000, -9150, -9300, -9450, -9600, -9800],
      },
    ],
    patrimonialRowsCurrent: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [85000, 88000, 91000, 94000, 91000, 96000, 98000, 101000, 104000, 107000, 110000, 114000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [118000, 121000, 124000, 129000, 132000, 136000, 139000, 142000, 146000, 149000, 152000, 156000],
      },
      {
        code: "1.1.03",
        name: "Estoques",
        category: "estoques",
        values: [18000, 18200, 18400, 18700, 18900, 19100, 19400, 19700, 19900, 20100, 20400, 20600],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [210000, 208000, 206000, 204000, 202000, 200000, 198000, 196000, 194000, 192000, 190000, 188000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-65000, -67000, -69000, -71000, -73000, -74500, -76000, -77500, -79000, -80500, -82000, -83500],
      },
      {
        code: "2.1.02",
        name: "Obrigacoes Trabalhistas",
        category: "obrigacoes_trabalhistas",
        values: [-32000, -32500, -33000, -33500, -34000, -34500, -35000, -35500, -36000, -36500, -37000, -37500],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-24000, -24500, -25000, -25400, -25800, -26200, -26600, -27000, -27400, -27800, -28200, -28600],
      },
      {
        code: "2.1.04",
        name: "Emprestimos CP",
        category: "emprestimos_financiamentos_cp",
        values: [-48000, -47000, -46000, -45500, -45000, -44500, -44000, -43500, -43000, -42500, -42000, -41500],
      },
      {
        code: "2.2.01",
        name: "Emprestimos LP",
        category: "emprestimos_financiamentos_lp",
        values: [-110000, -108000, -106000, -104000, -102000, -100000, -98000, -96000, -94000, -92000, -90000, -88000],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-32000, -36000, -42000, -49000, -55000, -62000, -70000, -78000, -86000, -94000, -103000, -112000],
      },
    ],
    patrimonialRowsPrevious: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [72000, 74000, 76000, 78000, 80000, 82000, 84000, 86000, 88000, 90000, 92000, 94000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [98000, 101000, 104000, 107000, 110000, 113000, 116000, 119000, 122000, 125000, 128000, 131000],
      },
      {
        code: "1.1.03",
        name: "Estoques",
        category: "estoques",
        values: [15500, 15800, 16000, 16300, 16600, 16900, 17100, 17400, 17700, 18000, 18200, 18500],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [222000, 220000, 218000, 216000, 214000, 212000, 210000, 208000, 206000, 204000, 202000, 200000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-58000, -59500, -61000, -62500, -64000, -65500, -67000, -68500, -70000, -71500, -73000, -74500],
      },
      {
        code: "2.1.02",
        name: "Obrigacoes Trabalhistas",
        category: "obrigacoes_trabalhistas",
        values: [-28000, -28500, -29000, -29500, -30000, -30500, -31000, -31500, -32000, -32500, -33000, -33500],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-21500, -22000, -22500, -23000, -23500, -24000, -24500, -25000, -25500, -26000, -26500, -27000],
      },
      {
        code: "2.1.04",
        name: "Emprestimos CP",
        category: "emprestimos_financiamentos_cp",
        values: [-52000, -51500, -51000, -50500, -50000, -49500, -49000, -48500, -48000, -47500, -47000, -46500],
      },
      {
        code: "2.2.01",
        name: "Emprestimos LP",
        category: "emprestimos_financiamentos_lp",
        values: [-128000, -126000, -124000, -122000, -120000, -118000, -116000, -114000, -112000, -110000, -108000, -106000],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000, -120000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-18000, -22000, -26000, -30000, -34000, -38000, -42000, -46000, -50000, -54000, -58000, -62000],
      },
    ],
  },
  {
    name: "COCA COLA FEMSA BRASIL LTDA",
    cnpj: "11222333000144",
    email: "financeiro@cocafemsa.mock",
    taxRegime: "real",
    industry: "Bebidas",
    signals: [
      {
        category: "financeiro",
        severity: "low",
        status: "resolved",
        title: "Caixa com sobra operacional",
        internalNote: "O cliente segue com boa liquidez e caixa positivo no trimestre.",
        clientTalkingPoint: "A operacao segue saudavel e com folga de caixa no periodo avaliado.",
        periodMonth: 4,
      },
      {
        category: "tributario",
        severity: "medium",
        status: "open",
        title: "Credito tributario em revisao",
        internalNote: "Ha espaco para revisar compensacoes e recuperar creditos nao aproveitados.",
        clientTalkingPoint: "Identificamos oportunidade de revisar creditos tributarios e validar recuperacoes possiveis.",
        estimatedValue: 22000,
        periodMonth: 4,
      },
    ],
    documents: [
      {
        displayName: "Balancete abril 2026 - FEMSA.xlsx",
        category: "Contabil",
        documentType: "general",
        periodMonth: 4,
        viewed: true,
      },
    ],
    tickets: [
      {
        subject: "Ajuste de compensacao tributaria",
        message: "Validar base das compensacoes do trimestre e fechar parecer.",
        priority: "medium",
        status: "in_progress",
      },
    ],
    dreRows: [
      {
        code: "3.1.01",
        name: "Receita Bruta de Produtos",
        category: "receita_bruta",
        values: [640000, 648000, 652000, 660000, 668000, 675000, 683000, 690000, 698000, 706000, 714000, 722000],
      },
      {
        code: "3.2.01",
        name: "Custos das Vendas",
        category: "custos_vendas",
        values: [-300000, -304000, -306000, -309000, -312000, -315000, -318000, -321000, -324000, -327000, -330000, -334000],
      },
      {
        code: "3.3.01",
        name: "Despesas Administrativas",
        category: "despesas_administrativas",
        values: [-72000, -72400, -72800, -73200, -73600, -74000, -74400, -74800, -75200, -75600, -76000, -76400],
      },
      {
        code: "3.3.02",
        name: "Despesas Comerciais",
        category: "despesas_comerciais",
        values: [-58000, -58500, -59000, -59400, -59800, -60200, -60600, -61000, -61400, -61800, -62200, -62600],
      },
      {
        code: "3.3.03",
        name: "Despesas Tributarias",
        category: "despesas_tributarias",
        values: [-12000, -12100, -12200, -12300, -12400, -12500, -12600, -12700, -12800, -12900, -13000, -13100],
      },
      {
        code: "3.4.03",
        name: "Depreciacao",
        category: "depreciacao_amortizacao",
        values: [-10000, -10000, -10000, -10000, -10000, -10000, -10000, -10000, -10000, -10000, -10000, -10000],
      },
      {
        code: "3.5.01",
        name: "IRPJ e CSLL",
        category: "irpj_csll",
        values: [-16000, -16200, -16400, -16600, -16800, -17000, -17200, -17400, -17600, -17800, -18000, -18200],
      },
    ],
    patrimonialRowsCurrent: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [220000, 225000, 229000, 234000, 239000, 244000, 249000, 254000, 259000, 264000, 269000, 274000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [305000, 308000, 312000, 316000, 320000, 324000, 328000, 332000, 336000, 340000, 344000, 348000],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [410000, 406000, 402000, 398000, 394000, 390000, 386000, 382000, 378000, 374000, 370000, 366000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-188000, -190000, -192000, -194000, -196000, -198000, -200000, -202000, -204000, -206000, -208000, -210000],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-54000, -54500, -55000, -55500, -56000, -56500, -57000, -57500, -58000, -58500, -59000, -59500],
      },
      {
        code: "2.2.01",
        name: "Emprestimos LP",
        category: "emprestimos_financiamentos_lp",
        values: [-180000, -176000, -172000, -168000, -164000, -160000, -156000, -152000, -148000, -144000, -140000, -136000],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-253000, -258000, -264000, -270000, -276000, -282000, -288000, -294000, -300000, -306000, -312000, -318000],
      },
    ],
    patrimonialRowsPrevious: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [200000, 204000, 208000, 212000, 216000, 220000, 224000, 228000, 232000, 236000, 240000, 244000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [284000, 287000, 290000, 293000, 296000, 299000, 302000, 305000, 308000, 311000, 314000, 317000],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [458000, 454000, 450000, 446000, 442000, 438000, 434000, 430000, 426000, 422000, 418000, 414000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-172000, -174000, -176000, -178000, -180000, -182000, -184000, -186000, -188000, -190000, -192000, -194000],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-50000, -50500, -51000, -51500, -52000, -52500, -53000, -53500, -54000, -54500, -55000, -55500],
      },
      {
        code: "2.2.01",
        name: "Emprestimos LP",
        category: "emprestimos_financiamentos_lp",
        values: [-212000, -208000, -204000, -200000, -196000, -192000, -188000, -184000, -180000, -176000, -172000, -168000],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000, -260000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-190000, -196000, -202000, -208000, -214000, -220000, -226000, -232000, -238000, -244000, -250000, -256000],
      },
    ],
  },
  {
    name: "Metalurgica Horizonte LTDA",
    cnpj: "55444333000191",
    email: "diretoria@horizonte.mock",
    taxRegime: "presumido",
    industry: "Industria",
    signals: [
      {
        category: "financeiro",
        severity: "high",
        status: "open",
        title: "Liquidez pressionada no curto prazo",
        internalNote: "O caixa caiu no trimestre enquanto passivos de curto prazo seguiram elevados.",
        clientTalkingPoint: "Percebemos pressao no caixa de curto prazo e recomendamos rever calendario de pagamentos e recebimentos.",
        estimatedValue: 6500,
        periodMonth: 4,
      },
      {
        category: "fiscal",
        severity: "medium",
        status: "open",
        title: "Conferencia pendente de guias estaduais",
        internalNote: "Faltam comprovantes de quitacao de guias estaduais do mes anterior.",
        clientTalkingPoint: "Precisamos confirmar algumas guias estaduais para fechar o periodo com seguranca.",
        estimatedValue: 2100,
        dueDate: "2026-04-15T12:00:00.000Z",
        periodMonth: 4,
      },
      {
        category: "societario",
        severity: "medium",
        status: "in_progress",
        title: "Capital social desatualizado",
        internalNote: "O porte atual da operacao indica necessidade de revisar capital social e instrumentos societarios.",
        clientTalkingPoint: "Recomendamos revisar o capital social para manter a estrutura societaria coerente com o porte atual da empresa.",
        periodMonth: 4,
      },
    ],
    documents: [
      {
        displayName: "Extrato bancario abril 2026.pdf",
        category: "Financeiro",
        documentType: "general",
        periodMonth: 4,
        viewed: false,
      },
      {
        displayName: "Guias estaduais marco 2026.pdf",
        category: "Fiscal",
        documentType: "general",
        periodMonth: 3,
        viewed: false,
      },
    ],
    tickets: [
      {
        subject: "Conciliar guias estaduais",
        message: "Equipe aguarda comprovantes de pagamento para fechar o fiscal do periodo.",
        priority: "medium",
        status: "open",
      },
    ],
    dreRows: [
      {
        code: "3.1.01",
        name: "Receita Bruta",
        category: "receita_bruta",
        values: [180000, 176000, 184000, 182000, 188000, 190000, 194000, 196000, 200000, 204000, 206000, 210000],
      },
      {
        code: "3.2.01",
        name: "Custos das Vendas",
        category: "custos_vendas",
        values: [-98000, -97000, -100000, -99500, -101000, -102500, -103500, -104000, -105500, -106500, -107500, -108500],
      },
      {
        code: "3.3.01",
        name: "Despesas Administrativas",
        category: "despesas_administrativas",
        values: [-34000, -33800, -34200, -34500, -34800, -35000, -35200, -35500, -35800, -36100, -36400, -36700],
      },
      {
        code: "3.3.03",
        name: "Despesas Tributarias",
        category: "despesas_tributarias",
        values: [-7600, -7500, -7700, -7800, -7900, -8000, -8100, -8200, -8300, -8400, -8500, -8600],
      },
      {
        code: "3.4.02",
        name: "Despesas Financeiras",
        category: "despesas_financeiras",
        values: [-5200, -5300, -5400, -5500, -5600, -5700, -5800, -5900, -6000, -6100, -6200, -6300],
      },
      {
        code: "3.5.01",
        name: "IRPJ e CSLL",
        category: "irpj_csll",
        values: [-4200, -4150, -4250, -4300, -4380, -4450, -4520, -4580, -4650, -4720, -4780, -4850],
      },
    ],
    patrimonialRowsCurrent: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [28000, 26000, 25000, 24000, 23000, 22000, 23000, 24000, 25000, 26000, 27000, 28000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [98000, 101000, 102000, 104000, 106000, 108000, 109000, 111000, 113000, 114000, 116000, 118000],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [162000, 160000, 158000, 156000, 154000, 152000, 150000, 148000, 146000, 144000, 142000, 140000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-88000, -89500, -91000, -92500, -94000, -95500, -97000, -98500, -100000, -101500, -103000, -104500],
      },
      {
        code: "2.1.02",
        name: "Obrigacoes Trabalhistas",
        category: "obrigacoes_trabalhistas",
        values: [-25000, -25500, -26000, -26500, -27000, -27500, -28000, -28500, -29000, -29500, -30000, -30500],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-18500, -18800, -19100, -19400, -19700, -20000, -20300, -20600, -20900, -21200, -21500, -21800],
      },
      {
        code: "2.1.04",
        name: "Emprestimos CP",
        category: "emprestimos_financiamentos_cp",
        values: [-54000, -53500, -53000, -52500, -52000, -51500, -51000, -50500, -50000, -49500, -49000, -48500],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-30000, -31500, -33000, -34500, -36000, -37500, -39000, -40500, -42000, -43500, -45000, -46500],
      },
    ],
    patrimonialRowsPrevious: [
      {
        code: "1.1.01",
        name: "Disponivel",
        category: "disponivel",
        values: [42000, 40000, 38000, 36000, 34000, 32000, 30000, 28000, 26000, 24000, 22000, 20000],
      },
      {
        code: "1.1.02",
        name: "Clientes",
        category: "clientes",
        values: [88000, 90000, 92000, 94000, 96000, 98000, 100000, 102000, 104000, 106000, 108000, 110000],
      },
      {
        code: "1.2.01",
        name: "Imobilizado",
        category: "imobilizado",
        values: [176000, 174000, 172000, 170000, 168000, 166000, 164000, 162000, 160000, 158000, 156000, 154000],
      },
      {
        code: "2.1.01",
        name: "Fornecedores",
        category: "fornecedores",
        values: [-76000, -77500, -79000, -80500, -82000, -83500, -85000, -86500, -88000, -89500, -91000, -92500],
      },
      {
        code: "2.1.02",
        name: "Obrigacoes Trabalhistas",
        category: "obrigacoes_trabalhistas",
        values: [-21500, -22000, -22500, -23000, -23500, -24000, -24500, -25000, -25500, -26000, -26500, -27000],
      },
      {
        code: "2.1.03",
        name: "Obrigacoes Tributarias",
        category: "obrigacoes_tributarias",
        values: [-16000, -16300, -16600, -16900, -17200, -17500, -17800, -18100, -18400, -18700, -19000, -19300],
      },
      {
        code: "2.1.04",
        name: "Emprestimos CP",
        category: "emprestimos_financiamentos_cp",
        values: [-62000, -61500, -61000, -60500, -60000, -59500, -59000, -58500, -58000, -57500, -57000, -56500],
      },
      {
        code: "3.1.01",
        name: "Capital Social",
        category: "capital_social",
        values: [-72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000, -72000],
      },
      {
        code: "3.1.02",
        name: "Reserva de Lucros",
        category: "reserva_lucros",
        values: [-22000, -23500, -25000, -26500, -28000, -29500, -31000, -32500, -34000, -35500, -37000, -38500],
      },
    ],
  },
];

function buildDocumentStoragePath(cnpj: string, fileName: string) {
  return `mock/${cnpj}/${fileName.toLowerCase().replace(/\s+/g, "-")}`;
}

async function seedMonthlyMovements(params: {
  accountingId: string;
  clientId: string;
  year: number;
  type: "dre" | "patrimonial";
  rows: Array<{ code: string; name: string; category: string; values: number[] }>;
}) {
  await prisma.$transaction(
    params.rows.map((row) =>
      prisma.monthlyMovement.upsert({
        where: {
          client_id_year_code_type: {
            client_id: params.clientId,
            year: params.year,
            code: row.code,
            type: params.type,
          },
        },
        update: {
          accounting_id: params.accountingId,
          reduced_code: row.code,
          name: row.name,
          level: 1,
          values: row.values,
          category: row.category,
          is_mapped: true,
          deleted_at: null,
        },
        create: {
          accounting_id: params.accountingId,
          client_id: params.clientId,
          year: params.year,
          code: row.code,
          reduced_code: row.code,
          name: row.name,
          level: 1,
          values: row.values,
          type: params.type,
          category: row.category,
          is_mapped: true,
        },
      })
    )
  );
}

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const accounting = await prisma.accounting.findFirst({
    where: {
      OR: [{ email: TEST_ACCOUNTING_EMAIL }, { name: "Contabilidade Exemplo LTDA" }],
    },
  });

  if (!accounting) {
    throw new Error("Nao encontrei a contabilidade de teste. Crie a contabilidade antes de rodar o seed.");
  }

  const staffUser = await prisma.user.upsert({
    where: { email: TEST_STAFF_EMAIL },
    update: {
      name: "Login Teste",
      password_hash: passwordHash,
      role: "admin",
      status: "active",
      accounting_id: accounting.id,
    },
    create: {
      accounting_id: accounting.id,
      name: "Login Teste",
      email: TEST_STAFF_EMAIL,
      password_hash: passwordHash,
      role: "admin",
      status: "active",
    },
  });

  const clients = [];

  for (const definition of MOCK_CLIENTS) {
    const client = await prisma.client.upsert({
      where: { cnpj: definition.cnpj },
      update: {
        accounting_id: accounting.id,
        name: definition.name,
        email: definition.email,
        industry: definition.industry,
        tax_regime: definition.taxRegime,
        password_hash: passwordHash,
        status: "active",
        deleted_at: null,
      },
      create: {
        accounting_id: accounting.id,
        name: definition.name,
        cnpj: definition.cnpj,
        email: definition.email,
        industry: definition.industry,
        tax_regime: definition.taxRegime,
        password_hash: passwordHash,
        status: "active",
      },
    });

    clients.push({ definition, client });
  }

  const primaryClient = clients[0]?.client;
  const referenceClient = clients[1]?.client ?? null;

  await prisma.notification.deleteMany({
    where: {
      accounting_id: accounting.id,
    },
  });

  const notifications = [
    {
      accounting_id: accounting.id,
      client_id: referenceClient?.id ?? null,
      audience: "staff",
      kind: "arquivos",
      title: "COCA COLA FEMSA BRASIL LTDA enviou um balancete",
      description: "Balancete de abril de 2026 disponivel para conferencia no painel.",
      entity_type: "client_document",
      entity_id: null,
      is_read: false,
    },
    {
      accounting_id: accounting.id,
      client_id: primaryClient?.id ?? null,
      audience: "staff",
      kind: "sistema",
      title: "Relatorio consultivo priorizado",
      description: "Tech Solutions SA entrou na fila de acompanhamento critico nesta semana.",
      entity_type: "consultative_report_signal",
      entity_id: null,
      is_read: false,
    },
    {
      accounting_id: accounting.id,
      client_id: primaryClient?.id ?? null,
      audience: "client",
      kind: "arquivos",
      title: "Resumo consultivo atualizado",
      description: "Seu resumo mais recente esta disponivel para alinhamento com a contabilidade.",
      entity_type: "financial_statement",
      entity_id: null,
      is_read: false,
    },
  ];

  await prisma.notification.createMany({ data: notifications });

  for (const { client, definition } of clients) {
    await prisma.consultativeReportSignal.deleteMany({
      where: {
        accounting_id: accounting.id,
        client_id: client.id,
      },
    });

    if (definition.signals.length > 0) {
      await prisma.consultativeReportSignal.createMany({
        data: definition.signals.map((signal) => ({
          accounting_id: accounting.id,
          client_id: client.id,
          category: signal.category,
          severity: signal.severity,
          status: signal.status,
          title: signal.title,
          internal_note: signal.internalNote,
          client_talking_point: signal.clientTalkingPoint,
          estimated_value: signal.estimatedValue ?? null,
          due_date: signal.dueDate ? new Date(signal.dueDate) : null,
          period_year: REPORT_YEAR,
          period_month: signal.periodMonth ?? null,
          source: "seed",
        })),
      });
    }

    await prisma.supportTicket.deleteMany({
      where: {
        accounting_id: accounting.id,
        client_id: client.id,
        subject: {
          in: definition.tickets.map((ticket) => ticket.subject),
        },
      },
    });

    for (const ticket of definition.tickets) {
      await prisma.supportTicket.create({
        data: {
          accounting_id: accounting.id,
          client_id: client.id,
          subject: ticket.subject,
          message: ticket.message,
          priority: ticket.priority,
          status: ticket.status,
        },
      });
    }

    await prisma.clientDocument.deleteMany({
      where: {
        accounting_id: accounting.id,
        client_id: client.id,
        display_name: {
          in: definition.documents.map((document) => document.displayName),
        },
      },
    });

    for (const document of definition.documents) {
      await prisma.clientDocument.create({
        data: {
          accounting_id: accounting.id,
          client_id: client.id,
          original_name: document.displayName,
          display_name: document.displayName,
          category: document.category,
          document_type: document.documentType,
          period_year: REPORT_YEAR,
          period_month: document.periodMonth,
          mime_type: document.displayName.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          size_bytes: document.displayName.toLowerCase().endsWith(".pdf") ? 380_000 : 142_000,
          storage_path: buildDocumentStoragePath(client.cnpj, document.displayName),
          description: "Documento mockado para alimentar o painel consultivo.",
          viewed_at: document.viewed ? new Date("2026-04-05T12:00:00.000Z") : null,
        },
      });
    }

    await seedMonthlyMovements({
      accountingId: accounting.id,
      clientId: client.id,
      year: REPORT_YEAR,
      type: "dre",
      rows: definition.dreRows,
    });

    await seedMonthlyMovements({
      accountingId: accounting.id,
      clientId: client.id,
      year: REPORT_YEAR,
      type: "patrimonial",
      rows: definition.patrimonialRowsCurrent,
    });

    await seedMonthlyMovements({
      accountingId: accounting.id,
      clientId: client.id,
      year: PREVIOUS_YEAR,
      type: "patrimonial",
      rows: definition.patrimonialRowsPrevious,
    });

    await rebuildStatements({
      accountingId: accounting.id,
      clientId: client.id,
      year: REPORT_YEAR,
      statementType: "all",
    });
  }

  console.log(
    JSON.stringify(
      {
        accounting: {
          id: accounting.id,
          name: accounting.name,
          email: accounting.email,
        },
        staff_login: {
          email: staffUser.email,
          password: TEST_PASSWORD,
        },
        clients_seeded: clients.map(({ client, definition }) => ({
          id: client.id,
          name: client.name,
          cnpj: client.cnpj,
          signals: definition.signals.length,
          documents: definition.documents.length,
          tickets: definition.tickets.length,
        })),
        notifications: notifications.length,
        report_year: REPORT_YEAR,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
