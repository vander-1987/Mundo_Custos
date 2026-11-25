import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  Download,
  FileCheck2,
  FileWarning,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  MANDATORY_CATEGORIES,
  SUBCATEGORY_SUGGESTIONS,
  buildCleanExportJson,
  buildItemsCsv,
  calculateDivergence,
  formatBRL,
  roundCurrency,
  type DocumentItem,
  type ExtractedDocument,
  type MandatoryCategory,
  type SessionStoreContext,
  type UploadedFileState,
} from "../types/document";
import {
  generateCleanNfeSample,
  generateDivergentCupomSample,
} from "../utils/sampleDocuments";
import { DocumentViewer } from "./DocumentViewer";

interface DocumentLabProps {
  storeContext: SessionStoreContext;
  uploadedFile: UploadedFileState | null;
  onFileChange: (file: UploadedFileState | null) => void;
  extractedDoc: ExtractedDocument | null;
  onDocChange: (doc: ExtractedDocument | null) => void;
  onResetAll: () => void;
}

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function makeItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseInputNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

export function DocumentLab({
  storeContext,
  uploadedFile,
  onFileChange,
  extractedDoc,
  onDocChange,
  onResetAll,
}: DocumentLabProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(() =>
    extractedDoc ? "success" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"document" | "data">("data");
  const [showJsonPanel, setShowJsonPanel] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);
  const [usedModel, setUsedModel] = useState<string | null>(null);

  const divergence = useMemo(
    () => (extractedDoc ? calculateDivergence(extractedDoc) : null),
    [extractedDoc]
  );

  const liveJsonString = useMemo(() => {
    if (!extractedDoc) return "";
    return JSON.stringify(buildCleanExportJson(extractedDoc), null, 2);
  }, [extractedDoc]);

  const categoryTotals = useMemo(() => {
    if (!extractedDoc) return [];
    const map = new Map<string, number>();
    for (const item of extractedDoc.itens) {
      const cat = item.categoria_sugerida ?? "Sem categoria";
      const val = typeof item.valor_total_item === "number" ? item.valor_total_item : 0;
      map.set(cat, roundCurrency((map.get(cat) ?? 0) + val));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [extractedDoc]);

  async function analyzeUploadedFile(fileState: UploadedFileState) {
    setStatus("loading");
    setErrorMessage(null);
    onDocChange(null);

    try {
      const response = await fetch("/api/analyze-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: fileState.base64,
          mimeType: fileState.mimeType,
          fileName: fileState.name,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        model?: string;
        data?: Omit<ExtractedDocument, "itens"> & {
          itens: Array<Omit<DocumentItem, "id">>;
        };
      } | null;

      if (!response.ok || !payload?.data) {
        throw new Error(
          payload?.error ||
            "Falha ao processar o documento no servidor. Verifique a conexão e tente novamente."
        );
      }

      const hydratedDoc: ExtractedDocument = {
        ...payload.data,
        itens: payload.data.itens.map((item) => ({
          ...item,
          id: makeItemId(),
        })),
      };

      setUsedModel(payload.model ?? "gemini-4-hydrogen");
      onDocChange(hydratedDoc);
      setStatus("success");
      setMobileTab("data");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro inesperado ao analisar o documento.";
      setErrorMessage(msg);
      setStatus("error");
    }
  }

  async function processFile(file: File) {
    setErrorMessage(null);

    const mimeType = file.type;
    if (!ACCEPTED_MIME_TYPES.has(mimeType)) {
      setErrorMessage(
        "Formato não suportado. Envie arquivos JPG, PNG, WEBP ou PDF."
      );
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage("O arquivo excede o limite de 20 MB.");
      return;
    }

    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    const base64 = await readFileAsBase64(file);

    const nextFile: UploadedFileState = {
      name: file.name,
      mimeType,
      size: file.size,
      previewUrl,
      base64,
      isSample: false,
    };

    onFileChange(nextFile);
    await analyzeUploadedFile(nextFile);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    // Reset input so re-selecting same file triggers onChange
    e.target.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  }

  async function handleRunSample(kind: "clean" | "divergent") {
    setErrorMessage(null);
    try {
      if (uploadedFile?.previewUrl) {
        URL.revokeObjectURL(uploadedFile.previewUrl);
      }

      const generated =
        kind === "clean"
          ? await generateCleanNfeSample()
          : await generateDivergentCupomSample();

      const nextFile: UploadedFileState = {
        name: generated.fileName,
        mimeType: generated.mimeType,
        size: generated.size,
        previewUrl: generated.previewUrl,
        base64: generated.base64,
        isSample: true,
      };

      onFileChange(nextFile);
      await analyzeUploadedFile(nextFile);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao gerar documento de exemplo."
      );
    }
  }

  function handleResetSession() {
    setStatus("idle");
    setErrorMessage(null);
    setShowJsonPanel(false);
    setCopiedJson(false);
    setUsedModel(null);
    onResetAll();
  }

  function updateHeaderField<K extends keyof ExtractedDocument>(
    field: K,
    value: ExtractedDocument[K]
  ) {
    if (!extractedDoc) return;
    onDocChange({
      ...extractedDoc,
      [field]: value,
    });
  }

  function updateItemField<K extends keyof DocumentItem>(
    itemId: string,
    field: K,
    value: DocumentItem[K]
  ) {
    if (!extractedDoc) return;

    const updatedItems = extractedDoc.itens.map((item) => {
      if (item.id !== itemId) return item;
      const next = { ...item, [field]: value };

      // Auto-recalculate valor_total_item when quantidade, valor_unitario, or desconto_item changes
      if (
        field === "quantidade" ||
        field === "valor_unitario" ||
        field === "desconto_item"
      ) {
        if (
          typeof next.quantidade === "number" &&
          typeof next.valor_unitario === "number"
        ) {
          const disc =
            typeof next.desconto_item === "number" ? Math.abs(next.desconto_item) : 0;
          next.valor_total_item = roundCurrency(
            Math.max(0, next.quantidade * next.valor_unitario - disc)
          );
        }
      }
      return next;
    });

    onDocChange({
      ...extractedDoc,
      itens: updatedItems,
    });
  }

  function handleAddItem() {
    if (!extractedDoc) return;
    const newItem: DocumentItem = {
      id: makeItemId(),
      descricao: "",
      quantidade: 1,
      unidade: "un",
      valor_unitario: 0,
      desconto_item: null,
      valor_total_item: 0,
      categoria_sugerida: "Insumos/CMV",
      subcategoria_sugerida: "Polpas e Cremes",
    };
    onDocChange({
      ...extractedDoc,
      itens: [...extractedDoc.itens, newItem],
    });
  }

  function handleRemoveItem(itemId: string) {
    if (!extractedDoc) return;
    onDocChange({
      ...extractedDoc,
      itens: extractedDoc.itens.filter((i) => i.id !== itemId),
    });
  }

  async function handleCopyJson() {
    if (!liveJsonString) return;
    try {
      await navigator.clipboard.writeText(liveJsonString);
      setCopiedJson(true);
      window.setTimeout(() => setCopiedJson(false), 2000);
    } catch {
      setErrorMessage("Não foi possível copiar automaticamente. Selecione o texto no painel JSON.");
    }
  }

  function handleDownloadCsv() {
    if (!extractedDoc) return;
    const csvContent = buildItemsCsv(extractedDoc);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (extractedDoc.fornecedor || "documento_acaiteria")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_|_$/g, "");
    a.href = url;
    a.download = `mundo_custos_${safeName || "extracao"}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const nullHeaderInputClass = (val: unknown) =>
    val === null || val === ""
      ? "border-amber-300 bg-amber-50/60 focus:border-[#7E00B2] focus:bg-white"
      : "border-slate-200 bg-white focus:border-[#7E00B2]";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#2E003D] text-white pb-14">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Lab Header Strip */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E7FF00]">
              MUNDO+ CUSTOS · SESSÃO EM MEMÓRIA
              {storeContext.nomeAcaiteria ? ` · ${storeContext.nomeAcaiteria.toUpperCase()}` : ""}
            </p>
            <h1 className="font-display-impact text-2xl sm:text-4xl font-bold text-white mt-1">
              LABORATÓRIO DE LEITURA DE DOCUMENTOS
            </h1>
            <p className="text-sm text-white/75 mt-1">
              Envie notas fiscais, cupons, recibos, boletos ou faturas de fornecedores para extração multimodal e auditoria de CMV.
            </p>
          </div>

          {uploadedFile && (
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => void analyzeUploadedFile(uploadedFile)}
                disabled={status === "loading"}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#3D0051] hover:bg-[#670089] disabled:opacity-50 border border-white/15 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${status === "loading" ? "animate-spin" : ""}`} />
                Reanalisar
              </button>
              <button
                type="button"
                onClick={handleResetSession}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E7FF00] hover:bg-[#d8ee00] text-[#2E003D] text-xs font-extrabold uppercase tracking-wide transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Limpar / Novo Documento
              </button>
            </div>
          )}
        </div>

        {/* =============================================================== */}
        {/* ZERO-STATE: UPLOAD ZONE + 2 REAL SAMPLE DOCUMENTS               */}
        {/* =============================================================== */}
        {!uploadedFile && (
          <div className="mt-8 max-w-4xl mx-auto space-y-6">
            {errorMessage && (
              <div
                role="alert"
                className="p-4 rounded-xl bg-red-950/70 border border-red-400/50 text-red-100 text-sm flex items-start gap-3"
              >
                <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Arquivo não aceito</p>
                  <p className="text-red-200 mt-0.5">{errorMessage}</p>
                </div>
              </div>
            )}

            {/* Drag & Drop Box */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`rounded-2xl border-2 border-dashed p-10 sm:p-14 text-center transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00] ${
                isDragging
                  ? "border-[#E7FF00] bg-[#670089]/60 scale-[1.01]"
                  : "border-white/25 bg-[#3D0051] hover:border-[#E7FF00]/70 hover:bg-[#3D0051]/90"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileInput}
                className="hidden"
              />

              <div className="w-14 h-14 mx-auto rounded-xl bg-[#E7FF00] text-[#2E003D] flex items-center justify-center mb-5 shadow-md">
                <Upload className="w-7 h-7" />
              </div>

              <h2 className="text-xl sm:text-2xl font-extrabold text-white">
                Arraste e solte seu documento aqui ou clique para selecionar
              </h2>

              <p className="mt-2.5 text-sm text-white/75 max-w-xl mx-auto">
                Aceita imagens <strong className="text-white">JPG, PNG, WEBP</strong> e arquivos{" "}
                <strong className="text-white">PDF</strong> (até 20 MB) de NF-e, NFC-e, cupom fiscal, recibo, boleto ou fatura.
              </p>

              <div className="mt-6">
                <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#E7FF00] text-[#2E003D] font-extrabold text-sm uppercase tracking-wide">
                  Selecionar Arquivo do Dispositivo
                </span>
              </div>

              <p className="mt-4 text-xs text-white/55">
                Privacidade da sessão: nada é gravado em banco de dados — tudo existe apenas na memória do navegador enquanto você testa.
              </p>
            </div>

            {/* 2 Clickable Real Sample Documents */}
            <div className="bg-[#3D0051] border border-white/12 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    Sem uma nota fiscal por perto? Teste em 1 clique com exemplos reais
                  </h3>
                  <p className="text-xs text-white/70 mt-0.5">
                    As imagens abaixo são enviadas de verdade para a API multimodal do Gemini — sem respostas simuladas.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => void handleRunSample("clean")}
                  className="text-left p-4 rounded-xl bg-[#2E003D] hover:bg-[#670089]/70 border border-white/15 hover:border-[#E7FF00]/60 transition-all duration-150 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileCheck2 className="w-5 h-5 text-[#E7FF00] shrink-0" />
                      <span className="font-bold text-sm text-white">
                        Exemplo 1: NF-e Amazônia Polpas
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#E7FF00] group-hover:translate-x-0.5 transition-transform shrink-0">
                      Testar →
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/75 leading-relaxed">
                    Nota fiscal nítida com 7 itens (polpa de açaí, creme de ninho, granola, potes 500ml, colheres e detergente), desconto comercial e soma que confere com o total.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => void handleRunSample("divergent")}
                  className="text-left p-4 rounded-xl bg-[#2E003D] hover:bg-[#670089]/70 border border-white/15 hover:border-[#E7FF00]/60 transition-all duration-150 cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <FileWarning className="w-5 h-5 text-amber-300 shrink-0" />
                      <span className="font-bold text-sm text-white">
                        Exemplo 2: Cupom Manchado + Divergência
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#E7FF00] group-hover:translate-x-0.5 transition-transform shrink-0">
                      Testar →
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-white/75 leading-relaxed">
                    Cupom térmico com CNPJ e preço unitário borrados, número oculto e total impresso divergente (R$ 15,50 a mais) para validar retorno de <code className="font-mono text-[#E7FF00]">null</code>, alertas e divergência.
                  </p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* ACTIVE WORKSPACE: SPLIT VIEW (DESKTOP) / TABS (MOBILE)          */}
        {/* =============================================================== */}
        {uploadedFile && (
          <div className="mt-6">
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden mb-4 grid grid-cols-2 p-1 rounded-lg bg-[#3D0051] border border-white/15">
              <button
                type="button"
                onClick={() => setMobileTab("document")}
                className={`py-2.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  mobileTab === "document"
                    ? "bg-[#E7FF00] text-[#2E003D]"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Documento Original
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("data")}
                className={`py-2.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                  mobileTab === "data"
                    ? "bg-[#E7FF00] text-[#2E003D]"
                    : "text-white/80 hover:text-white"
                }`}
              >
                Dados Extraídos
                {extractedDoc ? ` (${extractedDoc.itens.length})` : ""}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* LEFT PANE: ORIGINAL DOCUMENT PREVIEW */}
              <div
                className={`lg:col-span-5 lg:sticky lg:top-20 ${
                  mobileTab === "document" ? "block" : "hidden lg:block"
                }`}
              >
                <DocumentViewer file={uploadedFile} />
              </div>

              {/* RIGHT PANE: EXTRACTION, ALERTS, DIVERGENCE, EDITABLE FORM & TABLE */}
              <div
                className={`lg:col-span-7 space-y-5 ${
                  mobileTab === "data" ? "block" : "hidden lg:block"
                }`}
              >
                {/* LOADING STATE */}
                {status === "loading" && (
                  <div className="bg-white text-[#2E003D] rounded-xl p-6 sm:p-8 border border-white/20 space-y-6">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-lg bg-[#2E003D] text-[#E7FF00] flex items-center justify-center shrink-0">
                        <Loader2 className="w-5 h-5 animate-spin" />
                      </div>
                      <div>
                        <h2 className="text-base sm:text-lg font-extrabold text-[#2E003D]">
                          Lendo documento com inteligência multimodal...
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-600">
                          Extraindo cabeçalho, itens, valores e aplicando regras anti-alucinação nas 9 categorias de açaiteria.
                        </p>
                      </div>
                    </div>

                    {/* Proportional Skeleton Matching Form + Table */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-pulse">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="space-y-1.5">
                          <div className="h-3 w-20 bg-slate-200 rounded" />
                          <div className="h-9 bg-slate-100 rounded-md border border-slate-200" />
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2.5 animate-pulse">
                      <div className="h-8 bg-slate-100 rounded-md" />
                      {Array.from({ length: 4 }).map((_, idx) => (
                        <div key={idx} className="h-11 bg-slate-50 border border-slate-100 rounded-md" />
                      ))}
                    </div>
                  </div>
                )}

                {/* ERROR STATE */}
                {status === "error" && (
                  <div
                    role="alert"
                    className="bg-white text-[#2E003D] rounded-xl p-6 border-2 border-red-500 space-y-4"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <h2 className="text-base font-extrabold text-red-700">
                          Falha na leitura automática do documento
                        </h2>
                        <p className="text-sm text-slate-700 mt-1">{errorMessage}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => void analyzeUploadedFile(uploadedFile)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#2E003D] hover:bg-[#3D0051] text-white text-xs font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Tentar Novamente
                      </button>
                      <button
                        type="button"
                        onClick={handleResetSession}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold cursor-pointer"
                      >
                        Escolher Outro Documento
                      </button>
                    </div>
                  </div>
                )}

                {/* EXTRACTED REVIEW WORKSPACE */}
                {status === "success" && extractedDoc && divergence && (
                  <>
                    {/* 1. ALERTAS DE LEITURA (ONLY WHEN PRESENT) */}
                    {extractedDoc.alertas_leitura.length > 0 && (
                      <section
                        aria-label="Alertas de leitura"
                        className="rounded-xl bg-[#FFFBEB] text-[#78350F] border border-amber-300 p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <h2 className="text-sm font-extrabold uppercase tracking-wide text-amber-900">
                              Alertas de Leitura e Trechos com Baixa Confiança ({extractedDoc.alertas_leitura.length})
                            </h2>
                            <p className="text-xs text-amber-800/90 mt-0.5">
                              Campos ilegíveis ou cortados foram mantidos como <code className="font-mono font-bold">null</code> para evitar valores inventados. Revise no documento ao lado:
                            </p>
                            <ul className="mt-2.5 space-y-1.5 text-xs sm:text-sm list-disc pl-5 text-amber-950">
                              {extractedDoc.alertas_leitura.map((alerta, idx) => (
                                <li key={idx}>{alerta}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* 2. DETECÇÃO AUTOMÁTICA DE DIVERGÊNCIAS */}
                    <section
                      aria-label="Conferência de valores"
                      className={`rounded-xl p-4 sm:p-5 border ${
                        divergence.status === "match"
                          ? "bg-emerald-50 border-emerald-300 text-emerald-950"
                          : divergence.status === "divergence"
                          ? "bg-red-50 border-red-300 text-red-950"
                          : "bg-amber-50 border-amber-300 text-amber-950"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {divergence.status === "match" ? (
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                          ) : divergence.status === "divergence" ? (
                            <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                          )}
                          <div>
                            <h2 className="text-base font-extrabold">
                              {divergence.status === "match"
                                ? "Valores Conferem"
                                : divergence.status === "divergence"
                                ? "Divergência Detectada"
                                : "Valor Total do Documento Não Identificado"}
                            </h2>
                            <p className="text-xs opacity-85">
                              {divergence.status === "match"
                                ? "A soma líquida dos itens bate exatamente com o valor total lido no documento."
                                : divergence.status === "divergence"
                                ? "A soma dos itens (com descontos/acréscimos) diverge do total impresso no documento."
                                : "Preencha o campo Valor Total do Documento abaixo para confrontar com a soma dos itens."}
                            </p>
                          </div>
                        </div>

                        {divergence.status === "divergence" && divergence.diferenca !== null && (
                          <div className="bg-red-600 text-white px-3.5 py-2 rounded-lg shrink-0 text-right">
                            <div className="text-[10px] uppercase tracking-wider font-semibold text-red-100">
                              Diferença Exata
                            </div>
                            <div className="font-mono tabular-nums text-base font-extrabold">
                              {divergence.diferenca > 0 ? "+" : ""}
                              {formatBRL(divergence.diferenca)}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Numeric Comparison Breakdown */}
                      <div className="mt-4 pt-3.5 border-t border-black/10 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <div className="opacity-75">Valor Total Lido</div>
                          <div className="font-mono tabular-nums text-sm sm:text-base font-extrabold mt-0.5">
                            {formatBRL(divergence.valorTotalDocumento)}
                          </div>
                        </div>

                        <div>
                          <div className="opacity-75">Soma dos Itens</div>
                          <div className="font-mono tabular-nums text-sm sm:text-base font-bold mt-0.5">
                            {formatBRL(divergence.somaItens)}
                          </div>
                        </div>

                        <div>
                          <div className="opacity-75">Desc. / Acrésc. Doc.</div>
                          <div className="font-mono tabular-nums text-sm sm:text-base font-semibold mt-0.5">
                            {divergence.descontoDocumento > 0 || divergence.acrescimoDocumento > 0
                              ? `${divergence.descontoDocumento > 0 ? `-${formatBRL(divergence.descontoDocumento)}` : ""}${
                                  divergence.descontoDocumento > 0 && divergence.acrescimoDocumento > 0 ? " / " : ""
                                }${divergence.acrescimoDocumento > 0 ? `+${formatBRL(divergence.acrescimoDocumento)}` : ""}`
                              : "R$ 0,00"}
                          </div>
                        </div>

                        <div>
                          <div className="opacity-75">Total Calculado</div>
                          <div className="font-mono tabular-nums text-sm sm:text-base font-extrabold mt-0.5">
                            {formatBRL(divergence.totalCalculado)}
                          </div>
                        </div>
                      </div>
                    </section>

                    {/* 3. FORMULÁRIO EDITÁVEL — DADOS GERAIS DO DOCUMENTO */}
                    <section className="bg-white text-[#2E003D] rounded-xl border border-white/15 p-5 sm:p-6">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-100">
                        <div>
                          <h2 className="text-base font-extrabold text-[#2E003D]">
                            Dados Gerais do Documento
                          </h2>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Campos destacados em âmbar retornaram <code className="font-mono text-amber-700">null</code> (não identificados no documento).
                          </p>
                        </div>
                        {usedModel && (
                          <span className="text-xs text-slate-400 font-mono">
                            Motor: {usedModel}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="sm:col-span-2 lg:col-span-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Fornecedor
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.fornecedor ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "fornecedor",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="Não identificado (null)"
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-medium text-[#2E003D] placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${nullHeaderInputClass(
                              extractedDoc.fornecedor
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Tipo de Documento
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.tipo_documento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "tipo_documento",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="Ex.: NF-e, Cupom, Boleto"
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-medium text-[#2E003D] placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${nullHeaderInputClass(
                              extractedDoc.tipo_documento
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            CNPJ / CPF
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.cnpj_cpf ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "cnpj_cpf",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="Não identificado (null)"
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-mono text-[#2E003D] placeholder:font-sans placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${nullHeaderInputClass(
                              extractedDoc.cnpj_cpf
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Número do Documento
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.numero_documento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "numero_documento",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="Não identificado (null)"
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-mono text-[#2E003D] placeholder:font-sans placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${nullHeaderInputClass(
                              extractedDoc.numero_documento
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Data de Emissão
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.data_emissao ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "data_emissao",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="DD/MM/AAAA (null)"
                            className={`w-full px-3 py-2 rounded-lg border text-sm font-mono text-[#2E003D] placeholder:font-sans placeholder:text-amber-700/60 focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${nullHeaderInputClass(
                              extractedDoc.data_emissao
                            )}`}
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Data de Vencimento
                          </label>
                          <input
                            type="text"
                            value={extractedDoc.data_vencimento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "data_vencimento",
                                e.target.value.trim() ? e.target.value : null
                              )
                            }
                            placeholder="Opcional / null"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono text-[#2E003D] placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:border-[#7E00B2] focus:ring-2 focus:ring-[#7E00B2]/25"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Subtotal (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={extractedDoc.subtotal ?? ""}
                            onChange={(e) =>
                              updateHeaderField("subtotal", parseInputNumber(e.target.value))
                            }
                            placeholder="null"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono tabular-nums text-[#2E003D] placeholder:text-slate-400 focus:outline-none focus:border-[#7E00B2] focus:ring-2 focus:ring-[#7E00B2]/25"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Desconto do Doc. (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={extractedDoc.desconto_documento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "desconto_documento",
                                parseInputNumber(e.target.value)
                              )
                            }
                            placeholder="0,00"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono tabular-nums text-[#2E003D] placeholder:text-slate-400 focus:outline-none focus:border-[#7E00B2] focus:ring-2 focus:ring-[#7E00B2]/25"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1">
                            Acréscimo / Frete (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={extractedDoc.acrescimo_documento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "acrescimo_documento",
                                parseInputNumber(e.target.value)
                              )
                            }
                            placeholder="0,00"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-mono tabular-nums text-[#2E003D] placeholder:text-slate-400 focus:outline-none focus:border-[#7E00B2] focus:ring-2 focus:ring-[#7E00B2]/25"
                          />
                        </div>

                        <div className="sm:col-span-2 lg:col-span-1">
                          <label className="block text-[11px] font-bold uppercase tracking-wide text-[#670089] mb-1">
                            Valor Total do Doc. (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={extractedDoc.valor_total_documento ?? ""}
                            onChange={(e) =>
                              updateHeaderField(
                                "valor_total_documento",
                                parseInputNumber(e.target.value)
                              )
                            }
                            placeholder="Não identificado"
                            className={`w-full px-3 py-2 rounded-lg border-2 text-sm font-mono tabular-nums font-extrabold text-[#2E003D] placeholder:font-sans placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-[#7E00B2]/25 ${
                              extractedDoc.valor_total_documento === null
                                ? "border-amber-400 bg-amber-50/70"
                                : "border-[#7E00B2]/40 bg-[#7E00B2]/[0.03]"
                            }`}
                          />
                        </div>
                      </div>
                    </section>

                    {/* 4. TABELA EDITÁVEL DE ITENS */}
                    <section className="bg-white text-[#2E003D] rounded-xl border border-white/15 overflow-hidden">
                      <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-base font-extrabold text-[#2E003D]">
                            Itens Extraídos ({extractedDoc.itens.length})
                          </h2>
                          {categoryTotals.length > 0 && (
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                              {categoryTotals.map(([cat, total], idx) => (
                                <span key={cat} className="inline-flex items-center gap-2">
                                  {idx > 0 && <span aria-hidden="true">·</span>}
                                  <span>
                                    <strong className="text-[#2E003D] font-semibold">{cat}</strong>{" "}
                                    <span className="font-mono tabular-nums">{formatBRL(total)}</span>
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={handleAddItem}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#2E003D] hover:bg-[#670089] text-white text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#E7FF00]" />
                          Adicionar Item
                        </button>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[820px] text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                              <th className="py-2.5 px-3 w-[230px]">Descrição</th>
                              <th className="py-2.5 px-2 w-[72px] text-right">Qtd</th>
                              <th className="py-2.5 px-2 w-[66px]">Un.</th>
                              <th className="py-2.5 px-2 w-[96px] text-right">V. Unit.</th>
                              <th className="py-2.5 px-2 w-[82px] text-right">Desc.</th>
                              <th className="py-2.5 px-2 w-[104px] text-right">V. Total</th>
                              <th className="py-2.5 px-2 w-[142px]">Categoria</th>
                              <th className="py-2.5 px-2 w-[150px]">Subcategoria</th>
                              <th className="py-2.5 px-2 w-[42px] text-center" aria-label="Ações" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {extractedDoc.itens.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="py-8 px-4 text-center text-slate-500">
                                  Nenhum item discriminado foi identificado neste documento. Clique em{" "}
                                  <strong>Adicionar Item</strong> para incluir manualmente.
                                </td>
                              </tr>
                            ) : (
                              extractedDoc.itens.map((item) => {
                                const datalistId = `subcat-${item.id}`;
                                const suggestions = item.categoria_sugerida
                                  ? SUBCATEGORY_SUGGESTIONS[item.categoria_sugerida]
                                  : [];

                                return (
                                  <tr
                                    key={item.id}
                                    className="hover:bg-[#7E00B2]/[0.03] transition-colors align-middle"
                                  >
                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.descricao ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "descricao",
                                            e.target.value ? e.target.value : null
                                          )
                                        }
                                        placeholder="Descrição (null)"
                                        className={`w-full px-2 py-1.5 rounded border text-xs font-medium text-[#2E003D] focus:outline-none focus:border-[#7E00B2] ${nullHeaderInputClass(
                                          item.descricao
                                        )}`}
                                      />
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="any"
                                        value={item.quantidade ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "quantidade",
                                            parseInputNumber(e.target.value)
                                          )
                                        }
                                        placeholder="null"
                                        className={`w-full px-2 py-1.5 rounded border text-xs text-right font-mono tabular-nums text-[#2E003D] focus:outline-none focus:border-[#7E00B2] ${nullHeaderInputClass(
                                          item.quantidade
                                        )}`}
                                      />
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="text"
                                        value={item.unidade ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "unidade",
                                            e.target.value.trim() ? e.target.value : null
                                          )
                                        }
                                        placeholder="un"
                                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white text-xs font-mono text-[#2E003D] focus:outline-none focus:border-[#7E00B2]"
                                      />
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.valor_unitario ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "valor_unitario",
                                            parseInputNumber(e.target.value)
                                          )
                                        }
                                        placeholder="null"
                                        className={`w-full px-2 py-1.5 rounded border text-xs text-right font-mono tabular-nums text-[#2E003D] focus:outline-none focus:border-[#7E00B2] ${nullHeaderInputClass(
                                          item.valor_unitario
                                        )}`}
                                      />
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.desconto_item ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "desconto_item",
                                            parseInputNumber(e.target.value)
                                          )
                                        }
                                        placeholder="0,00"
                                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white text-xs text-right font-mono tabular-nums text-[#2E003D] focus:outline-none focus:border-[#7E00B2]"
                                      />
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        value={item.valor_total_item ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "valor_total_item",
                                            parseInputNumber(e.target.value)
                                          )
                                        }
                                        placeholder="null"
                                        className={`w-full px-2 py-1.5 rounded border text-xs text-right font-mono tabular-nums font-bold text-[#2E003D] focus:outline-none focus:border-[#7E00B2] ${nullHeaderInputClass(
                                          item.valor_total_item
                                        )}`}
                                      />
                                    </td>

                                    <td className="p-2">
                                      <select
                                        value={item.categoria_sugerida ?? ""}
                                        onChange={(e) => {
                                          const nextCat = e.target.value
                                            ? (e.target.value as MandatoryCategory)
                                            : null;
                                          updateItemField(item.id, "categoria_sugerida", nextCat);
                                        }}
                                        className={`w-full px-2 py-1.5 rounded border text-xs font-semibold text-[#2E003D] focus:outline-none focus:border-[#7E00B2] ${nullHeaderInputClass(
                                          item.categoria_sugerida
                                        )}`}
                                      >
                                        <option value="">Selecionar...</option>
                                        {MANDATORY_CATEGORIES.map((cat) => (
                                          <option key={cat} value={cat}>
                                            {cat}
                                          </option>
                                        ))}
                                      </select>
                                    </td>

                                    <td className="p-2">
                                      <input
                                        type="text"
                                        list={datalistId}
                                        value={item.subcategoria_sugerida ?? ""}
                                        onChange={(e) =>
                                          updateItemField(
                                            item.id,
                                            "subcategoria_sugerida",
                                            e.target.value.trim() ? e.target.value : null
                                          )
                                        }
                                        placeholder="Subcategoria"
                                        className="w-full px-2 py-1.5 rounded border border-slate-200 bg-white text-xs text-[#2E003D] focus:outline-none focus:border-[#7E00B2]"
                                      />
                                      <datalist id={datalistId}>
                                        {suggestions.map((s) => (
                                          <option key={s} value={s} />
                                        ))}
                                      </datalist>
                                    </td>

                                    <td className="p-2 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItem(item.id)}
                                        aria-label={`Excluir item ${item.descricao ?? ""}`}
                                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-[#2E003D]">
                              <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wide text-slate-600">
                                Soma dos Itens Extraídos
                              </td>
                              <td className="py-3 px-2 text-right font-mono tabular-nums text-sm font-extrabold text-[#2E003D]">
                                {formatBRL(divergence.somaItens)}
                              </td>
                              <td colSpan={3} className="py-3 px-3 text-[11px] font-normal text-slate-500">
                                Recalculado automaticamente em tempo real
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </section>

                    {/* 5. PAINEL RECOLHÍVEL DE JSON ESTRUTURADO + EXPORTAÇÃO CSV */}
                    <section className="bg-[#3D0051] rounded-xl border border-white/12 overflow-hidden">
                      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => setShowJsonPanel((prev) => !prev)}
                          className="inline-flex items-center gap-2 text-sm font-bold text-white hover:text-[#E7FF00] transition-colors cursor-pointer"
                        >
                          <Code2 className="w-4 h-4 text-[#E7FF00]" />
                          <span>
                            {showJsonPanel
                              ? "Ocultar JSON Estruturado"
                              : "Visualizar JSON Estruturado (Tempo Real)"}
                          </span>
                          {showJsonPanel ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyJson()}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                          >
                            {copiedJson ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-[#E7FF00]" />
                                <span className="text-[#E7FF00]">JSON Copiado!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiar JSON</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadCsv}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E7FF00] hover:bg-[#d8ee00] text-[#2E003D] text-xs font-extrabold transition-colors whitespace-nowrap cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Baixar CSV</span>
                          </button>
                        </div>
                      </div>

                      {showJsonPanel && (
                        <div className="border-t border-white/10 bg-[#1A0024] p-4 sm:p-5 overflow-x-auto max-h-[420px]">
                          <pre className="font-mono text-xs text-slate-100 leading-relaxed whitespace-pre">
                            {liveJsonString}
                          </pre>
                        </div>
                      )}
                    </section>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
