import { useState, type FormEvent } from "react";
import { ArrowRight, Calculator, FileCheck2, FileSpreadsheet, Layers } from "lucide-react";
import { MANDATORY_CATEGORIES, type SessionStoreContext } from "../types/document";

interface LandingPageProps {
  storeContext: SessionStoreContext;
  onEnterLab: (context: SessionStoreContext) => void;
}

export function LandingPage({ storeContext, onEnterLab }: LandingPageProps) {
  const [nomeAcaiteria, setNomeAcaiteria] = useState(storeContext.nomeAcaiteria);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onEnterLab({
      nomeAcaiteria: nomeAcaiteria.trim(),
      email: "",
    });
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#2E003D] text-white flex flex-col justify-between">
      <div className="max-w-[1140px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Coluna Esquerda: Contexto operacional direto */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#E7FF00]">
                FERRAMENTA INTERNA · USO OPERACIONAL
              </p>
              <h1 className="font-display-impact text-3xl sm:text-5xl font-bold text-white mt-2 leading-tight">
                MUNDO<span className="text-[#E7FF00]">+</span> CUSTOS
              </h1>
              <p className="mt-3 text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
                Ambiente prático para leitura de documentos fiscais, conferência automática de totais e classificação de insumos, embalagens e despesas de açaiteria.
              </p>
            </div>

            {/* Resumo técnico do fluxo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
              <div className="bg-[#3D0051] border border-white/10 rounded-xl p-4">
                <FileCheck2 className="w-4 h-4 text-[#E7FF00] mb-2" />
                <h2 className="text-sm font-bold text-white">1. Leitura Multimodal</h2>
                <p className="mt-1 text-xs text-white/70 leading-relaxed">
                  Envie imagens (JPG, PNG, WEBP) ou arquivos PDF de NF-e, NFC-e, cupons, recibos e boletos.
                </p>
              </div>

              <div className="bg-[#3D0051] border border-white/10 rounded-xl p-4">
                <Calculator className="w-4 h-4 text-[#E7FF00] mb-2" />
                <h2 className="text-sm font-bold text-white">2. Conferência e Edição</h2>
                <p className="mt-1 text-xs text-white/70 leading-relaxed">
                  Valide a soma dos itens contra o total da nota, revise alertas de leitura e ajuste valores em tempo real.
                </p>
              </div>

              <div className="bg-[#3D0051] border border-white/10 rounded-xl p-4">
                <FileSpreadsheet className="w-4 h-4 text-[#E7FF00] mb-2" />
                <h2 className="text-sm font-bold text-white">3. Exportação Limpa</h2>
                <p className="mt-1 text-xs text-white/70 leading-relaxed">
                  Copie o JSON estruturado atualizado ou baixe a planilha CSV pronta para uso.
                </p>
              </div>
            </div>

            {/* Taxonomia de categorias configuradas */}
            <div className="bg-[#3D0051]/70 border border-white/10 rounded-xl p-4 sm:p-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-white/80 mb-2.5">
                <Layers className="w-3.5 h-3.5 text-[#E7FF00]" />
                <span>Plano de Categorias Padrão ({MANDATORY_CATEGORIES.length})</span>
              </div>
              <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                {MANDATORY_CATEGORIES.join("  ·  ")}
              </p>
            </div>
          </div>

          {/* Coluna Direita: Painel Direto de Entrada */}
          <div className="lg:col-span-5">
            <div className="bg-white text-[#2E003D] rounded-xl p-6 sm:p-7 border border-white/15 shadow-lg">
              <h2 className="text-lg font-extrabold text-[#2E003D]">
                Iniciar Sessão de Leitura
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-600">
                Os documentos analisados permanecem apenas na memória durante o uso.
              </p>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="unidade-acaiteria"
                    className="block text-xs font-bold uppercase tracking-wide text-slate-600 mb-1.5"
                  >
                    Identificação da Loja / Unidade{" "}
                    <span className="font-normal normal-case text-slate-400">(opcional)</span>
                  </label>
                  <input
                    id="unidade-acaiteria"
                    type="text"
                    value={nomeAcaiteria}
                    onChange={(e) => setNomeAcaiteria(e.target.value)}
                    placeholder="Ex.: Matriz, Loja Centro..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-sm text-[#2E003D] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#7E00B2] focus:border-[#7E00B2] transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#E7FF00] hover:bg-[#d7ee00] text-[#2E003D] font-extrabold text-sm uppercase tracking-wide rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7E00B2] focus-visible:ring-offset-2"
                >
                  Abrir Laboratório de Documentos
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </button>
              </form>

              <div className="mt-5 pt-4 border-t border-slate-100 space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Formatos aceitos:</span>
                  <span className="font-mono font-semibold text-[#2E003D]">JPG, PNG, WEBP, PDF</span>
                </div>
                <div className="flex justify-between">
                  <span>Armazenamento:</span>
                  <span className="font-semibold text-[#2E003D]">100% em memória (sessão)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé discreto */}
      <footer className="border-t border-white/10 py-4 text-xs text-white/50">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Mundo+ Custos — Controle de custos, CMV e estoque para açaiterias</span>
          <span className="font-mono">Sessão local em memória</span>
        </div>
      </footer>
    </main>
  );
}
