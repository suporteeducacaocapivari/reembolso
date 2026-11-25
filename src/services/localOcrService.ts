import jsQR from 'jsqr';
import { readBarcodes } from 'zxing-wasm/reader';
import { Html5Qrcode } from 'html5-qrcode';
import { createWorker } from 'tesseract.js';
import {
  decodificarQrCodeFiscal,
  validarOuRepararChave44,
  type DadosQrCodeFiscal,
} from './qrFiscalParser';
import type { DocumentoExtraidoGemini } from '../types';

/**
 * Consulta gratuita e pública na Receita Federal via BrasilAPI (sem chave de API)
 * para preencher automaticamente a Razão Social / Nome Fantasia a partir do CNPJ!
 */
export async function consultarRazaoSocialPorCnpj(cnpj: string): Promise<string> {
  const limpo = (cnpj || '').replace(/\D/g, '');
  if (limpo.length !== 14) return '';

  try {
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`);
    if (!resp.ok) return '';
    const json = await resp.json();
    return (json.razao_social || json.nome_fantasia || '').trim();
  } catch {
    return '';
  }
}

function carregarImagemDeFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Normalização Suave de Iluminação Local (Divide-by-Background com Imagem Integral).
 * Transforma fotos de celular com sombra forte no rodapé, papel amassado ou fundo cinza
 * em um documento claro uniforme de scanner (papel=255, tinta escura nítida), sem destruir bordas das letras!
 */
function normalizarIluminacaoSuave(src: ImageData, expoente = 3.2, divisorRaio = 10): ImageData {
  const w = src.width;
  const h = src.height;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  const d = out.data;

  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; p < w * h; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  }

  const stride = w + 1;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
    }
  }

  const raio = Math.max(18, Math.round(w / divisorRaio));
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - raio);
    const y2 = Math.min(h - 1, y + raio);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - raio);
      const x2 = Math.min(w - 1, x + raio);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const mean =
        (integral[(y2 + 1) * stride + (x2 + 1)] -
          integral[y1 * stride + (x2 + 1)] -
          integral[(y2 + 1) * stride + x1] +
          integral[y1 * stride + x1]) /
        count;

      const ratio = gray[y * w + x] / Math.max(30, mean);
      let norm = Math.round(255 * Math.pow(Math.min(1.04, ratio) / 1.04, expoente));
      norm = Math.max(0, Math.min(255, norm));

      const idx = (y * w + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = norm;
      d[idx + 3] = 255;
    }
  }

  return out;
}

function aplicarThresholdAdaptativoLocal(src: ImageData, sensibilidade = 0.12): ImageData {
  const w = src.width;
  const h = src.height;
  const out = new ImageData(new Uint8ClampedArray(src.data), w, h);
  const d = out.data;

  const gray = new Uint8Array(w * h);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  }

  const stride = w + 1;
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 1; y <= h; y++) {
    let rowSum = 0;
    for (let x = 1; x <= w; x++) {
      rowSum += gray[(y - 1) * w + (x - 1)];
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum;
    }
  }

  const raio = Math.max(8, Math.round(Math.min(w, h) / 16));
  const fator = 1 - sensibilidade;

  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - raio);
    const y2 = Math.min(h - 1, y + raio);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - raio);
      const x2 = Math.min(w - 1, x + raio);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      const sum =
        integral[(y2 + 1) * stride + (x2 + 1)] -
        integral[y1 * stride + (x2 + 1)] -
        integral[(y2 + 1) * stride + x1] +
        integral[y1 * stride + x1];

      const v = gray[y * w + x] < (sum / count) * fator ? 0 : 255;
      const idx = (y * w + x) * 4;
      d[idx] = d[idx + 1] = d[idx + 2] = v;
      d[idx + 3] = 255;
    }
  }

  return out;
}

/**
 * Lê QR Code Fiscal combinando zxing-wasm (C++ WebAssembly), BarcodeDetector e jsQR multi-região.
 */
export async function lerQrCodeDeArquivoImagem(file: File): Promise<DadosQrCodeFiscal | null> {
  if (!file.type.startsWith('image/')) return null;

  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const zxingRes = await readBarcodes(buf, {
      formats: ['QRCode'],
      tryHarder: true,
      tryRotate: true,
      tryInvert: true,
      tryDownscale: true,
    });
    for (const item of zxingRes) {
      const parsed = decodificarQrCodeFiscal(item.text);
      if (parsed) return parsed;
    }
  } catch {
    // continua
  }

  let detectorNativo: any = null;
  if ('BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      detectorNativo = new BarcodeDetectorClass({ formats: ['qr_code'] });
    } catch {
      detectorNativo = null;
    }
  }

  try {
    const img = await carregarImagemDeFile(file);
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    if (detectorNativo) {
      try {
        const res = await detectorNativo.detect(img);
        for (const item of res) {
          const parsed = decodificarQrCodeFiscal(item.rawValue);
          if (parsed) return parsed;
        }
      } catch {
        // continua
      }
    }

    const recortes = [
      { sx: 0, sy: 0, sw: w, sh: h, targetDim: 1400 },
      { sx: Math.floor(w * 0.15), sy: Math.floor(h * 0.60), sw: Math.floor(w * 0.70), sh: Math.floor(h * 0.38), targetDim: 800 },
      { sx: Math.floor(w * 0.22), sy: Math.floor(h * 0.65), sw: Math.floor(w * 0.56), sh: Math.floor(h * 0.32), targetDim: 650 },
      { sx: 0, sy: Math.floor(h * 0.40), sw: w, sh: Math.floor(h * 0.60), targetDim: 1100 },
    ];

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (ctx) {
      for (const rec of recortes) {
        if (rec.sw <= 0 || rec.sh <= 0) continue;
        const escala = Math.min(2.5, rec.targetDim / Math.max(rec.sw, rec.sh));
        const cw = Math.max(1, Math.round(rec.sw * escala));
        const ch = Math.max(1, Math.round(rec.sh * escala));

        canvas.width = cw;
        canvas.height = ch;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(img, rec.sx, rec.sy, rec.sw, rec.sh, 0, 0, cw, ch);

        const rawData = ctx.getImageData(0, 0, cw, ch);
        const qrRaw = jsQR(rawData.data, cw, ch, { inversionAttempts: 'attemptBoth' });
        if (qrRaw?.data) {
          const parsed = decodificarQrCodeFiscal(qrRaw.data);
          if (parsed) return parsed;
        }

        for (const sens of [0.12, 0.06, 0.18]) {
          const binData = aplicarThresholdAdaptativoLocal(rawData, sens);
          const qrBin = jsQR(binData.data, cw, ch, { inversionAttempts: 'dontInvert' });
          if (qrBin?.data) {
            const parsed = decodificarQrCodeFiscal(qrBin.data);
            if (parsed) return parsed;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Erro ao processar recortes de QR Code:', err);
  }

  const tempId = 'semec-qr-offscreen-reader';
  let tempEl = document.getElementById(tempId);
  if (!tempEl) {
    tempEl = document.createElement('div');
    tempEl.id = tempId;
    tempEl.style.position = 'fixed';
    tempEl.style.left = '-9999px';
    tempEl.style.top = '0';
    tempEl.style.width = '600px';
    tempEl.style.height = '600px';
    document.body.appendChild(tempEl);
  }

  try {
    const html5QrCode = new Html5Qrcode(tempId);
    const decodedText = await html5QrCode.scanFile(file, false);
    html5QrCode.clear();
    return decodificarQrCodeFiscal(decodedText);
  } catch {
    return null;
  }
}

export function parseValorMonetario(raw: string): number | null {
  const s = raw.trim().replace(/:/g, '.');
  if (!s) return null;

  if (s.includes('.') && s.includes(',')) {
    const lastDot = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
      return isNaN(n) ? null : n;
    } else {
      const n = parseFloat(s.replace(/,/g, ''));
      return isNaN(n) ? null : n;
    }
  }

  if (s.includes(',')) {
    const n = parseFloat(s.replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  if (/^\d+\.\d{1,2}$/.test(s)) {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  const n = parseFloat(s.replace(/\./g, ''));
  return isNaN(n) ? null : n;
}

/**
 * Recorta uma região percentual da foto, amplia e normaliza a iluminação local (remove sombras e bordas de mesa),
 * retornando um Blob PNG limpo pronto para o Tesseract.
 */
async function gerarRecorteNormalizadoOcr(
  img: HTMLImageElement,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  escalaMax = 2.4,
  expoente = 3.2,
  divisorRaio = 10
): Promise<Blob | null> {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const sx = Math.floor(w * rx);
  const sy = Math.floor(h * ry);
  const sw = Math.floor(w * rw);
  const sh = Math.floor(h * rh);
  if (sw <= 10 || sh <= 10) return null;

  const escala = Math.min(escalaMax, 2100 / Math.max(sw, sh));
  const cw = Math.max(1, Math.round(sw * escala));
  const ch = Math.max(1, Math.round(sh * escala));

  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);

  const raw = ctx.getImageData(0, 0, cw, ch);
  const norm = normalizarIluminacaoSuave(raw, expoente, divisorRaio);
  ctx.putImageData(norm, 0, 0);

  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png');
  });
}

/**
 * Extrai e valida matematicamente (Mod-11 CNPJ + Mod-11 SEFAZ) uma chave de 44 dígitos a partir de texto OCR numérico.
 */
function extrairChave44DeTextoNumerico(textoDigitos: string): DadosQrCodeFiscal | null {
  const linhas = textoDigitos.split(/\r?\n/);

  // Tenta linha por linha e pares de linhas consecutivas (para chaves quebradas em 2 linhas)
  const blocosParaTestar: string[] = [...linhas];
  for (let i = 0; i < linhas.length - 1; i++) {
    blocosParaTestar.push(linhas[i] + ' ' + linhas[i + 1]);
  }

  for (const bloco of blocosParaTestar) {
    const digitos = bloco.replace(/\D/g, '');
    if (digitos.length < 44) continue;

    // Desliza janela de 44 dígitos procurando início com UF válida (ex: 35 em SP, ou 11..53)
    for (let start = 0; start <= digitos.length - 44; start++) {
      const sub = digitos.slice(start, start + 44);
      const uf = Number(sub.slice(0, 2));
      if (uf < 11 || uf > 53) continue;

      const reparada = validarOuRepararChave44(sub);
      if (reparada) {
        const decodificada = decodificarQrCodeFiscal(reparada);
        if (decodificada) return decodificada;
      }
    }
  }
  return null;
}

export function parseTextoOcrFiscal(texto: string, anoMesQr?: string) {
  const limpo = texto.replace(/\r/g, '\n');

  // 1. Chave de acesso de 44 dígitos (com validação/reparo Mod-11!)
  let chave44: string | null = null;
  const dadosViaChaveTexto = extrairChave44DeTextoNumerico(limpo);
  if (dadosViaChaveTexto) {
    chave44 = dadosViaChaveTexto.chaveAcesso;
  }

  // 2. Datas DD/MM/YYYY cruzadas com o anoMes do QR Code / Chave
  let dataIso: string | null = null;
  const matchAutorizacao = limpo.match(
    /au[tl1i]oriza[cçl][aã][o0][^\d\n]{0,30}(\d{2})[\/.-](\d{2})[\/.-](20\d{2})/i
  );
  if (matchAutorizacao) {
    const candAut = `${matchAutorizacao[3]}-${matchAutorizacao[2]}-${matchAutorizacao[1]}`;
    if (!anoMesQr || candAut.startsWith(anoMesQr)) {
      dataIso = candAut;
    }
  }

  const todasDatas: string[] = [];
  const regexData = /(\d{2})[\/.-](\d{2})[\/.-](20\d{2})/g;
  let mData: RegExpExecArray | null;
  while ((mData = regexData.exec(limpo)) !== null) {
    const dd = Number(mData[1]);
    const mm = Number(mData[2]);
    const yyyy = Number(mData[3]);
    if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 2020 && yyyy <= 2035) {
      todasDatas.push(`${mData[3]}-${mData[2]}-${mData[1]}`);
    }
  }

  if (!dataIso && anoMesQr && todasDatas.length > 0) {
    const compativeis = todasDatas.filter((d) => d.startsWith(anoMesQr));
    if (compativeis.length > 0) {
      dataIso = compativeis[compativeis.length - 1];
    } else {
      const mesQr = anoMesQr.slice(5, 7);
      const mesmosMeses = todasDatas.filter((d) => d.slice(5, 7) === mesQr);
      if (mesmosMeses.length > 0) {
        dataIso = `${anoMesQr}-${mesmosMeses[mesmosMeses.length - 1].slice(8, 10)}`;
      }
    }
  }
  if (!dataIso && todasDatas.length > 0) {
    const recentes = todasDatas.filter((d) => Number(d.slice(0, 4)) >= 2024);
    dataIso = recentes.length > 0 ? recentes[recentes.length - 1] : todasDatas[todasDatas.length - 1];
  }

  // 3. Valor Monetário (suporta acentos de OCR como "Valor a Págár", descontos de estudante e linha DINHEIRO/PIX/DÉBITO)
  let valorExtraido: number | null = null;
  const regexPrioritarios = [
    /val[o0u]r\s*a\s*p[aáàãâ]g[aáàãâ]r[^\d\n]{0,90}(\d{1,5}[.,:]\d{2})/i,
    /(?:dinheiro|pix|d[eé]b[il1]to|cr[eé]d[il1]to|cart[aã]o)[^\d\n]{0,90}(\d{1,5}[.,:]\d{2})/i,
    /val[o0u]r\s*p[aáàãâ]go[^\d\n]{0,90}(\d{1,5}[.,:]\d{2})/i,
    /val[o0u]r\s*[t1i\[][o0e][t1i][aá]l[^\d\n]{0,90}(\d{1,5}[.,:]\d{2})/i,
    /tar[il1]fa[^\d\n]{0,90}(\d{1,5}[.,:]\d{2})/i,
    /total\s*(?:r\$)?[^\d\n]{0,60}(\d{1,5}[.,:]\d{2})/i,
  ];

  for (const rx of regexPrioritarios) {
    const m = limpo.match(rx);
    if (m && m[1]) {
      const val = parseValorMonetario(m[1]);
      if (val !== null && val > 0) {
        valorExtraido = val;
        break;
      }
    }
  }

  // 4. Número do documento (BP-e, HPE, NF-e, Bilhete)
  let numeroDoc: string | null = null;
  const matchBpe = limpo.match(/[bh8]p-?e\s*(?:n[º°o'?]?|:)?\s*(\d{3,10})/i);
  const matchNfe = limpo.match(/nf-?e?\s*(?:n[º°o'?]?|:)?\s*(\d{1,10})/i);
  const matchBilhete = limpo.match(/n[º°o'?]?\s*bilhete\s*:?\s*(\d{3,10})/i);
  if (matchBpe) numeroDoc = `BP-e ${matchBpe[1]}`;
  else if (matchNfe) numeroDoc = `NF-e ${matchNfe[1]}`;
  else if (matchBilhete) numeroDoc = `Bilhete ${matchBilhete[1]}`;

  // 5. CNPJ formatado
  let cnpj: string | null = null;
  const matchCnpj = limpo.match(/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/);
  if (matchCnpj) cnpj = matchCnpj[1];

  return { chave44, dataIso, valorExtraido, numeroDoc, cnpj };
}

/**
 * Motor local 100% real e gratuito:
 * 1) Lê o QR Code Fiscal (zxing-wasm C++ + BarcodeDetector + jsQR)
 * 2) Recorta margens da mesa e aplica Normalização Suave de Iluminação Local para ler Valores e Datas reais no Tesseract
 * 3) Se o QR Code estiver amassado/dobrado, faz leitura numérica dedicada na faixa da Chave de 44 dígitos com reparo matemático Mod-11 duplo (CNPJ + SEFAZ)!
 * 4) Consulta automaticamente a Razão Social oficial na Receita Federal (BrasilAPI)
 */
export async function extrairDadosLocaisReais(
  file: File,
  tipoEsperado: 'NF' | 'CUPOM_FISCAL' = 'NF'
): Promise<DocumentoExtraidoGemini> {
  let dadosChave: DadosQrCodeFiscal | null = file.type.startsWith('image/')
    ? await lerQrCodeDeArquivoImagem(file)
    : null;

  let ocrValor: number | null = null;
  let ocrData: string | null = null;
  let ocrNumero: string | null = null;
  let ocrCnpj: string | null = null;

  if (file.type.startsWith('image/')) {
    try {
      const img = await carregarImagemDeFile(file);
      const worker = await createWorker('por');

      // Passo 2A: Se o QR Code estava dobrado/amassado e não leu, extrai a Chave de 44 dígitos por OCR somente-dígitos ('eng') + Mod-11!
      if (!dadosChave) {
        const workerEng = await createWorker('eng');
        await workerEng.setParameters({ tessedit_char_whitelist: '0123456789 /:-' });

        for (const recChave of [
          [0.14, 0.58, 0.74, 0.16],
          [0.10, 0.48, 0.80, 0.30],
        ]) {
          const blobFaixaChave = await gerarRecorteNormalizadoOcr(
            img,
            recChave[0],
            recChave[1],
            recChave[2],
            recChave[3],
            3.0,
            3.8,
            28
          );
          if (blobFaixaChave) {
            const { data: dataDigitos } = await workerEng.recognize(blobFaixaChave);
            const encontrada = extrairChave44DeTextoNumerico(dataDigitos.text || '');
            const parsedDigitos = parseTextoOcrFiscal(dataDigitos.text || '', encontrada?.anoMes);
            if (parsedDigitos.dataIso && !ocrData) ocrData = parsedDigitos.dataIso;
            if (!ocrNumero) {
              const mNum = (dataDigitos.text || '').match(/\b(\d{6,9})\s+00\d\s+\d{2}\/\d{2}\/20\d{2}/);
              if (mNum) ocrNumero = `BP-e ${mNum[1]}`;
            }
            if (encontrada) {
              dadosChave = encontrada;
              break;
            }
          }
        }
        await workerEng.terminate();
      }

      // Passo 2B: OCR em Português com iluminação normalizada e sem as bordas da mesa (x: 12%..88%)
      const blobCentroNorm = await gerarRecorteNormalizadoOcr(img, 0.11, 0.08, 0.78, 0.84, 2.4, 3.2);
      if (blobCentroNorm) {
        const { data: dataNorm } = await worker.recognize(blobCentroNorm);
        const parsedNorm = parseTextoOcrFiscal(dataNorm.text || '', dadosChave?.anoMes);
        if (!dadosChave && parsedNorm.chave44) {
          dadosChave = decodificarQrCodeFiscal(parsedNorm.chave44);
        }
        ocrValor = parsedNorm.valorExtraido ?? ocrValor;
        ocrData = ocrData || parsedNorm.dataIso;
        ocrNumero = parsedNorm.numeroDoc || ocrNumero;
        ocrCnpj = parsedNorm.cnpj || ocrCnpj;
      }

      // Passo 2C: Se ainda faltar valor ou data, tenta na imagem original inteira
      if (!ocrValor || !ocrData) {
        const { data: dataOrig } = await worker.recognize(file);
        const parsedOrig = parseTextoOcrFiscal(dataOrig.text || '', dadosChave?.anoMes);
        if (!dadosChave && parsedOrig.chave44) {
          dadosChave = decodificarQrCodeFiscal(parsedOrig.chave44);
        }
        ocrValor = ocrValor ?? parsedOrig.valorExtraido;
        ocrData = ocrData || parsedOrig.dataIso;
        ocrNumero = ocrNumero || parsedOrig.numeroDoc;
        ocrCnpj = ocrCnpj || parsedOrig.cnpj;
      }

      await worker.terminate();
    } catch (err) {
      console.warn('OCR local indisponível para este arquivo:', err);
    }
  }

  const chaveFinal = dadosChave?.chaveAcesso || null;
  const cnpjFinal = dadosChave?.cnpjEmissor || ocrCnpj || '';
  const numeroFinal = dadosChave?.numeroDocumento || ocrNumero || '';
  const dataFinal =
    ocrData ||
    dadosChave?.dataEmissao ||
    (dadosChave?.anoMes ? `${dadosChave.anoMes}-01` : '');
  const valorFinal = dadosChave?.valorTotal ?? ocrValor ?? 0;

  const tipoFinal: DocumentoExtraidoGemini['tipo_documento'] =
    dadosChave?.modelo === 'BP-e'
      ? 'BPE'
      : dadosChave?.modelo === 'SAT-CF-e' || dadosChave?.modelo === 'NFC-e' || tipoEsperado === 'CUPOM_FISCAL'
      ? 'CUPOM_FISCAL'
      : 'NF';

  const camposEncontrados = [cnpjFinal, numeroFinal, dataFinal, valorFinal > 0 ? 'ok' : ''].filter(Boolean).length;
  const confianca: DocumentoExtraidoGemini['confianca_leitura'] =
    dadosChave && valorFinal > 0 && dataFinal
      ? 'ALTA'
      : camposEncontrados >= 3
      ? 'ALTA'
      : camposEncontrados >= 2
      ? 'MEDIA'
      : 'BAIXA';

  let empresaFinal = '';
  if (cnpjFinal) {
    empresaFinal = await consultarRazaoSocialPorCnpj(cnpjFinal);
  }

  return {
    tipo_documento: tipoFinal,
    empresa_emissora: empresaFinal,
    cnpj_emissor: cnpjFinal,
    numero_documento: numeroFinal,
    chave_acesso_44_digitos: chaveFinal,
    qr_code_url: dadosChave?.urlVerificacao || null,
    data_emissao: dataFinal,
    valor_total: valorFinal,
    confianca_leitura: confianca,
    origem_leitura: 'OCR_LOCAL_REAL',
  };
}
