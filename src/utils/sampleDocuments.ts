/**
 * Generates realistic Brazilian açaiteria supplier documents as actual PNG blobs/base64
 * so they can be previewed and sent to the real Gemini 4 Hydrogen API endpoint.
 */

export interface GeneratedSampleDoc {
  fileName: string;
  mimeType: "image/png";
  base64: string;
  previewUrl: string;
  size: number;
}

function canvasToSample(canvas: HTMLCanvasElement, fileName: string): Promise<GeneratedSampleDoc> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Falha ao gerar imagem de exemplo."));
        return;
      }
      const previewUrl = URL.createObjectURL(blob);
      const dataUrl = canvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1] ?? "";
      resolve({
        fileName,
        mimeType: "image/png",
        base64,
        previewUrl,
        size: blob.size,
      });
    }, "image/png");
  });
}

/**
 * Sample 1: Clean, complete NF-e from an açaí distributor where all items sum exactly to the total.
 */
export async function generateCleanNfeSample(): Promise<GeneratedSampleDoc> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = 1240;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível.");

  // Paper background
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer border
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 2;
  ctx.strokeRect(32, 32, 896, 1176);

  // Header band
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(34, 34, 892, 130);
  ctx.strokeStyle = "#CBD5E1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 164);
  ctx.lineTo(928, 164);
  ctx.stroke();

  // Supplier info
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 24px sans-serif";
  ctx.fillText("AMAZÔNIA POLPAS & INSUMOS LTDA", 54, 76);

  ctx.font = "15px sans-serif";
  ctx.fillStyle = "#334155";
  ctx.fillText("CNPJ: 28.451.902/0001-64   |   IE: 142.889.310.112", 54, 104);
  ctx.fillText("Av. dos Castanheiros, 1420 - Galpão 4 - Belém/PA", 54, 128);
  ctx.fillText("Fornecedor Especializado em Polpas, Cremes e Descartáveis", 54, 150);

  // DANFE box right
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(640, 48, 268, 102);
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText("DANFE — NF-e", 660, 78);
  ctx.font = "bold 15px monospace";
  ctx.fillText("Nº 000.048.921", 660, 106);
  ctx.font = "14px sans-serif";
  ctx.fillText("Série: 001  |  Emissão: 18/11/2026", 660, 132);

  // Recipient block
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("DESTINATÁRIO / REMETENTE", 54, 194);
  ctx.strokeStyle = "#CBD5E1";
  ctx.strokeRect(52, 204, 856, 66);
  ctx.font = "15px sans-serif";
  ctx.fillText("AÇAITERIA ROXO REAL COMÉRCIO DE ALIMENTOS ME", 66, 232);
  ctx.fillStyle = "#475569";
  ctx.font = "14px sans-serif";
  ctx.fillText("Data de Emissão: 18/11/2026    |    Data de Vencimento: 02/12/2026    |    Forma: Boleto 14d", 66, 256);

  // Items table header
  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("DADOS DOS PRODUTOS / SERVIÇOS", 54, 306);

  const tableTop = 318;
  ctx.fillStyle = "#1E293B";
  ctx.fillRect(52, tableTop, 856, 36);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 13px sans-serif";
  ctx.fillText("CÓD", 64, tableTop + 23);
  ctx.fillText("DESCRIÇÃO DO PRODUTO", 130, tableTop + 23);
  ctx.fillText("QTD", 495, tableTop + 23);
  ctx.fillText("UN", 560, tableTop + 23);
  ctx.fillText("V. UNIT (R$)", 635, tableTop + 23);
  ctx.fillText("V. TOTAL (R$)", 780, tableTop + 23);

  const items = [
    ["001", "Polpa de Açaí Especial 14% Sólidos (Cx 10kg)", "6", "cx", "168,00", "1.008,00"],
    ["002", "Creme de Leite Ninho Artesanal Balde 4kg", "2", "un", "112,50", "225,00"],
    ["003", "Granola Tradicional Crocante Pacote 1kg", "8", "kg", "19,90", "159,20"],
    ["004", "Leite Condensado Integral Bag 2,5kg", "4", "un", "34,50", "138,00"],
    ["005", "Pote Cristal PP 500ml c/ Tampa (Cx 250un)", "2", "cx", "94,00", "188,00"],
    ["006", "Colher Descartável Reforçada Roxa (Pct 500un)", "3", "pct", "28,00", "84,00"],
    ["007", "Detergente Neutro Concentrado Galão 5L", "1", "un", "32,80", "32,80"],
  ];

  let y = tableTop + 36;
  items.forEach((row, idx) => {
    ctx.fillStyle = idx % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
    ctx.fillRect(52, y, 856, 52);
    ctx.strokeStyle = "#E2E8F0";
    ctx.strokeRect(52, y, 856, 52);

    ctx.fillStyle = "#0F172A";
    ctx.font = "14px monospace";
    ctx.fillText(row[0], 64, y + 31);
    ctx.font = "14px sans-serif";
    ctx.fillText(row[1], 130, y + 31);
    ctx.font = "14px monospace";
    ctx.fillText(row[2], 502, y + 31);
    ctx.fillText(row[3], 562, y + 31);
    ctx.fillText(row[4], 652, y + 31);
    ctx.font = "bold 14px monospace";
    ctx.fillText(row[5], 796, y + 31);
    y += 52;
  });

  // Totals box
  const totalsTop = y + 36;
  ctx.fillStyle = "#F8FAFC";
  ctx.fillRect(52, totalsTop, 856, 128);
  ctx.strokeStyle = "#1E293B";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, totalsTop, 856, 128);

  ctx.fillStyle = "#475569";
  ctx.font = "bold 12px sans-serif";
  ctx.fillText("SUBTOTAL PRODUTOS", 72, totalsTop + 32);
  ctx.fillText("DESCONTO COMERCIAL", 290, totalsTop + 32);
  ctx.fillText("FRETE / ACRÉSCIMOS", 505, totalsTop + 32);
  ctx.fillText("VALOR TOTAL DA NOTA", 710, totalsTop + 32);

  ctx.fillStyle = "#0F172A";
  ctx.font = "bold 20px monospace";
  ctx.fillText("R$ 1.835,00", 72, totalsTop + 68);
  ctx.fillText("R$ 35,00", 290, totalsTop + 68);
  ctx.fillText("R$ 0,00", 505, totalsTop + 68);

  ctx.fillStyle = "#2E003D";
  ctx.font = "bold 24px monospace";
  ctx.fillText("R$ 1.800,00", 710, totalsTop + 70);

  ctx.fillStyle = "#64748B";
  ctx.font = "13px sans-serif";
  ctx.fillText("Observação: Entrega refrigerada -18°C conferida no recebimento. Chave: 1526 1128 4519 0200 0164 5500 1000 0489 2110 4829 1120", 72, totalsTop + 108);

  // Barcode aesthetic footer
  const footerY = 1090;
  ctx.fillStyle = "#0F172A";
  for (let i = 0; i < 68; i++) {
    const w = (i * 7) % 3 === 0 ? 4 : 2;
    ctx.fillRect(54 + i * 12, footerY, w, 58);
  }
  ctx.fillStyle = "#475569";
  ctx.font = "12px monospace";
  ctx.fillText("DOCUMENTO AUXILIAR DA NOTA FISCAL ELETRÔNICA — EXEMPLO DE TESTE MUNDO+ CUSTOS", 54, footerY + 80);

  return canvasToSample(canvas, "NFe_Amazonia_Polpas_048921.png");
}

/**
 * Sample 2: Thermal receipt with cropped/smudged fields + deliberate mathematical divergence
 * to test anti-hallucination (null fields), alertas_leitura, and real-time divergence alert.
 */
export async function generateDivergentCupomSample(): Promise<GeneratedSampleDoc> {
  const canvas = document.createElement("canvas");
  canvas.width = 680;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não disponível.");

  // Dark table background behind thermal receipt
  ctx.fillStyle = "#D4D4D8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Thermal yellow-cream paper
  ctx.fillStyle = "#FEFCE8";
  ctx.fillRect(54, 30, 572, 1010);
  ctx.strokeStyle = "#E5E7EB";
  ctx.lineWidth = 1;
  ctx.strokeRect(54, 30, 572, 1010);

  // Header
  ctx.fillStyle = "#18181B";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("ATACADÃO DAS FRUTAS & TOPPINGS", 340, 82);

  ctx.font = "15px monospace";
  ctx.fillText("CUPOM FISCAL ELETRÔNICO - NFC-e", 340, 112);

  // Blurred / smudged CNPJ
  ctx.textAlign = "left";
  ctx.fillStyle = "#27272A";
  ctx.font = "15px monospace";
  ctx.fillText("CNPJ: 41.89", 92, 146);
  // Ink smudge obscuring rest of CNPJ
  ctx.fillStyle = "rgba(30, 30, 35, 0.72)";
  ctx.fillRect(190, 128, 195, 24);
  ctx.fillStyle = "rgba(254, 252, 232, 0.55)";
  ctx.fillRect(210, 132, 95, 16);

  // Cropped receipt number at right edge
  ctx.fillStyle = "#27272A";
  ctx.fillText("EMISSÃO: 21/11/2026 09:42", 92, 178);
  ctx.fillText("EXTRATO Nº: ", 92, 206);
  // Torn / whiteout fold covering document number
  ctx.fillStyle = "#E4E4E7";
  ctx.fillRect(202, 189, 140, 24);

  // Dashed divider
  ctx.fillStyle = "#52525B";
  ctx.fillText("------------------------------------------------", 78, 240);

  // Column headings
  ctx.fillStyle = "#18181B";
  ctx.font = "bold 14px monospace";
  ctx.fillText("ITEM  DESCRIÇÃO                 QTD  UN   V.TOT", 78, 268);
  ctx.font = "14px monospace";
  ctx.fillText("------------------------------------------------", 78, 290);

  // Items (sum of visible totals = 54.00 + 68.50 + 49.90 + 62.00 + 35.00 = 269.40)
  const lines = [
    { code: "001", desc: "MORANGO FRESCO BANDEJA", qty: "6", un: "un", unit: "9,00", total: "54,00", smudgeUnit: false },
    { code: "002", desc: "CREME DE AVELÃ BALDE 3KG", qty: "1", un: "un", unit: "68,50", total: "68,50", smudgeUnit: false },
    { code: "003", desc: "PAÇOCA ROLHA POTE 1,5KG", qty: "2", un: "un", unit: "24,95", total: "49,90", smudgeUnit: true },
    { code: "004", desc: "COPO TERMICO ISOPOR 300ML", qty: "2", un: "pct", unit: "31,00", total: "62,00", smudgeUnit: false },
    { code: "005", desc: "LEITE EM PÓ INTEGRAL 1KG", qty: "1", un: "kg", unit: "35,00", total: "35,00", smudgeUnit: false },
  ];

  let y = 328;
  lines.forEach((item) => {
    ctx.fillStyle = "#18181B";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`${item.code}  ${item.desc}`, 78, y);

    ctx.font = "15px monospace";
    ctx.fillStyle = "#27272A";
    ctx.fillText(`     ${item.qty} ${item.un} x R$ ${item.unit}`, 78, y + 26);

    ctx.font = "bold 15px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`R$ ${item.total}`, 596, y + 26);
    ctx.textAlign = "left";

    // Smudge over unit price of item 003 to trigger anti-hallucination + alert
    if (item.smudgeUnit) {
      ctx.fillStyle = "rgba(80, 75, 65, 0.78)";
      ctx.beginPath();
      ctx.ellipse(275, y + 21, 56, 13, -0.06, 0, Math.PI * 2);
      ctx.fill();
    }

    y += 74;
  });

  // Dashed divider
  ctx.fillStyle = "#52525B";
  ctx.font = "14px monospace";
  ctx.fillText("------------------------------------------------", 78, y + 10);

  // Totals with deliberate discrepancy:
  // Items sum to R$ 269,40, but printed VALOR A PAGAR is R$ 284,90 (R$ 15,50 difference!)
  const totY = y + 54;
  ctx.fillStyle = "#18181B";
  ctx.font = "16px monospace";
  ctx.fillText("QTD. TOTAL DE ITENS:", 82, totY);
  ctx.textAlign = "right";
  ctx.fillText("5", 596, totY);

  ctx.textAlign = "left";
  ctx.fillText("SUBTOTAL:", 82, totY + 34);
  ctx.textAlign = "right";
  ctx.fillText("R$ 269,40", 596, totY + 34);

  ctx.textAlign = "left";
  ctx.font = "bold 22px monospace";
  ctx.fillText("VALOR TOTAL R$:", 82, totY + 82);
  ctx.textAlign = "right";
  ctx.fillText("R$ 284,90", 596, totY + 82);

  ctx.textAlign = "left";
  ctx.font = "14px monospace";
  ctx.fillStyle = "#3F3F46";
  ctx.fillText("FORMA DE PAGAMENTO: PIX", 82, totY + 124);
  ctx.fillText("OBS: PAPEL TÉRMICO COM DOBRA E MANCHA NO TOPO", 82, totY + 154);

  // Subtle crease line across receipt
  ctx.strokeStyle = "rgba(120, 113, 108, 0.28)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(54, 515);
  ctx.lineTo(626, 535);
  ctx.stroke();

  return canvasToSample(canvas, "Cupom_Atacadao_Frutas_Manchado.png");
}
