import { useEffect, useState } from "react";
import { DocumentLab } from "./components/DocumentLab";
import { LandingPage } from "./components/LandingPage";
import { TopBar, type AppView } from "./components/TopBar";
import type {
  ExtractedDocument,
  SessionStoreContext,
  UploadedFileState,
} from "./types/document";

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("landing");
  const [storeContext, setStoreContext] = useState<SessionStoreContext>({
    nomeAcaiteria: "",
    email: "",
  });
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null);
  const [extractedDoc, setExtractedDoc] = useState<ExtractedDocument | null>(null);

  // Clean up object URL on unmount if present
  useEffect(() => {
    return () => {
      if (uploadedFile?.previewUrl) {
        URL.revokeObjectURL(uploadedFile.previewUrl);
      }
    };
  }, [uploadedFile]);

  function handleNavigate(view: AppView) {
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleEnterLab(context: SessionStoreContext) {
    setStoreContext(context);
    setActiveView("lab");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleResetDocument() {
    if (uploadedFile?.previewUrl) {
      URL.revokeObjectURL(uploadedFile.previewUrl);
    }
    setUploadedFile(null);
    setExtractedDoc(null);
  }

  return (
    <div className="min-h-screen bg-[#2E003D] text-white flex flex-col">
      <TopBar
        activeView={activeView}
        onNavigate={handleNavigate}
        hasActiveDocument={Boolean(uploadedFile)}
        onResetDocument={handleResetDocument}
      />

      <div className="flex-1">
        {activeView === "landing" ? (
          <LandingPage storeContext={storeContext} onEnterLab={handleEnterLab} />
        ) : (
          <DocumentLab
            storeContext={storeContext}
            uploadedFile={uploadedFile}
            onFileChange={setUploadedFile}
            extractedDoc={extractedDoc}
            onDocChange={setExtractedDoc}
            onResetAll={handleResetDocument}
          />
        )}
      </div>
    </div>
  );
}
