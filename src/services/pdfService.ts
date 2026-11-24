import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import type { AlunoCadastro, ProtocoloMensal } from '../types';

dayjs.locale('pt-br');

const MESES_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function formatCurrency(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0,00';
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function downloadBlob(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/**
 * Gera o Requerimento Oficial (Anexo I para 75% ou Anexo II + III para 100%)
 * preenchendo diretamente sobre o PDF original da Prefeitura de Capivari.
 */
export async function gerarPdfRequerimento(aluno: AlunoCadastro): Promise<void> {
  const is100 = aluno.faixaReembolso === '100%';
  const templateUrl = is100
    ? '/templates/requerimento-100-anexo-ii-iii.pdf'
    : '/templates/requerimento-75-anexo-i.pdf';

  const existingPdfBytes = await fetch(templateUrl).then((res) => {
    if (!res.ok) throw new Error(`Não foi possível carregar o modelo: ${templateUrl}`);
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textColor = rgb(0.08, 0.1, 0.12);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];
  const { height: h1 } = page1.getSize();

  const drawText = (
    page: typeof page1,
    text: string | undefined,
    x: number,
    yFromTop: number,
    size = 10,
    bold = false
  ) => {
    if (!text) return;
    const { height } = page.getSize();
    page.drawText(String(text), {
      x,
      y: height - yFromTop,
      size,
      font: bold ? fontBold : font,
      color: textColor,
    });
  };

  // ================= PÁGINA 1: ANEXO I (75%) ou ANEXO II (100%) =================
  // Checkbox Cadastro / Recadastro
  if (aluno.tipoSolicitacao === 'CADASTRO') {
    drawText(page1, 'X', 74, 84, 11, true);
  } else {
    drawText(page1, 'X', 74, 102, 11, true);
  }

  // Eu, [NOME]
  drawText(page1, aluno.nome, 100, 211, 10.5, true);
  // RG nº [RG], CPF nº [CPF]
  drawText(page1, aluno.rg, 100, 232, 10);
  drawText(page1, aluno.cpf, 305, 232, 10);
  // residente em Capivari/SP, na [ENDEREÇO] nº [NUMERO]
  drawText(page1, aluno.endereco, 168, 253, 10);
  drawText(page1, aluno.numero, 492, 253, 10);
  // Bairro [BAIRRO]
  drawText(page1, aluno.bairro, 100, 274, 10);
  // curso de [CURSO]
  drawText(page1, aluno.curso, 100, 295, 10);
  // na Instituição de Ensino [INSTITUICAO]
  drawText(page1, aluno.instituicao, 85, 316, 10);
  // na cidade de [CIDADE]
  drawText(page1, aluno.cidadeInstituicao, 100, 338, 10);

  // Banco do Brasil, Ag [AGENCIA], conta nº [CONTA]
  const yBanco = is100 ? 396 : 408;
  drawText(page1, aluno.agencia, 355, yBanco, 10);
  drawText(page1, aluno.conta, 128, yBanco + 19, 10);

  // Data: Capivari, [DIA] de [MÊS] de [ANO]
  const agora = dayjs();
  const dia = agora.format('DD');
  const mesNome = MESES_PT[agora.month()];
  const ano = agora.format('YYYY');

  const yData = is100 ? 635 : 624;
  drawText(page1, dia, 128, yData, 10);
  drawText(page1, mesNome, 185, yData, 10);
  drawText(page1, ano, 305, yData, 10);

  // Telefone / Celular e Email
  const yTel = is100 ? 696 : 684;
  drawText(page1, aluno.telefone, 165, yTel, 10);
  drawText(page1, aluno.email, 165, yTel + 15, 10);

  // ================= PÁGINA 2: TERMO DE CIÊNCIA =================
  if (pages.length >= 2) {
    const page2 = pages[1];
    const dataFormatada = agora.format('DD/MM/YYYY');
    // Campo Data no final do Termo de Ciência
    drawText(page2, dataFormatada, 442, 725, 10);
  }

  // ================= PÁGINA 3: ANEXO III (DECLARAÇÃO MEMBROS E RENDA - SOMENTE 100%) =================
  if (is100 && pages.length >= 3) {
    const page3 = pages[2];
    // Eu, [NOME]
    drawText(page3, aluno.nome, 86, 150, 10, true);
    // RG [RG]
    drawText(page3, aluno.rg, 86, 164, 10);
    // curso de [CURSO], na cidade de [CIDADE] /SP
    drawText(page3, aluno.curso, 75, 178, 10);
    drawText(page3, aluno.cidadeInstituicao, 345, 178, 10);

    // Tabela de Membros da Família (até 16 linhas disponíveis no modelo)
    const membros = aluno.membrosFamilia || [];
    const startY = 247;
    const rowHeight = 14.3;

    membros.slice(0, 16).forEach((m, index) => {
      const y = startY + index * rowHeight;
      drawText(page3, m.nomeCompleto, 68, y, 8.5);
      drawText(page3, m.dataNasc, 206, y, 8.5);
      drawText(page3, m.parentesco, 260, y, 8.5);
      drawText(page3, m.profissao, 348, y, 8.5);
      drawText(page3, `R$ ${formatCurrency(m.renda)}`, 440, y, 8.5);
    });

    // Checkbox Declaro, sob as penas da Lei
    drawText(page3, 'X', 72, 507, 10, true);

    // Capivari, [DIA] de [MÊS] de [ANO]
    drawText(page3, dia, 122, 577, 10);
    drawText(page3, mesNome, 180, 577, 10);
    drawText(page3, ano, 300, 577, 10);

    // RG e CPF abaixo da data
    drawText(page3, aluno.rg, 95, 628, 10);
    drawText(page3, aluno.cpf, 95, 654, 10);
  }

  const pdfBytes = await pdfDoc.save();
  const sufixo = is100 ? 'Anexo_II_III_100porcento' : 'Anexo_I_75porcento';
  const nomeLimpo = aluno.nome.replace(/[^a-zA-Z0-9]/g, '_');
  downloadBlob(pdfBytes, `Requerimento_${sufixo}_${nomeLimpo}.pdf`);
}

/**
 * Gera o Anexo IV (Protocolo da Nota Fiscal de Transporte Mensal + Recibo)
 * preenchendo diretamente sobre o PDF original da Prefeitura de Capivari.
 */
export async function gerarPdfAnexoIV(
  protocolo: ProtocoloMensal,
  aluno?: AlunoCadastro
): Promise<void> {
  const existingPdfBytes = await fetch('/templates/anexo-iv-protocolo.pdf').then((res) => {
    if (!res.ok) throw new Error('Não foi possível carregar o modelo Anexo IV.');
    return res.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const textColor = rgb(0.08, 0.1, 0.12);

  const page = pdfDoc.getPages()[0];
  const { height } = page.getSize();

  const drawText = (text: string | undefined, x: number, yFromTop: number, size = 10, bold = false) => {
    if (!text) return;
    page.drawText(String(text), {
      x,
      y: height - yFromTop,
      size,
      font: bold ? fontBold : font,
      color: textColor,
    });
  };

  const nome = protocolo.alunoNome || aluno?.nome || '';
  const rg = protocolo.alunoRg || aluno?.rg || '';
  const cpf = protocolo.alunoCpf || aluno?.cpf || '';
  const curso = protocolo.alunoCurso || aluno?.curso || '';
  const instituicao = protocolo.alunoInstituicao || aluno?.instituicao || '';
  const cidade = protocolo.alunoCidadeInstituicao || aluno?.cidadeInstituicao || '';
  const empresa =
    protocolo.empresaTransporte ||
    (protocolo.tipoTransporte === 'FRETADO' ? 'Empresa de Transporte Fretado' : 'Linha Circular / Regular');
  const numNf =
    protocolo.nfNumero ||
    (protocolo.cupons ? `Lote (${protocolo.cupons.length} cupons)` : '');

  const [anoRef, mesRefNum] = (protocolo.mesReferencia || '2026-11').split('-');
  const mesRefNome = MESES_PT[Math.max(0, Number(mesRefNum) - 1)] || mesRefNum;

  const valTotal = formatCurrency(protocolo.valorTotalComprovado);
  const valIndividual = formatCurrency(protocolo.valorIndividualNf ?? protocolo.valorTotalComprovado);
  const dataEnvio = dayjs(protocolo.dataEnvio);

  // ================= PARTE SUPERIOR: ANEXO IV =================
  // Caixa Protocolo (topo direito)
  drawText(protocolo.codigoHash, 434, 52, 9.5, true);
  drawText(dataEnvio.format('DD/MM/YYYY HH:mm'), 434, 67, 8.5);

  // Eu, [NOME COMPLETO]
  drawText(nome, 62, 160, 10.5, true);
  // RG nº [RG], CPF nº [CPF]
  drawText(rg, 78, 198, 10);
  drawText(cpf, 282, 198, 10);
  // curso de [CURSO]
  drawText(curso, 265, 223, 10);
  // Instituição de Ensino [INSTITUICAO]
  drawText(instituicao, 182, 248, 10);
  // na cidade de [CIDADE]
  drawText(cidade, 45, 273, 10);

  // Empresa de transporte: [EMPRESA]
  drawText(empresa, 178, 335, 10);
  // N° da NF: [NF]   Ref. Mês: [MES] / [ANO]
  drawText(numNf, 98, 370, 10);
  drawText(mesRefNome, 278, 370, 10);
  drawText(anoRef, 425, 370, 10);
  // Valor TOTAL NF R$: [TOTAL]   Valor INDIVIDUAL NF R$: [INDIVIDUAL]
  drawText(valTotal, 155, 405, 10, true);
  drawText(valIndividual, 438, 405, 10, true);

  // Data: [DD] / [MM] / [AAAA]
  drawText(dataEnvio.format('DD'), 80, 440, 10);
  drawText(dataEnvio.format('MM'), 130, 440, 10);
  drawText(dataEnvio.format('YYYY'), 180, 440, 10);

  // ================= PARTE INFERIOR: RECIBO PROTOCOLO =================
  // Estudante: [NOME]
  drawText(nome, 108, 567, 10, true);
  // Empresa de Transporte: [EMPRESA]
  drawText(empresa, 180, 603, 10);
  // N° da NF: [NF]   Ref. Mês: [MES] / [ANO]
  drawText(numNf, 98, 639, 10);
  drawText(mesRefNome, 318, 639, 10);
  drawText(anoRef, 465, 639, 10);
  // Valor TOTAL NF R$: [TOTAL]
  drawText(valTotal, 158, 675, 10, true);
  // Valor INDIVIDUAL NF R$: [INDIVIDUAL]
  drawText(valIndividual, 188, 710, 10, true);

  // Caixa Protocolo (inferior direito)
  drawText(protocolo.codigoHash, 402, 705, 9.5, true);
  drawText(dataEnvio.format('DD/MM/YYYY HH:mm'), 402, 720, 8.5);

  const pdfBytes = await pdfDoc.save();
  downloadBlob(pdfBytes, `Anexo_IV_Protocolo_${protocolo.codigoHash}.pdf`);
}
