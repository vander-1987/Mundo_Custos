// server.ts
import "dotenv/config";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI, Type } from "@google/genai";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = Number(process.env.PORT) || 3e3;
var GEMINI_MODEL = "gemini-4-hydrogen";
var ALLOWED_MIME_TYPES = /* @__PURE__ */ new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);
var MANDATORY_CATEGORIES = [
  "Insumos/CMV",
  "Embalagens",
  "Estrutura",
  "Pessoal",
  "Operacional",
  "Comercial",
  "Financeiro",
  "Tributos",
  "Outros"
];
var CATEGORY_SET = new Set(MANDATORY_CATEGORIES);
var SYSTEM_INSTRUCTION = `Voc\xEA \xE9 um auditor financeiro especialista em controle de custos, CMV e estoque para a\xE7aiterias no Brasil.
Sua tarefa \xE9 ler documentos financeiros reais (NF-e, NFC-e, Cupom Fiscal, Recibo, Boleto ou Fatura de fornecedores) e extrair os dados rigorosamente no formato JSON especificado.

REGRAS ESTRITAS ANTI-ALUCINA\xC7\xC3O (CUMPRIMENTO OBRIGAT\xD3RIO):
1. Qualquer campo ausente, cortado, ileg\xEDvel, borrado ou n\xE3o identificado com clareza DEVE retornar explicitamente null.
2. NUNCA invente informa\xE7\xF5es, NUNCA preencha campos por suposi\xE7\xE3o e NUNCA deduza pre\xE7os, quantidades, CNPJ/CPF, datas ou totais que n\xE3o estejam claramente vis\xEDveis no documento.
3. N\xC3O corrija nem altere valores impressos no documento para tentar fazer a soma fechar \u2014 extraia fielmente o que est\xE1 escrito em cada item e no valor total do documento, mesmo que haja diverg\xEAncia matem\xE1tica.
4. Sempre que houver qualquer trecho ileg\xEDvel, borrado, cortado, rasurado, manchado, com baixa confian\xE7a de leitura ou valor amb\xEDguo, registre uma explica\xE7\xE3o clara e objetiva em portugu\xEAs no array "alertas_leitura". Se o documento estiver totalmente n\xEDtido e leg\xEDvel, retorne "alertas_leitura" vazio ([]).
5. Caso haja inconsist\xEAncia visual ou n\xFAmero duvidoso em algum item (ex.: pre\xE7o unit\xE1rio borrado), mantenha o campo duvidoso como null (se ileg\xEDvel) e explique em "alertas_leitura".

REGRAS DE CLASSIFICA\xC7\xC3O PARA A\xC7AITERIAS:
- Para cada item extra\xEDdo, classifique "categoria_sugerida" utilizando EXCLUSIVAMENTE uma destas 9 op\xE7\xF5es exatas:
  "Insumos/CMV", "Embalagens", "Estrutura", "Pessoal", "Operacional", "Comercial", "Financeiro", "Tributos", "Outros".
- Defina "subcategoria_sugerida" coerente com o contexto de a\xE7aiteria, por exemplo:
  - Insumos/CMV: "Polpas e Cremes", "Complementos e Toppings", "Frutas Frescas", "Caldas e Coberturas", "Latic\xEDnios e Bases"
  - Embalagens: "Potes e Tampas", "Colheres e Descart\xE1veis", "Sacolas e Delivery", "R\xF3tulos e Etiquetas"
  - Estrutura: "Energia e \xC1gua", "Aluguel e Condom\xEDnio", "Manuten\xE7\xE3o de Freezers", "Internet e Telefonia"
  - Pessoal: "Sal\xE1rios e Encargos", "Uniformes e EPI", "Benef\xEDcios"
  - Operacional: "Limpeza e Higiene", "Gelo e Refrigera\xE7\xE3o", "Frete e Log\xEDstica", "Utens\xEDlios de Loja"
  - Comercial: "Marketing e An\xFAncios", "Taxas de Plataformas", "Material Promocional"
  - Financeiro: "Tarifas Banc\xE1rias", "Juros e Multas", "Taxas de Cart\xE3o"
  - Tributos: "Impostos e Guias", "Taxas Municipais"
  - Outros: "Despesas Gerais"

FORMATA\xC7\xC3O DOS DADOS:
- Valores num\xE9ricos devem ser n\xFAmeros decimais puros em reais (ex.: 149.90), nunca strings com "R$".
- Datas devem ser retornadas no formato DD/MM/AAAA quando leg\xEDveis, ou null se ausentes/ileg\xEDveis.
- Unidades devem ser padronizadas quando identificadas no documento (ex.: kg, g, L, ml, un, cx, pct, fd, balde). Se ausente, retorne null.
- Em documentos sem itens discriminados (como um boleto ou conta de energia), retorne um item \xFAnico descrevendo o servi\xE7o/cobran\xE7a se constar no documento, ou array vazio [] se n\xE3o houver itens discriminados.`;
var EXTRACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    tipo_documento: {
      type: Type.STRING,
      nullable: true,
      description: "Tipo do documento identificado (ex.: NF-e, NFC-e, Cupom Fiscal, Recibo, Boleto, Fatura) ou null se n\xE3o identificado."
    },
    fornecedor: {
      type: Type.STRING,
      nullable: true,
      description: "Raz\xE3o social ou nome fantasia do fornecedor, ou null se ausente/ileg\xEDvel."
    },
    cnpj_cpf: {
      type: Type.STRING,
      nullable: true,
      description: "CNPJ ou CPF do fornecedor conforme impresso, ou null se ausente/ileg\xEDvel."
    },
    numero_documento: {
      type: Type.STRING,
      nullable: true,
      description: "N\xFAmero da nota, cupom, recibo ou fatura, ou null se ausente/cortado."
    },
    data_emissao: {
      type: Type.STRING,
      nullable: true,
      description: "Data de emiss\xE3o no formato DD/MM/AAAA, ou null se ausente/ileg\xEDvel."
    },
    data_vencimento: {
      type: Type.STRING,
      nullable: true,
      description: "Data de vencimento no formato DD/MM/AAAA (se houver), ou null."
    },
    subtotal: {
      type: Type.NUMBER,
      nullable: true,
      description: "Subtotal impresso no documento antes de descontos/acr\xE9scimos, ou null."
    },
    desconto_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Desconto total aplicado no rodap\xE9 do documento (valor positivo), ou null."
    },
    acrescimo_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Acr\xE9scimo, frete ou taxa adicional no rodap\xE9 do documento (valor positivo), ou null."
    },
    valor_total_documento: {
      type: Type.NUMBER,
      nullable: true,
      description: "Valor total final impresso no documento, ou null se ausente/ileg\xEDvel."
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
            description: "Descri\xE7\xE3o fiel do produto ou servi\xE7o."
          },
          quantidade: {
            type: Type.NUMBER,
            nullable: true,
            description: "Quantidade num\xE9rica do item, ou null se ileg\xEDvel/ausente."
          },
          unidade: {
            type: Type.STRING,
            nullable: true,
            description: "Unidade de medida (kg, g, L, ml, un, cx, pct, etc.), ou null."
          },
          valor_unitario: {
            type: Type.NUMBER,
            nullable: true,
            description: "Valor unit\xE1rio em reais, ou null se ileg\xEDvel/ausente."
          },
          desconto_item: {
            type: Type.NUMBER,
            nullable: true,
            description: "Desconto espec\xEDfico do item (valor positivo), ou null se n\xE3o houver."
          },
          valor_total_item: {
            type: Type.NUMBER,
            nullable: true,
            description: "Valor total impresso para este item, ou null se ileg\xEDvel/ausente."
          },
          categoria_sugerida: {
            type: Type.STRING,
            enum: [...MANDATORY_CATEGORIES],
            nullable: true,
            description: "Categoria sugerida estritamente dentro das 9 categorias permitidas."
          },
          subcategoria_sugerida: {
            type: Type.STRING,
            nullable: true,
            description: "Subcategoria coerente com o contexto de a\xE7aiteria."
          }
        },
        required: [
          "descricao",
          "quantidade",
          "unidade",
          "valor_unitario",
          "desconto_item",
          "valor_total_item",
          "categoria_sugerida",
          "subcategoria_sugerida"
        ]
      }
    },
    alertas_leitura: {
      type: Type.ARRAY,
      description: "Lista de alertas apontando trechos ileg\xEDveis, borrados, cortados, baixa confian\xE7a ou valores amb\xEDguos.",
      items: {
        type: Type.STRING
      }
    }
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
    "alertas_leitura"
  ]
};
function toNullableString(val) {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  return trimmed;
}
function toNullableNumber(val) {
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
function sanitizeExtraction(raw) {
  const rawItems = Array.isArray(raw.itens) ? raw.itens : [];
  const rawAlerts = Array.isArray(raw.alertas_leitura) ? raw.alertas_leitura : [];
  const itens = rawItems.map((entry) => {
    const item = entry && typeof entry === "object" ? entry : {};
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
      subcategoria_sugerida: toNullableString(item.subcategoria_sugerida)
    };
  });
  const alertas_leitura = rawAlerts.filter((a) => typeof a === "string" && a.trim().length > 0).map((a) => a.trim());
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
    alertas_leitura
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
        "User-Agent": "aistudio-build"
      }
    }
  });
}
var FALLBACK_GEMINI_MODEL = "gemini-3.1-flash-lite";
async function callGeminiModel(ai, model, mimeType, base64Data) {
  return ai.models.generateContent({
    model,
    contents: {
      parts: [
        {
          inlineData: {
            mimeType,
            data: base64Data
          }
        },
        {
          text: "Analise este documento financeiro de a\xE7aiteria e extraia todos os campos estruturados conforme o schema JSON. Lembre-se: retorne null para qualquer dado ausente, cortado ou ileg\xEDvel, nunca invente valores e registre qualquer incerteza visual em alertas_leitura."
        }
      ]
    },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: EXTRACTION_RESPONSE_SCHEMA
    }
  });
}
async function generateWithRetry(ai, mimeType, base64Data) {
  let lastError;
  const attempts = [
    { model: GEMINI_MODEL, delayMs: 600 },
    { model: FALLBACK_GEMINI_MODEL, delayMs: 800 },
    { model: FALLBACK_GEMINI_MODEL, delayMs: 0 }
  ];
  for (let i = 0; i < attempts.length; i++) {
    const { model, delayMs } = attempts[i];
    try {
      const response = await callGeminiModel(ai, model, mimeType, base64Data);
      return { response, usedModel: model };
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient = msg.includes("503") || msg.includes("UNAVAILABLE") || msg.includes("ECONNRESET");
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
      fallbackModel: FALLBACK_GEMINI_MODEL
    });
  });
  app.post("/api/analyze-document", async (req, res) => {
    try {
      const { fileBase64, mimeType, fileName } = req.body ?? {};
      if (typeof mimeType !== "string" || !ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          error: "Formato de arquivo n\xE3o suportado. Envie uma imagem JPG, PNG, WEBP ou documento PDF."
        });
        return;
      }
      if (typeof fileBase64 !== "string" || fileBase64.trim().length < 20) {
        res.status(400).json({
          error: "Arquivo inv\xE1lido ou vazio. Selecione um documento v\xE1lido para an\xE1lise."
        });
        return;
      }
      const cleanBase64 = fileBase64.includes(",") ? fileBase64.split(",")[1].trim() : fileBase64.trim();
      const approxBytes = Math.floor(cleanBase64.length * 3 / 4);
      const MAX_BYTES = 20 * 1024 * 1024;
      if (approxBytes > MAX_BYTES) {
        res.status(413).json({
          error: "O arquivo excede o limite de 20 MB. Envie um arquivo menor ou otimizado."
        });
        return;
      }
      const ai = createGeminiClient();
      const { response, usedModel } = await generateWithRetry(ai, mimeType, cleanBase64);
      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        res.status(502).json({
          error: "O modelo retornou uma resposta vazia ao analisar o documento. Tente novamente."
        });
        return;
      }
      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch {
        res.status(502).json({
          error: "N\xE3o foi poss\xEDvel interpretar o JSON retornado pelo modelo. Tente enviar o documento novamente."
        });
        return;
      }
      const data = sanitizeExtraction(parsed);
      res.json({
        model: usedModel,
        fileName: typeof fileName === "string" ? fileName : null,
        extractedAt: (/* @__PURE__ */ new Date()).toISOString(),
        data
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === "MISSING_API_KEY") {
        res.status(500).json({
          error: "Chave da API do Gemini n\xE3o configurada no servidor. Verifique a configura\xE7\xE3o em Settings > Secrets."
        });
        return;
      }
      if (message.includes("API_KEY_INVALID") || message.includes("PERMISSION_DENIED") || message.includes("403")) {
        res.status(403).json({
          error: "Permiss\xE3o negada ou chave da API inv\xE1lida ao acessar o Gemini. Verifique a chave em Settings > Secrets."
        });
        return;
      }
      if (message.includes("RESOURCE_EXHAUSTED") || message.includes("429")) {
        res.status(429).json({
          error: "Limite de requisi\xE7\xF5es da API do Gemini atingido temporariamente. Aguarde alguns instantes e tente novamente."
        });
        return;
      }
      if (message.includes("NOT_FOUND") || message.includes("404")) {
        res.status(404).json({
          error: `Modelo ${GEMINI_MODEL} n\xE3o encontrado ou indispon\xEDvel para esta chave.`
        });
        return;
      }
      if (message.includes("UNAVAILABLE") || message.includes("503")) {
        res.status(503).json({
          error: "O modelo Gemini est\xE1 com alta demanda tempor\xE1ria (503). Aguarde alguns segundos e clique em Tentar Novamente."
        });
        return;
      }
      console.error("[/api/analyze-document] Erro:", message);
      res.status(500).json({
        error: "Erro interno ao analisar o documento com o Gemini. Tente novamente.",
        details: process.env.NODE_ENV === "development" ? message : void 0
      });
    }
  });
  app.use("/api", (_req, res) => {
    res.status(404).json({
      error: "Rota da API n\xE3o encontrada."
    });
  });
  const distDir = path.resolve(__dirname, "dist");
  const isRunningCompiledJs = path.extname(__filename) === ".js";
  const isProduction = process.env.NODE_ENV === "production" || isRunningCompiledJs && process.env.NODE_ENV !== "development";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const indexHtmlPath = path.join(distDir, "index.html");
    if (fs.existsSync(distDir) && fs.existsSync(indexHtmlPath)) {
      app.use(
        express.static(distDir, {
          index: false,
          maxAge: "1d"
        })
      );
      app.get("*", (_req, res) => {
        res.sendFile(indexHtmlPath);
      });
    } else {
      console.warn(
        `[Mundo+ Custos] Diret\xF3rio de build n\xE3o encontrado em ${distDir}. Execute "npm run build" antes de iniciar em produ\xE7\xE3o.`
      );
      app.get("*", (_req, res) => {
        res.status(503).send("Build do frontend n\xE3o encontrado. Execute npm run build.");
      });
    }
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Mundo+ Custos rodando em http://0.0.0.0:${PORT} (${isProduction ? "produ\xE7\xE3o" : "desenvolvimento"} | modelo: ${GEMINI_MODEL})`
    );
  });
}
startServer();
