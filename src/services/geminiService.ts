import { GoogleGenAI, Type } from '@google/genai';
import type { DocumentoExtraidoGemini } from '../types';

export const getGeminiApiKey = (): string => {
  return localStorage.getItem('GEMINI_API_KEY') || import.meta.env.VITE_GEMINI_API_KEY || '';
};

export const setGeminiApiKey = (key: string) => {
  if (key) {
    localStorage.setItem('GEMINI_API_KEY', key.trim());
  } else {
    localStorage.removeItem('GEMINI_API_KEY');
  }
};

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analisa Nota Fiscal (NF-e / NFS-e), Cupom Fiscal (SAT / NFC-e) ou Bilhete de Passagem Eletrônico (BP-e)
 * com Google Gemini 2.5 Flash.
 */
export async function analisarDocumentoTransporte(
  file: File,
  tipoEsperado: 'NF' | 'CUPOM_FISCAL' = 'NF'
): Promise<DocumentoExtraidoGemini> {
  const apiKey = getGeminiApiKey();

  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const base64Data = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const prompt = `Você é um auditor fiscal especializado em documentos de transporte escolar e intermunicipal brasileiro.
Analise cuidadosamente a imagem/PDF anexado. Ele pode ser:
- Uma Nota Fiscal de Transporte Fretado (NF-e / NFS-e);
- Um Cupom Fiscal Eletrônico (SAT / NFC-e);
- Um Bilhete de Passagem Eletrônico (BP-e / DABPE), muito comum em linhas de ônibus intermunicipais (ex: Rio das Pedras -> Capivari).

Extraia EXATAMENTE os dados visíveis no documento, sem inventar nada:
1. tipo_documento: "NF", "CUPOM_FISCAL" ou "BPE"
2. empresa_emissora: Nome/Razão social da empresa de transporte emissora (se visível)
3. cnpj_emissor: CNPJ da empresa emissora (se não estiver legível no topo, extraia os 14 dígitos das posições 7 a 20 da chave de acesso de 44 dígitos e formate como XX.XXX.XXX/XXXX-XX)
4. numero_documento: Número da NF, do Cupom/COO ou do BP-e (ex: "BP-e 25525" ou "NF-e 004812")
5. chave_acesso_44_digitos: Chave de acesso numérica de 44 dígitos (sem espaços) se presente no documento (ex: abaixo do texto "Consulte pela Chave de Acesso" no BP-e/NFC-e), ou null se não houver
6. data_emissao: Data da viagem ou emissão/autorização no formato ISO YYYY-MM-DD (ex: 26/10/2026 -> "2026-10-26")
7. valor_total: Valor total em Reais (número decimal, ex: 9.40 ou 450.00). Use "VALOR TOTAL" ou "VALOR A PAGAR".
8. confianca_leitura: "ALTA", "MEDIA" ou "BAIXA" conforme a nitidez da foto.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tipo_documento: { type: Type.STRING, enum: ['NF', 'CUPOM_FISCAL', 'BPE'] },
              empresa_emissora: { type: Type.STRING, nullable: true },
              cnpj_emissor: { type: Type.STRING },
              numero_documento: { type: Type.STRING },
              chave_acesso_44_digitos: { type: Type.STRING, nullable: true },
              data_emissao: { type: Type.STRING },
              valor_total: { type: Type.NUMBER },
              confianca_leitura: { type: Type.STRING, enum: ['ALTA', 'MEDIA', 'BAIXA'] },
            },
            required: [
              'tipo_documento',
              'cnpj_emissor',
              'numero_documento',
              'data_emissao',
              'valor_total',
              'confianca_leitura',
            ],
          },
        },
      });

      const text = response.text;
      if (text) {
        const parsed = JSON.parse(text) as DocumentoExtraidoGemini;
        return {
          ...parsed,
          origem_leitura: 'GEMINI_REAL',
        };
      }
    } catch (err) {
      console.error('Erro ao chamar API Gemini:', err);
      throw new Error('Falha na comunicação com o Google Gemini. Verifique se a sua API Key é válida.');
    }
  }

  // --- Fallback Simulado (Somente quando NÃO há API Key configurada) ---
  await new Promise((resolve) => setTimeout(resolve, 900));

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const dataHoje = new Date().toISOString().split('T')[0];

  if (tipoEsperado === 'CUPOM_FISCAL') {
    const chave44 = `352611${Math.floor(10000000000000 + Math.random() * 90000000000000)}${Math.floor(100000000000000000000000 + Math.random() * 900000000000000000000000)}`.slice(0, 44);
    const valorAleatorio = [6.8, 7.5, 8.2, 9.4, 14.5][Math.floor(Math.random() * 5)];
    return {
      tipo_documento: 'CUPOM_FISCAL',
      empresa_emissora: 'Viação Capivari (Simulado)',
      cnpj_emissor: '07.123.456/0001-89',
      numero_documento: `CF-${randomNum}`,
      chave_acesso_44_digitos: chave44,
      data_emissao: dataHoje,
      valor_total: valorAleatorio,
      confianca_leitura: 'MEDIA',
      origem_leitura: 'SIMULADO_SEM_CHAVE',
    };
  }

  const valorFretado = [380.0, 420.0, 550.0, 680.0, 720.0][Math.floor(Math.random() * 5)];
  return {
    tipo_documento: 'NF',
    empresa_emissora: 'TransCapivari Fretamento Ltda (Simulado)',
    cnpj_emissor: '18.942.331/0001-44',
    numero_documento: `NF-e ${randomNum}`,
    chave_acesso_44_digitos: null,
    data_emissao: dataHoje,
    valor_total: valorFretado,
    confianca_leitura: 'MEDIA',
    origem_leitura: 'SIMULADO_SEM_CHAVE',
  };
}
