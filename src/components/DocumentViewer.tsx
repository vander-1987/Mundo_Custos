import { useState } from "react";
import { FileText, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import type { UploadedFileState } from "../types/document";

interface DocumentViewerProps {
  file: UploadedFileState;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DocumentViewer({ file }: DocumentViewerProps) {
  const [zoom, setZoom] = useState<number>(100);
  const [fitMode, setFitMode] = useState<boolean>(true);

  const isPdf = file.mimeType === "application/pdf";

  function handleZoomIn() {
    setFitMode(false);
    setZoom((prev) => Math.min(300, prev + 25));
  }

  function handleZoomOut() {
    setFitMode(false);
    setZoom((prev) => Math.max(50, prev - 25));
  }

  function handleFitToScreen() {
    setFitMode(true);
    setZoom(100);
  }

  return (
    <div className="flex flex-col h-full bg-[#3D0051] rounded-xl border border-white/12 overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 bg-[#2E003D] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2.5">
          <FileText className="w-4 h-4 text-[#E7FF00] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate" title={file.name}>
              {file.name}
            </p>
            <div className="flex items-center gap-2 text-xs text-white/65">
              <span>{isPdf ? "Documento PDF" : file.mimeType.replace("image/", "").toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{formatFileSize(file.size)}</span>
              {file.isSample && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#E7FF00]">Exemplo de teste</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Zoom Controls for Images */}
        {!isPdf && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={!fitMode && zoom <= 50}
              aria-label="Diminuir zoom"
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="min-w-[48px] text-center font-mono tabular-nums text-xs font-semibold text-white">
              {fitMode ? "Ajust." : `${zoom}%`}
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={!fitMode && zoom >= 300}
              aria-label="Aumentar zoom"
              className="p-2 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-40 text-white transition-colors cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleFitToScreen}
              className={`ml-1 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                fitMode
                  ? "bg-[#E7FF00] text-[#2E003D]"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              Ajustar à tela
            </button>
          </div>
        )}
      </div>

      {/* Preview Canvas */}
      <div className="flex-1 min-h-[420px] lg:min-h-[680px] lg:max-h-[calc(100vh-190px)] bg-[#1A0024] overflow-auto">
        {isPdf ? (
          <div className="w-full h-full min-h-[540px] flex flex-col">
            <object
              data={file.previewUrl}
              type="application/pdf"
              className="w-full flex-1 min-h-[540px]"
              aria-label={`Visualização do PDF ${file.name}`}
            >
              <iframe
                src={file.previewUrl}
                title={file.name}
                className="w-full h-full min-h-[540px] border-0 bg-white"
              />
            </object>
          </div>
        ) : (
          <div className="p-4 sm:p-6 min-h-full flex items-start justify-center">
            <img
              src={file.previewUrl}
              alt={`Pré-visualização do documento ${file.name}`}
              style={
                fitMode
                  ? { maxWidth: "100%", height: "auto" }
                  : { width: `${zoom}%`, maxWidth: "none", height: "auto" }
              }
              className="rounded shadow-2xl border border-white/10 bg-white transition-all duration-150"
            />
          </div>
        )}
      </div>
    </div>
  );
}
