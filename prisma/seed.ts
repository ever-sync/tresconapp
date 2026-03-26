import bcrypt from "bcryptjs";

import prisma from "../src/lib/prisma";

const TEST_PASSWORD = "Teste1234!";
const TEST_ACCOUNTING_EMAIL = "contato@exemplo.com.br";
const TEST_STAFF_EMAIL = "teste.login@exemplo.com";
const TEST_CLIENT_CNPJ = "98765432000188";

async function main() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);

  const accounting = await prisma.accounting.findFirst({
    where: {
      OR: [
        { email: TEST_ACCOUNTING_EMAIL },
        { name: "Contabilidade Exemplo LTDA" },
      ],
    },
  });

  if (!accounting) {
    throw new Error(
      "Nao encontrei a contabilidade de teste. Crie a contabilidade antes de rodar o seed."
    );
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

  const client = await prisma.client.upsert({
    where: { cnpj: TEST_CLIENT_CNPJ },
    update: {
      password_hash: passwordHash,
      status: "active",
      deleted_at: null,
      accounting_id: accounting.id,
      name: "Tech Solutions SA",
    },
    create: {
      accounting_id: accounting.id,
      name: "Tech Solutions SA",
      cnpj: TEST_CLIENT_CNPJ,
      password_hash: passwordHash,
      status: "active",
      email: "contato@techsolutions.com.br",
      tax_regime: "simples",
    },
  });

  const referenceClient = await prisma.client.findFirst({
    where: {
      accounting_id: accounting.id,
      name: "COCA COLA FEMSA BRASIL LTDA",
    },
  });

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
      description: "Balancete Jan 2026 disponivel para conferencia no painel.",
      entity_type: "client_document",
      entity_id: null,
      is_read: false,
    },
    {
      accounting_id: accounting.id,
      client_id: null,
      audience: "staff",
      kind: "sistema",
      title: "Novo ticket aberto",
      description: "Um cliente abriu chamado com prioridade alta no suporte.",
      entity_type: "support_ticket",
      entity_id: null,
      is_read: false,
    },
    {
      accounting_id: accounting.id,
      client_id: client.id,
      audience: "client",
      kind: "arquivos",
      title: "DRE atualizado",
      description: "Novo relatorio disponivel dentro da area contabile.",
      entity_type: "financial_statement",
      entity_id: null,
      is_read: false,
    },
    {
      accounting_id: accounting.id,
      client_id: client.id,
      audience: "client",
      kind: "sistema",
      title: "Guia de impostos gerada",
      description: "Sua guia foi disponibilizada no portal do cliente.",
      entity_type: "system",
      entity_id: null,
      is_read: false,
    },
  ];

  await prisma.notification.createMany({
    data: notifications,
  });

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
        client_login: {
          cnpj: client.cnpj,
          password: TEST_PASSWORD,
        },
        notifications: notifications.length,
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
