export const MANDATORY_CATEGORIES = [
  "Insumos/CMV",
  "Embalagens",
  "Estrutura",
  "Pessoal",
  "Operacional",
  "Comercial",
  "Financeiro",
  "Tributos",
  "Outros",
] as const;

export type MandatoryCategory = (typeof MANDATORY_CATEGORIES)[number];

export interface DocumentItem {
  id: string;
  descricao: string | null;
  quantidade: number | null;
  unidade: string | null;
  valor_unitario: number | null;
  desconto_item: number | null;
  valor_total_item: number | null;
  categoria_sugerida: MandatoryCategory | null;
  subcategoria_sugerida: string | null;
}

export interface ExtractedDocument {
  tipo_documento: string | null;
  fornecedor: string | null;
  cnpj_cpf: string | null;
  numero_documento: string | null;
  data_emissao: string | null;
  data_vencimento: string | null;
  subtotal: number | null;
  desconto_documento: number | null;
  acrescimo_documento: number | null;
  valor_total_documento: number | null;
  itens: DocumentItem[];
  alertas_leitura: string[];
}

export interface UploadedFileState {
  name: string;
  mimeType: string;
  size: number;
  previewUrl: string;
  base64: string;
  isSample?: boolean;
}

export interface SessionStoreContext {
  nomeAcaiteria: string;
  email: string;
}

export interface DivergenceReport {
  somaItens: number;
  descontoDocumento: number;
  acrescimoDocumento: number;
  totalCalculado: number;
  valorTotalDocumento: number | null;
  diferenca: number | null;
  status: "match" | "divergence" | "missing_total";
}

export const SUBCATEGORY_SUGGESTIONS: Record<MandatoryCategory, string[]> = {
  "Insumos/CMV": [
    "Polpas e Cremes",
    "Complementos e Toppings",
    "Frutas Frescas",
    "Caldas e Coberturas",
    "Laticínios e Bases",
  ],
  Embalagens: [
    "Potes e Tampas",
    "Colheres e Descartáveis",
    "Sacolas e Delivery",
    "Rótulos e Etiquetas",
  ],
  Estrutura: [
    "Energia e Água",
    "Aluguel e Condomínio",
    "Manutenção de Freezers",
    "Internet e Telefonia",
  ],
  Pessoal: ["Salários e Encargos", "Uniformes e EPI", "Benefícios"],
  Operacional: [
    "Limpeza e Higiene",
    "Gelo e Refrigeração",
    "Frete e Logística",
    "Utensílios de Loja",
  ],
  Comercial: ["Marketing e Anúncios", "Taxas de Plataformas", "Material Promocional"],
  Financeiro: ["Tarifas Bancárias", "Juros e Multas", "Taxas de Cartão"],
  Tributos: ["Impostos e Guias", "Taxas Municipais"],
  Outros: ["Despesas Gerais"],
};

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateDivergence(doc: ExtractedDocument): DivergenceReport {
  const somaItens = roundCurrency(
    doc.itens.reduce((acc, item) => {
      const val = typeof item.valor_total_item === "number" && Number.isFinite(item.valor_total_item)
        ? item.valor_total_item
        : 0;
      return acc + val;
    }, 0)
  );

  const descontoDocumento =
    typeof doc.desconto_documento === "number" && Number.isFinite(doc.desconto_documento)
      ? Math.abs(doc.desconto_documento)
      : 0;

  const acrescimoDocumento =
    typeof doc.acrescimo_documento === "number" && Number.isFinite(doc.acrescimo_documento)
      ? Math.abs(doc.acrescimo_documento)
      : 0;

  const totalCalculado = roundCurrency(somaItens - descontoDocumento + acrescimoDocumento);
  const valorTotalDocumento =
    typeof doc.valor_total_documento === "number" && Number.isFinite(doc.valor_total_documento)
      ? roundCurrency(doc.valor_total_documento)
      : null;

  if (valorTotalDocumento === null) {
    return {
      somaItens,
      descontoDocumento,
      acrescimoDocumento,
      totalCalculado,
      valorTotalDocumento: null,
      diferenca: null,
      status: "missing_total",
    };
  }

  const diferenca = roundCurrency(totalCalculado - valorTotalDocumento);
  const isMatch = Math.abs(diferenca) <= 0.01;

  return {
    somaItens,
    descontoDocumento,
    acrescimoDocumento,
    totalCalculado,
    valorTotalDocumento,
    diferenca,
    status: isMatch ? "match" : "divergence",
  };
}

export function formatBRL(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function buildCleanExportJson(doc: ExtractedDocument) {
  return {
    tipo_documento: doc.tipo_documento,
    fornecedor: doc.fornecedor,
    cnpj_cpf: doc.cnpj_cpf,
    numero_documento: doc.numero_documento,
    data_emissao: doc.data_emissao,
    data_vencimento: doc.data_vencimento,
    subtotal: doc.subtotal,
    desconto_documento: doc.desconto_documento,
    acrescimo_documento: doc.acrescimo_documento,
    valor_total_documento: doc.valor_total_documento,
    itens: doc.itens.map(({ id: _id, ...rest }) => rest),
    alertas_leitura: doc.alertas_leitura,
  };
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "number" ? value.toFixed(2).replace(".", ",") : String(value);
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildItemsCsv(doc: ExtractedDocument): string {
  const headers = [
    "Tipo Documento",
    "Fornecedor",
    "CNPJ/CPF",
    "Número Documento",
    "Data Emissão",
    "Descrição do Item",
    "Quantidade",
    "Unidade",
    "Valor Unitário (R$)",
    "Desconto Item (R$)",
    "Valor Total Item (R$)",
    "Categoria",
    "Subcategoria",
  ];

  const rows = doc.itens.map((item) => [
    csvCell(doc.tipo_documento),
    csvCell(doc.fornecedor),
    csvCell(doc.cnpj_cpf),
    csvCell(doc.numero_documento),
    csvCell(doc.data_emissao),
    csvCell(item.descricao),
    csvCell(item.quantidade),
    csvCell(item.unidade),
    csvCell(item.valor_unitario),
    csvCell(item.desconto_item),
    csvCell(item.valor_total_item),
    csvCell(item.categoria_sugerida),
    csvCell(item.subcategoria_sugerida),
  ]);

  const divergence = calculateDivergence(doc);
  const summaryLines = [
    "",
    `Resumo da Conferência;;;;;;;;;;;;`,
    `Soma dos Itens (R$);${csvCell(divergence.somaItens)}`,
    `Desconto do Documento (R$);${csvCell(divergence.descontoDocumento)}`,
    `Acréscimo do Documento (R$);${csvCell(divergence.acrescimoDocumento)}`,
    `Total Calculado (R$);${csvCell(divergence.totalCalculado)}`,
    `Valor Total Lido no Documento (R$);${csvCell(divergence.valorTotalDocumento)}`,
    `Diferença (R$);${csvCell(divergence.diferenca)}`,
  ];

  const csvBody = [
    headers.join(";"),
    ...rows.map((r) => r.join(";")),
    ...summaryLines,
  ].join("\r\n");

  // UTF-8 BOM for direct opening in Brazilian Excel
  return `\uFEFF${csvBody}`;
}
