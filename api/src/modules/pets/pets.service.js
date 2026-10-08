import prisma from "../../config/prisma.js";

function limparTexto(valor) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

function prepararData(valor) {
  if (!valor) return null;
  return new Date(`${valor}T00:00:00.000Z`);
}

async function validarRelacionamentos({ organizacaoId, clienteId, especieId, racaId }) {
  if (clienteId) {
    const cliente = await prisma.cliente.findFirst({
      where: { id: clienteId, organizacaoId, ativo: true },
      select: { id: true },
    });
    if (!cliente) throw new Error("CLIENTE_NAO_ENCONTRADO");
  }

  const especie = await prisma.especie.findFirst({
    where: { id: especieId, organizacaoId, ativo: true },
  });
  if (!especie) throw new Error("ESPECIE_NAO_ENCONTRADA");

  if (racaId) {
    const raca = await prisma.raca.findFirst({
      where: {
        id: racaId,
        especieId,
        ativo: true,
        especie: { organizacaoId },
      },
    });
    if (!raca) throw new Error("RACA_NAO_PERTENCE_ESPECIE");
  }
}

function prepararDadosPet(dados) {
  const data = {};
  if ("especieId" in dados) data.especieId = dados.especieId;
  if ("racaId" in dados) data.racaId = dados.racaId || null;
  if ("nome" in dados) data.nome = dados.nome.trim();
  if ("sexo" in dados) data.sexo = dados.sexo;
  if ("dataNascimento" in dados) data.dataNascimento = prepararData(dados.dataNascimento);
  if ("castrado" in dados) data.castrado = dados.castrado;

  for (const campo of [
    "cor",
    "microchip",
    "fotoUrl",
    "alergias",
    "doencasPreexistentes",
    "observacoes",
  ]) {
    if (campo in dados) data[campo] = limparTexto(dados[campo]);
  }
  return data;
}

export async function criarPet(organizacaoId, dados) {
  await validarRelacionamentos({
    organizacaoId,
    clienteId: dados.clienteId,
    especieId: dados.especieId,
    racaId: dados.racaId,
  });

  if (dados.microchip) {
    const existente = await prisma.pet.findUnique({
      where: { microchip: dados.microchip.trim() },
    });
    if (existente) throw new Error("MICROCHIP_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    const pet = await tx.pet.create({
      data: {
        clienteId: dados.clienteId,
        ...prepararDadosPet(dados),
      },
    });

    if (dados.peso) {
      await tx.petPeso.create({
        data: {
          petId: pet.id,
          peso: dados.peso,
          origem: "CADASTRO_INICIAL",
        },
      });
    }

    return tx.pet.findUnique({
      where: { id: pet.id },
      include: {
        cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
        especie: true,
        raca: true,
        pesos: { orderBy: { data: "desc" } },
      },
    });
  });
}

export async function listarPets({
  organizacaoId,
  busca,
  clienteId,
  especieId,
  pagina = 1,
  limite = 20,
}) {
  const skip = (pagina - 1) * limite;
  const buscaNumerica = busca ? String(busca).replace(/\D/g, "") : "";

  const where = {
    ativo: true,
    cliente: { organizacaoId },
    ...(clienteId ? { clienteId } : {}),
    ...(especieId ? { especieId, especie: { organizacaoId } } : {}),
    ...(busca
      ? {
          OR: [
            { nome: { contains: busca, mode: "insensitive" } },
            { microchip: { contains: busca, mode: "insensitive" } },
            { cliente: { organizacaoId, nome: { contains: busca, mode: "insensitive" } } },
            { cliente: { organizacaoId, telefone: { contains: buscaNumerica || busca } } },
            { cliente: { organizacaoId, whatsapp: { contains: buscaNumerica || busca } } },
          ],
        }
      : {}),
  };

  const [pets, total] = await prisma.$transaction([
    prisma.pet.findMany({
      where,
      skip,
      take: limite,
      orderBy: { nome: "asc" },
      select: {
        id: true,
        nome: true,
        sexo: true,
        dataNascimento: true,
        castrado: true,
        cor: true,
        microchip: true,
        fotoUrl: true,
        cliente: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
        especie: { select: { id: true, nome: true } },
        raca: { select: { id: true, nome: true } },
        pesos: { orderBy: { data: "desc" }, take: 1 },
      },
    }),
    prisma.pet.count({ where }),
  ]);

  return {
    dados: pets,
    paginacao: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  };
}

export async function buscarPetPorId(organizacaoId, id) {
  const pet = await prisma.pet.findFirst({
    where: { id, cliente: { organizacaoId } },
    include: {
      cliente: true,
      especie: true,
      raca: true,
      pesos: { orderBy: { data: "desc" } },
    },
  });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");
  return pet;
}

export async function atualizarPet(organizacaoId, id, dados) {
  const atual = await prisma.pet.findFirst({
    where: { id, cliente: { organizacaoId } },
  });
  if (!atual) throw new Error("PET_NAO_ENCONTRADO");

  const especieId = dados.especieId ?? atual.especieId;
  const racaId = Object.prototype.hasOwnProperty.call(dados, "racaId")
    ? dados.racaId || null
    : atual.racaId;

  await validarRelacionamentos({ organizacaoId, especieId, racaId });

  if (dados.microchip && dados.microchip.trim() !== atual.microchip) {
    const existente = await prisma.pet.findUnique({
      where: { microchip: dados.microchip.trim() },
    });
    if (existente && existente.id !== id) throw new Error("MICROCHIP_JA_CADASTRADO");
  }

  return prisma.$transaction(async (tx) => {
    await tx.pet.update({ where: { id }, data: prepararDadosPet(dados) });

    if (dados.peso) {
      await tx.petPeso.create({
        data: { petId: id, peso: dados.peso, origem: "ATUALIZACAO_CADASTRO" },
      });
    }

    return tx.pet.findUnique({
      where: { id },
      include: {
        cliente: true,
        especie: true,
        raca: true,
        pesos: { orderBy: { data: "desc" }, take: 10 },
      },
    });
  });
}

export async function adicionarPeso(organizacaoId, petId, dados) {
  const pet = await prisma.pet.findFirst({
    where: { id: petId, ativo: true, cliente: { organizacaoId } },
    select: { id: true },
  });
  if (!pet) throw new Error("PET_NAO_ENCONTRADO");

  return prisma.petPeso.create({
    data: {
      petId,
      peso: dados.peso,
      data: dados.data ? prepararData(dados.data) : new Date(),
      origem: limparTexto(dados.origem) || "MANUAL",
      observacao: limparTexto(dados.observacao),
    },
  });
}

export async function listarEspecies(organizacaoId) {
  return prisma.especie.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { nome: "asc" },
  });
}

export async function criarEspecie(organizacaoId, dados) {
  const existente = await prisma.especie.findFirst({
    where: {
      organizacaoId,
      nome: { equals: dados.nome, mode: "insensitive" },
    },
  });
  if (existente) throw new Error("ESPECIE_JA_CADASTRADA");

  return prisma.especie.create({
    data: { organizacaoId, nome: dados.nome.trim() },
  });
}

export async function atualizarEspecie(organizacaoId, id, dados) {
  const especie = await prisma.especie.findFirst({ where: { id, organizacaoId } });
  if (!especie) throw new Error("ESPECIE_NAO_ENCONTRADA");

  if (dados.nome && dados.nome !== especie.nome) {
    const duplicada = await prisma.especie.findFirst({
      where: {
        organizacaoId,
        id: { not: id },
        nome: { equals: dados.nome, mode: "insensitive" },
      },
    });
    if (duplicada) throw new Error("ESPECIE_JA_CADASTRADA");
  }

  return prisma.especie.update({
    where: { id },
    data: {
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(typeof dados.ativo === "boolean" ? { ativo: dados.ativo } : {}),
    },
  });
}

export async function listarRacas(organizacaoId, especieId) {
  return prisma.raca.findMany({
    where: {
      ativo: true,
      especie: { organizacaoId },
      ...(especieId ? { especieId } : {}),
    },
    orderBy: { nome: "asc" },
    include: { especie: { select: { id: true, nome: true } } },
  });
}

export async function criarRaca(organizacaoId, dados) {
  const especie = await prisma.especie.findFirst({
    where: { id: dados.especieId, organizacaoId, ativo: true },
  });
  if (!especie) throw new Error("ESPECIE_NAO_ENCONTRADA");

  const existente = await prisma.raca.findFirst({
    where: {
      especieId: dados.especieId,
      nome: { equals: dados.nome, mode: "insensitive" },
    },
  });
  if (existente) throw new Error("RACA_JA_CADASTRADA");

  return prisma.raca.create({
    data: { especieId: dados.especieId, nome: dados.nome.trim() },
  });
}

export async function atualizarRaca(organizacaoId, id, dados) {
  const raca = await prisma.raca.findFirst({
    where: { id, especie: { organizacaoId } },
  });
  if (!raca) throw new Error("RACA_NAO_ENCONTRADA");

  if (dados.nome && dados.nome !== raca.nome) {
    const duplicada = await prisma.raca.findFirst({
      where: {
        especieId: raca.especieId,
        id: { not: id },
        nome: { equals: dados.nome, mode: "insensitive" },
      },
    });
    if (duplicada) throw new Error("RACA_JA_CADASTRADA");
  }

  return prisma.raca.update({
    where: { id },
    data: {
      ...(dados.nome ? { nome: dados.nome.trim() } : {}),
      ...(typeof dados.ativo === "boolean" ? { ativo: dados.ativo } : {}),
    },
  });
}
