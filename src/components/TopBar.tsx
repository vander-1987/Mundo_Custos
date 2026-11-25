import { ArrowRight, RotateCcw } from "lucide-react";

export type AppView = "landing" | "lab";

interface TopBarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  hasActiveDocument: boolean;
  onResetDocument: () => void;
}

export function TopBar({
  activeView,
  onNavigate,
  hasActiveDocument,
  onResetDocument,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 h-16 bg-[#2E003D]/95 backdrop-blur-md border-b border-white/10">
      <div className="max-w-[1380px] mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate("landing")}
          className="font-display-impact text-xl sm:text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00] rounded-sm"
        >
          MUNDO<span className="text-[#E7FF00]">+</span> CUSTOS
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Navegação principal"
          className="flex items-center gap-5 sm:gap-8 text-sm font-medium"
        >
          <button
            type="button"
            onClick={() => onNavigate("landing")}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00] rounded-sm ${
              activeView === "landing"
                ? "text-white font-semibold"
                : "text-white/70 hover:text-white"
            }`}
          >
            Visão Geral
            {activeView === "landing" && (
              <span className="absolute left-0 right-0 -bottom-[21px] h-[3px] bg-[#E7FF00]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => onNavigate("lab")}
            className={`relative py-1 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00] rounded-sm ${
              activeView === "lab"
                ? "text-white font-semibold"
                : "text-white/70 hover:text-white"
            }`}
          >
            Laboratório de Testes
            {activeView === "lab" && (
              <span className="absolute left-0 right-0 -bottom-[21px] h-[3px] bg-[#E7FF00]" />
            )}
          </button>
        </nav>

        {/* Zone 3: Single contextual primary action */}
        <div className="hidden sm:flex items-center shrink-0">
          {activeView === "landing" ? (
            <button
              type="button"
              onClick={() => onNavigate("lab")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#E7FF00] hover:bg-[#d9f000] text-[#2E003D] text-xs font-extrabold uppercase tracking-wide rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Abrir Laboratório
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : hasActiveDocument ? (
            <button
              type="button"
              onClick={onResetDocument}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#3D0051] hover:bg-[#670089] text-white border border-white/15 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00]"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar / Novo Documento
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate("landing")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#3D0051] hover:bg-[#670089] text-white/90 border border-white/15 text-xs font-semibold rounded-md transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E7FF00]"
            >
              Tela Inicial
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
