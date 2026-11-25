import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const GEMINI_MODEL = "gemini-4-hydrogen";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const MANDATORY_CATEGORIES = [
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

const CATEGORY_SET = new Set<string>(MANDATORY_CATEGORIES);

const SYSTEM_INSTRUCTION = `Você é um auditor financeiro especialista em controle de custos, CMV e estoque para açaiterias no Brasil.
Sua tarefa é ler documentos financeiros reais (NF-e, NFC-e, Cupom Fiscal, Recibo, Boleto ou Fatura de fornecedores) e extrair os dados rigorosamente no formato JSON especificado.

REGRAS ESTRITAS ANTI-ALUCINAÇÃO (CUMPRIMENTO OBRIGATÓRIO):
1. Qualquer campo ausente, cortado, ilegível, borrado ou não identificado com clareza DEVE retornar explicitamente null.
2. NUNCA invente informações, NUNCA preencha campos por suposição e NUNCA deduza preços, quantidades, CNPJ/CPF, datas ou totais que não estejam claramente visíveis no documento.
3. NÃO corrija nem altere valores impressos no documento para tentar fazer a soma fechar — extraia fielmente o que está escrito em cada item e no valor total do documento, mesmo que haja divergência matemática.
4. Sempre que houver qualquer trecho ilegível, borrado, cortado, rasurado, manchado, com baixa confiança de leitura ou valor ambíguo, registre uma explicação clara e objetiva em português no array "alertas_leitura". Se o documento estiver totalmente nítido e legível, retorne "alertas_leitura" vazio ([]).
5. Caso haja inconsistência visual ou número duvidoso em algum item (ex.: preço unitário borrado), mantenha o campo duvidoso como null (se ilegível) e explique em "alertas_leitura".

REGRAS DE CLASSIFICAÇÃO PARA AÇAITERIAS:
- Para cada item extraído, classifique "categoria_sugerida" utilizando EXCLUSIVAMENTE uma destas 9 opções exatas:
  "Insumos/CMV", "Embalagens", "Estrutura", "Pessoal", "Operacional", "Comercial", "Financeiro", "Tributos", "Outros".
- Defina "subcategoria_sugerida" coerente com o contexto de açaiteria, por exemplo:
  - Insumos/CMV: "Polpas e Cremes", "Complementos e Toppings", "Frutas Frescas", "Caldas e Coberturas", "Laticínios e Bases"
  - Embalagens: "Potes e Tampas", "Colheres e Descartáveis", "Sacolas e Delivery", "Rótulos e Etiquetas"
  - Estrutura: "Energia e Água", "Aluguel e Condomínio", "Manutenção de Freezers", "Internet e Telefonia"
  - Pessoal: "Salários e Encargos", "Uniformes e EPI", "Benefícios"
  - Operacional: "Limpeza e Higiene", "Gelo e Refrigeração", "Frete e Logística", "Utensílios de Loja"
  - Comercial: "Marketing e Anúncios", "Taxas de Plataformas", "Material Promocional"
  - Financeiro: "Tarifas Bancárias", "Juros e Multas", "Taxas de Cartão"
  - Tributos: "Impostos e Guias", "Taxas Municipais"
  - Outros: "Despesas Gerais"

FORMATAÇÃO DOS DADOS:
- Valores numéricos devem ser números decimais puros em reais (ex.: 149.90), nunca strings com "R$".
- Datas devem ser retornadas no formato DD/MM/AAAA quando legíveis, ou null se ausentes/ilegíveis.
- Unidades devem ser padronizadas quando identificadas no documento (ex.: kg, g, L, ml, un, cx, pct, fd, balde). Se ausente, retorne null.
- Em documentos sem itens discriminados (como um boleto ou conta de energia), retorne um item único descrevendo o serviço/cobrança se constar no documento, ou array vazio [] se não houver itens discriminados.`;

const EXTRACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tipo_documento: {
      type: Type.STRING,
      nullable: true,
      description:
        "Tipo do documento identificado (ex.: NF-e, NFC-e, Cupom Fiscal, Recibo, Boleto, Fatura) ou null se não identificado.",
    },
    fornecedor: {
      type: Type.STRING,
      nullable: true,
      description: "Razão social ou nome fantasia do fornecedor, ou null se ausente/ilegível.",
    },
    cnpj_cpf: {
      type: Type.STRING,
      nullable: true,
      description: "CNPJ ou CPF do fornecedor conforme impresso, ou null se ausente/ilegível.",
    },
    numero_documento: {
      type: Type.STRING,
      nullable: true,
      description: "Número da nota, cupom, recibo ou fatura, ou null se ausente/cortado.",
    },
    data_emissao: {
      type: Type.STRING,
      nullable: true,
      description: "Data de emissão no formato DD/MM/AAAA, ou null se ausente/ilegível.",
    },
    data_vencimento: {
      type: Type.STRING,
      nullable: true,
      description: "Data de vencimento no formato DD/MM/AAAA (se houver), ou null.",
    },
    subtotal: {
      type: Type.NUMBER,
      nullable: true,
      description: "Subtotal impresso no documento antes de descontos/acréscimos, ou null.",
    },
    desconto_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Desconto total aplicado no rodapé do documento (valor positivo), ou null.",
    },
    acrescimo_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Acréscimo, frete ou taxa adicional no rodapé do documento (valor positivo), ou null.",
    },
    valor_total_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Valor total final impresso no documento, ou null se ausente/ilegível.",
    },
    itens: {
      type: Type.ARRAY,
      description: "Lista de todos os itens discriminados no documento.",
      items: {
        type: Type.OBJECT,
        properties: {
          descricao: {
            type: Type.STRING,
            nullable: true,
            description: "Descrição fiel do produto ou serviço.",
          },
          quantidade: {
            type: Type.NUMBER,
            nullable: true,
            description: "Quantidade numérica do item, ou null se ilegível/ausente.",
          },
          unidade: {
            type: Type.STRING,
            nullable: true,
            description: "Unidade de medida (kg, g, L, ml, un, cx, pct, etc.), ou null.",
          },
          valor_unitario: {
            type: Type.NUMBER,
            nullable: true,
            description: "Valor unitário em reais, ou null se ilegível/ausente.",
          },
          desconto_item: {
            type: Type.NUMBER,
            nullable: true,
            description: "Desconto específico do item (valor positivo), ou null se não houver.",
          },
          valor_total_item: {
            type: Type.NUMBER,
            nullable: true,
            description: "Valor total impresso para este item, ou null se ilegível/ausente.",
          },
          categoria_sugerida: {
            type: Type.STRING,
            enum: [...MANDATORY_CATEGORIES],
            nullable: true,
            description: "Categoria sugerida estritamente dentro das 9 categorias permitidas.",
          },
          subcategoria_sugerida: {
            type: Type.STRING,
            nullable: true,
            description: "Subcategoria coerente com o contexto de açaiteria.",
          },
        },
        required: [
          "descricao",
          "quantidade",
          "unidade",
          "valor_unitario",
          "desconto_item",
          "valor_total_item",
          "categoria_sugerida",
          "subcategoria_sugerida",
        ],
      },
    },
    alertas_leitura: {
      type: Type.ARRAY,
      description:
        "Lista de alertas apontando trechos ilegíveis, borrados, cortados, baixa confiança ou valores ambíguos.",
      items: {
        type: Type.STRING,
      },
    },
  },
  required: [
    "tipo_documento",
    "fornecedor",
    "cnpj_cpf",
    "numero_documento",
    "data_emissao",
    "data_vencimento",
    "subtotal",
    "desconto_documento",
    "acrescimo_documento",
    "valor_total_documento",
    "itens",
    "alertas_leitura",
  ],
};

function toNullableString(val: unknown): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}

function toNullableNumber(val: unknown): number | null {
  if (typeof val === "number" && Number.isFinite(val)) {
    return val;
  }
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/[R$\s]/g, "").replace(",", ".");
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sanitizeExtraction(raw: Record<string, unknown>) {
  const rawItems = Array.isArray(raw.itens) ? raw.itens : [];
  const rawAlerts = Array.isArray(raw.alertas_leitura) ? raw.alertas_leitura : [];

  const itens = rawItems.map((entry) => {
    const item = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const cat = toNullableString(item.categoria_sugerida);
    const validCategory = cat && CATEGORY_SET.has(cat) ? cat : cat ? "Outros" : null;
    return {
      descricao: toNullableString(item.descricao),
      quantidade: toNullableNumber(item.quantidade),
      unidade: toNullableString(item.unidade),
      valor_unitario: toNullableNumber(item.valor_unitario),
      desconto_item: toNullableNumber(item.desconto_item),
      valor_total_item: toNullableNumber(item.valor_total_item),
      categoria_sugerida: validCategory,
      subcategoria_sugerida: toNullableString(item.subcategoria_sugerida),
    };
  });

  const alertas_leitura = rawAlerts
    .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    .map((a) => a.trim());

  return {
    tipo_documento: toNullableString(raw.tipo_documento),
    fornecedor: toNullableString(raw.fornecedor),
    cnpj_cpf: toNullableString(raw.cnpj_cpf),
    numero_documento: toNullableString(raw.numero_documento),
    data_emissao: toNullableString(raw.data_emissao),
    data_vencimento: toNullableString(raw.data_vencimento),
    subtotal: toNullableNumber(raw.subtotal),
    desconto_documento: toNullableNumber(raw.desconto_documento),
    acrescimo_documento: toNullableNumber(raw.acrescimo_documento),
    valor_total_documento: toNullableNumber(raw.valor_total_documento),
    itens,
    alertas_leitura,
  };
}

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    throw new Error("MISSING_API_KEY");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const FALLBACK_GEMINI_MODEL = "gemini-3.1-flash-lite";

async function callGeminiModel(
  ai: GoogleGenAI,
  model: string,
  mimeType: string,
  base64Data: string
) {
  return ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        {
          text: "Analise este documento financeiro de açaiteria e extraia todos os campos estruturados conforme o schema JSON. Lembre-se: retorne null para qualquer dado ausente, cortado ou ilegível, nunca invente valores e registre qualquer incerteza visual em alertas_leitura.",
        },
      ],
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_RESPONSE_SCHEMA,
    },
  });
}

async function generateWithRetry(
  ai: GoogleGenAI,
  mimeType: string,
  base64Data: string
) {
  let lastError: unknown;
  const attempts: Array<{ model: string; delayMs: number }> = [
    { model: GEMINI_MODEL, delayMs: 600 },
    { model: FALLBACK_GEMINI_MODEL, delayMs: 800 },
    { model: FALLBACK_GEMINI_MODEL, delayMs: 0 },
  ];

  for (let i = 0; i < attempts.length; i++) {
    const { model, delayMs } = attempts[i];
    try {
      const response = await callGeminiModel(ai, model, mimeType, base64Data);
      return { response, usedModel: model };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("ECONNRESET");
      if (isTransient && i < attempts.length - 1) {
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "30mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      model: GEMINI_MODEL,
      fallbackModel: FALLBACK_GEMINI_MODEL,
    });
  });

  app.post("/api/analyze-document", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName } = (req.body ?? {}) as {
        fileBase64?: unknown;
        mimeType?: unknown;
        fileName?: unknown;
      };

      if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          error:
            "Formato de arquivo não suportado. Envie uma imagem JPG, PNG, WEBP ou documento PDF.",
        });
        return;
      }

      if (typeof fileBase64 !== "string" || fileBase64.trim().length < 20) {
        res.status(400).json({
          error: "Arquivo inválido ou vazio. Selecione um documento válido para análise.",
        });
        return;
      }

      // Strip data URL prefix if present
      const cleanBase64 = fileBase64.includes(",")
        ? fileBase64.split(",")[1].trim()
        : fileBase64.trim();

      const approxBytes = Math.floor((cleanBase64.length * 3) / 4);
      const MAX_BYTES = 20 * 1024 * 1024; // 20MB
      if (approxBytes > MAX_BYTES) {
        res.status(413).json({
          error: "O arquivo excede o limite de 20 MB. Envie um arquivo menor ou otimizado.",
        });
        return;
      }

      const ai = createGeminiClient();
      const { response, usedModel } = await generateWithRetry(ai, mimeType, cleanBase64);
      const rawText = (response.text ?? "").trim();

      if (!rawText) {
        res.status(502).json({
          error: "O modelo retornou uma resposta vazia ao analisar o documento. Tente novamente.",
        });
        return;
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(rawText) as Record<string, unknown>;
      } catch {
        res.status(502).json({
          error: "Não foi possível interpretar o JSON retornado pelo modelo. Tente enviar o documento novamente.",
        });
        return;
      }

      const data = sanitizeExtraction(parsed);

      res.json({
        model: usedModel,
        fileName: typeof fileName === "string" ? fileName : null,
        extractedAt: new Date().toISOString(),
        data,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      if (message === "MISSING_API_KEY") {
        res.status(500).json({
          error:
            "Chave da API do Gemini não configurada no servidor. Verifique a configuração em Settings > Secrets.",
        });
        return;
      }

      if (message.includes("API_KEY_INVALID") || message.includes("PERMISSION_DENIED") || message.includes("403")) {
        res.status(403).json({
          error:
            "Permissão negada ou chave da API inválida ao acessar o Gemini. Verifique a chave em Settings > Secrets.",
        });
        return;
      }

      if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
        res.status(429).json({
          error:
            "Limite de requisições da API do Gemini atingido temporariamente. Aguarde alguns instantes e tente novamente.",
        });
        return;
      }

      if (message.includes("NOT_FOUND") || message.includes("404")) {
        res.status(404).json({
          error: `Modelo ${GEMINI_MODEL} não encontrado ou indisponível para esta chave.`,
        });
        return;
      }

      if (message.includes("UNAVAILABLE") || message.includes("503")) {
        res.status(503).json({
          error:
            "O modelo Gemini está com alta demanda temporária (503). Aguarde alguns segundos e clique em Tentar Novamente.",
        });
        return;
      }

      console.error("[/api/analyze-document] Erro:", message);
      res.status(500).json({
        error: "Erro interno ao analisar o documento com o Gemini. Tente novamente.",
        details: process.env.NODE_ENV === "development" ? message : undefined,
      });
    }
  });

  // Return JSON 404 for unknown API endpoints instead of SPA index.html
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "Rota da API não encontrada.",
    });
  });

  const distDir = path.resolve(__dirname, "dist");
  const isRunningCompiledJs = path.extname(__filename) === ".js";
  const isProduction =
    isRunningCompiledJs || process.env.NODE_ENV === "production";

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const indexHtmlPath = path.join(distDir, "index.html");
    if (fs.existsSync(distDir) && fs.existsSync(indexHtmlPath)) {
      app.use(
        express.static(distDir, {
          index: false,
          maxAge: "1d",
        })
      );
      app.get("*", (_req, res) => {
        res.sendFile(indexHtmlPath);
      });
    } else {
      console.warn(
        `[Mundo+ Custos] Diretório de build não encontrado em ${distDir}. Execute "npm run build" antes de iniciar em produção.`
      );
      app.get("*", (_req, res) => {
        res
          .status(503)
          .send("Build do frontend não encontrado. Execute npm run build.");
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Mundo+ Custos rodando em http://0.0.0.0:${PORT} (${isProduction ? "produção" : "desenvolvimento"} | modelo: ${GEMINI_MODEL})`
    );
  });
}

startServer();
