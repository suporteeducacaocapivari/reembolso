/**
 * Decodificador gratuito e offline de QR Code Fiscal Brasileiro
 * Suporta:
 * - SAT-CF-e (SP): chave44|YYYYMMDDHHMMSS|valor|cpf|assinatura
 * - BP-e (Bilhete de Passagem Eletrônico - modelo 63): URL com chBPe=chave44
 * - NFC-e (modelo 65) / NF-e (modelo 55): URL com p=chave44|... ou chNFe=chave44
 * - Chave de acesso pura de 44 dígitos
 */

export interface DadosQrCodeFiscal {
  chaveAcesso: string;
  modelo: 'NF-e' | 'NFC-e' | 'SAT-CF-e' | 'BP-e' | 'DOC';
  cnpjEmissor: string;
  numeroDocumento: string;
  serie: string;
  anoMes: string; // YYYY-MM
  dataEmissao?: string; // YYYY-MM-DD (quando presente no SAT ou URL)
  valorTotal?: number; // quando presente no SAT ou URL vNF=
  rawText: string;
}

function formatarCnpj(cnpj14: string): string {
  const d = cnpj14.replace(/\D/g, '').padStart(14, '0');
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function identificarModelo(mod: string): DadosQrCodeFiscal['modelo'] {
  switch (mod) {
    case '55':
      return 'NF-e';
    case '65':
      return 'NFC-e';
    case '59':
      return 'SAT-CF-e';
    case '63':
      return 'BP-e';
    default:
      return 'DOC';
  }
}

export function decodificarQrCodeFiscal(textoQr: string): DadosQrCodeFiscal | null {
  if (!textoQr) return null;
  const limpo = textoQr.trim();

  // 1. Extrai a chave de acesso de 44 dígitos numéricos de qualquer formato (URL, SAT ou puro)
  const matchChave = limpo.match(/\d{44}/);
  if (!matchChave) return null;

  const chave = matchChave[0];

  // Estrutura oficial da Chave de Acesso (44 dígitos - SEFAZ/CONFAZ):
  // [0..2]   cUF (2)
  // [2..6]   AAMM (4)
  // [6..20]  CNPJ (14)
  // [20..22] mod (2) -> 55=NFe, 65=NFCe, 59=SAT, 63=BPe
  // [22..25] serie (3)
  // [25..34] nNF / nBP (9)
  const aa = chave.slice(2, 4);
  const mm = chave.slice(4, 6);
  const cnpjRaw = chave.slice(6, 20);
  const modRaw = chave.slice(20, 22);
  const serieRaw = String(Number(chave.slice(22, 25)));
  const numeroRaw = String(Number(chave.slice(25, 34)));

  const modelo = identificarModelo(modRaw);
  const anoMes = `20${aa}-${mm}`;
  const cnpjEmissor = formatarCnpj(cnpjRaw);
  const numeroDocumento = `${modelo} ${numeroRaw}`;

  let dataEmissao: string | undefined;
  let valorTotal: number | undefined;

  // 2. Caso seja SAT-CF-e (formato: CHAVE44|YYYYMMDDHHMMSS|VALOR|...)
  if (limpo.includes('|')) {
    const partes = limpo.split('|');
    // Parte 1 costuma ser data YYYYMMDDHHMMSS no SAT
    if (partes[1] && /^\d{8,14}$/.test(partes[1])) {
      const dt = partes[1];
      dataEmissao = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    }
    // Parte 2 costuma ser valor decimal no SAT (ex: 12.50)
    if (partes[2] && /^\d+(\.\d{1,2})?$/.test(partes[2])) {
      const val = parseFloat(partes[2]);
      if (!isNaN(val) && val > 0) valorTotal = val;
    }
  }

  // 3. Caso seja URL NFC-e v1 com parâmetro vNF=
  const matchValorUrl = limpo.match(/[?&]vNF=(\d+(?:\.\d{1,2})?)/i);
  if (!valorTotal && matchValorUrl) {
    const val = parseFloat(matchValorUrl[1]);
    if (!isNaN(val) && val > 0) valorTotal = val;
  }

  return {
    chaveAcesso: chave,
    modelo,
    cnpjEmissor,
    numeroDocumento,
    serie: serieRaw,
    anoMes,
    dataEmissao,
    valorTotal,
    rawText: limpo,
  };
}
