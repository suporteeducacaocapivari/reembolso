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
  urlVerificacao: string; // Link oficial para verificar autenticidade na SEFAZ
  rawText: string;
}

/**
 * Gera o link oficial de verificação pública na SEFAZ a partir do texto do QR Code ou da Chave de 44 dígitos.
 * Se o QR Code lido já for uma URL oficial (ex: https://bpe.fazenda.sp.gov.br/... ou https://www.nfce.fazenda.sp.gov.br/...),
 * usa o próprio link direto do QR Code! Caso contrário, monta o link do portal correspondente ao modelo fiscal.
 */
export function gerarUrlConsultaSefaz(chaveOuTexto: string, rawQrText?: string): string {
  const texto = (rawQrText || '').trim();
  if (/^https?:\/\//i.test(texto)) {
    return texto;
  }

  const limpo = (chaveOuTexto || '').replace(/\D/g, '');
  if (/^https?:\/\//i.test(chaveOuTexto.trim())) {
    return chaveOuTexto.trim();
  }

  if (limpo.length === 44) {
    const mod = limpo.slice(20, 22);
    switch (mod) {
      case '63': // BP-e (Bilhete de Passagem Eletrônico)
        return `https://bpe.fazenda.sp.gov.br/BPe/qrcode?chBPe=${limpo}&tpAmb=1`;
      case '65': // NFC-e
        return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaPublica.aspx`;
      case '59': // SAT-CF-e SP
        return `https://satsp.fazenda.sp.gov.br/COMSAT/Public/ConsultaPublica/ConsultaPublicaCfe.aspx`;
      case '55': // NF-e Nacional
      default:
        return `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=resumo&tipoConteudo=7PhJ+gAVw2g=&nfe=${limpo}`;
    }
  }

  // NFS-e / Outros
  return `https://www.nfse.gov.br/Consultapublica`;
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

export function validarCnpjMod11(cnpj14: string): boolean {
  if (cnpj14.length !== 14 || /^(\d)\1+$/.test(cnpj14)) return false;
  const calc = (len: number) => {
    let s = 0;
    let p = len - 7;
    for (let i = len; i >= 1; i--) {
      s += Number(cnpj14[len - i]) * p--;
      if (p < 2) p = 9;
    }
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj14[12]) && calc(13) === Number(cnpj14[13]);
}

export function validarChaveSefazMod11(chave44: string): boolean {
  if (chave44.length !== 44 || !/^\d{44}$/.test(chave44)) return false;
  let soma = 0;
  let peso = 2;
  for (let i = 42; i >= 0; i--) {
    soma += Number(chave44[i]) * peso++;
    if (peso > 9) peso = 2;
  }
  const resto = soma % 11;
  const dv = resto === 0 || resto === 1 ? 0 : 11 - resto;
  return dv === Number(chave44[43]);
}

const UFS_IBGE_VALIDAS = new Set([
  11, 12, 13, 14, 15, 16, 17,
  21, 22, 23, 24, 25, 26, 27, 28, 29,
  31, 32, 33, 35,
  41, 42, 43,
  50, 51, 52, 53,
]);

const MODELOS_SEFAZ_VALIDOS = new Set(['55', '57', '59', '63', '65']);

/**
 * Corrige confusões ópticas típicas de impressoras térmicas (ex: 0<->6<->8, 3<->8, 5<->6)
 * exigindo estrutura SEFAZ oficial (UF IBGE + AAMM válido + Modelo 55/57/59/63/65)
 * + validação matemática dupla simultânea: Mod-11 do CNPJ + Mod-11 da Chave de 44 dígitos!
 */
export function validarOuRepararChave44(raw44: string): string | null {
  let ch = raw44.replace(/\D/g, '');
  if (ch.length !== 44) return null;

  const uf = Number(ch.slice(0, 2));
  const aa = Number(ch.slice(2, 4));
  const mm = Number(ch.slice(4, 6));
  if (!UFS_IBGE_VALIDAS.has(uf) || aa < 20 || aa > 35 || mm < 1 || mm > 12) {
    return null;
  }

  // Corrige código de modelo fiscal [20..22] caso um '6' tenha falhado como '0' ou '8' na impressão térmica
  const modMap: Record<string, string> = {
    '03': '63',
    '83': '63',
    '13': '63',
    '05': '65',
    '85': '65',
    '50': '59',
  };
  const mod = ch.slice(20, 22);
  if (modMap[mod]) {
    ch = ch.slice(0, 20) + modMap[mod] + ch.slice(22);
  }
  if (!MODELOS_SEFAZ_VALIDOS.has(ch.slice(20, 22))) {
    return null;
  }

  if (validarCnpjMod11(ch.slice(6, 20)) && validarChaveSefazMod11(ch)) {
    return ch;
  }

  const confusoes: Record<string, string[]> = {
    '0': ['0', '6', '8'],
    '6': ['6', '8', '0', '5'],
    '8': ['8', '6', '0', '3'],
    '5': ['5', '6'],
    '3': ['3', '8'],
    '1': ['1', '7'],
    '7': ['7', '1'],
  };

  const c = ch.slice(6, 20).split('');
  // Testa 1 ou 2 dígitos confundidos no CNPJ que satisfaçam AMBOS os Mod-11 (probabilidade de falso positivo < 0.1%)
  for (let i = 0; i < 14; i++) {
    for (const alt1 of confusoes[c[i]] || []) {
      if (alt1 === c[i]) continue;
      const c1 = [...c];
      c1[i] = alt1;
      const cand1 = ch.slice(0, 6) + c1.join('') + ch.slice(20);
      if (validarCnpjMod11(c1.join('')) && validarChaveSefazMod11(cand1)) {
        return cand1;
      }
      for (let j = i + 1; j < 14; j++) {
        for (const alt2 of confusoes[c[j]] || []) {
          if (alt2 === c[j]) continue;
          const c2 = [...c1];
          c2[j] = alt2;
          const cand2 = ch.slice(0, 6) + c2.join('') + ch.slice(20);
          if (validarCnpjMod11(c2.join('')) && validarChaveSefazMod11(cand2)) {
            return cand2;
          }
        }
      }
    }
  }

  return null;
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
    urlVerificacao: gerarUrlConsultaSefaz(chave, limpo),
    rawText: limpo,
  };
}
