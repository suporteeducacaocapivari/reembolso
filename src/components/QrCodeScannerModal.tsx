import React, { useEffect, useRef, useState } from 'react';
import { Modal, Tabs, Upload, Button, Alert, Typography, InputNumber, Space, Tag, message } from 'antd';
import { CameraOutlined, PictureOutlined, CheckCircleOutlined, QrcodeOutlined } from '@ant-design/icons';
import { Html5Qrcode } from 'html5-qrcode';
import { decodificarQrCodeFiscal, type DadosQrCodeFiscal } from '../services/qrFiscalParser';
import { lerQrCodeDeArquivoImagem, extrairDadosLocaisReais } from '../services/localOcrService';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  onDecoded: (dados: DadosQrCodeFiscal) => void;
  /** Se true, exige que o valor seja informado caso o QR Code (ex: BP-e / NFC-e v2) não traga o valor */
  exigirValor?: boolean;
}

const READER_ELEMENT_ID = 'semec-qr-reader-region';

export const QrCodeScannerModal: React.FC<Props> = ({ open, onClose, onDecoded, exigirValor = true }) => {
  const [abaAtiva, setAbaAtiva] = useState<'camera' | 'imagem'>('camera');
  const [cameraErro, setCameraErro] = useState<string | null>(null);
  const [cameraAtiva, setCameraAtiva] = useState(false);
  const [dadosLidos, setDadosLidos] = useState<DadosQrCodeFiscal | null>(null);
  const [valorInformado, setValorInformado] = useState<number | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const pararCamera = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch {
        // ignora erro ao limpar instância já parada
      }
      scannerRef.current = null;
    }
    setCameraAtiva(false);
  };

  const iniciarCamera = async () => {
    setCameraErro(null);
    await pararCamera();

    // Pequeno atraso para garantir que o DOM do Modal montou o elemento
    setTimeout(async () => {
      const el = document.getElementById(READER_ELEMENT_ID);
      if (!el) return;

      try {
        const html5QrCode = new Html5Qrcode(READER_ELEMENT_ID);
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            const parsed = decodificarQrCodeFiscal(decodedText);
            if (parsed) {
              void pararCamera();
              setDadosLidos(parsed);
              setValorInformado(parsed.valorTotal ?? null);
              message.success(`QR Code ${parsed.modelo} lido com sucesso!`);
            } else {
              message.warning('QR Code lido, mas não contém uma chave fiscal de 44 dígitos.');
            }
          },
          () => {
            // frame sem QR Code — comportamento normal
          }
        );
        setCameraAtiva(true);
      } catch (err: any) {
        setCameraErro(
          'Não foi possível acessar a câmera (verifique a permissão do navegador ou use a aba "Ler de uma Foto").'
        );
      }
    }, 200);
  };

  useEffect(() => {
    if (open && abaAtiva === 'camera' && !dadosLidos) {
      void iniciarCamera();
    } else {
      void pararCamera();
    }
    return () => {
      void pararCamera();
    };
  }, [open, abaAtiva, dadosLidos]);

  const handleLerImagem = async (file: File) => {
    await pararCamera();
    message.loading({ content: 'Lendo QR Code e dados fiscais da imagem...', key: 'qr-img-msg' });

    try {
      const parsed = await lerQrCodeDeArquivoImagem(file);
      if (!parsed) {
        message.error({
          content: 'Não foi possível localizar um QR Code fiscal nítido nesta imagem.',
          key: 'qr-img-msg',
        });
        return false;
      }

      let valorAuto = parsed.valorTotal ?? null;
      let dataAuto = parsed.dataEmissao;

      // Se o QR Code for BP-e / NFC-e v2 (sem valor embutido), complementa com OCR local gratuito
      if (!valorAuto || !dataAuto) {
        const extraOcr = await extrairDadosLocaisReais(file, 'CUPOM_FISCAL');
        if (!valorAuto && extraOcr.valor_total > 0) {
          valorAuto = extraOcr.valor_total;
        }
        if (!dataAuto && extraOcr.data_emissao) {
          dataAuto = extraOcr.data_emissao;
        }
      }

      setDadosLidos({
        ...parsed,
        dataEmissao: dataAuto || parsed.dataEmissao,
        valorTotal: valorAuto ?? parsed.valorTotal,
      });
      setValorInformado(valorAuto);
      message.success({
        content: `QR Code ${parsed.modelo} (${parsed.numeroDocumento}) extraído com sucesso!`,
        key: 'qr-img-msg',
      });
    } catch {
      message.error({
        content: 'Erro ao processar a imagem enviada.',
        key: 'qr-img-msg',
      });
    }
    return false;
  };

  const handleConfirmar = () => {
    if (!dadosLidos) return;
    if (exigirValor && (!valorInformado || valorInformado <= 0)) {
      message.warning('Informe o valor total do cupom/bilhete em Reais.');
      return;
    }

    onDecoded({
      ...dadosLidos,
      valorTotal: valorInformado ?? dadosLidos.valorTotal,
    });
    handleFechar();
  };

  const handleFechar = () => {
    void pararCamera();
    setDadosLidos(null);
    setValorInformado(null);
    setCameraErro(null);
    onClose();
  };

  return (
    <Modal
      title={
        <Space>
          <QrcodeOutlined style={{ color: '#1B5E3A' }} />
          <span style={{ fontFamily: "'Merriweather', serif", fontWeight: 700 }}>
            Leitor de QR Code Fiscal (NF-e / NFC-e / SAT / BP-e)
          </span>
        </Space>
      }
      open={open}
      onCancel={handleFechar}
      footer={
        dadosLidos ? (
          <Space>
            <Button onClick={() => setDadosLidos(null)}>Ler Outro</Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              style={{ background: '#1B5E3A', borderColor: '#1B5E3A' }}
              onClick={handleConfirmar}
            >
              Usar Dados Lidos
            </Button>
          </Space>
        ) : (
          <Button onClick={handleFechar}>Fechar</Button>
        )
      }
      width={520}
      destroyOnClose
    >
      {dadosLidos ? (
        <div>
          <Alert
            type="success"
            showIcon
            message={`Documento ${dadosLidos.modelo} decodificado gratuitamente (sem API)!`}
            description="Os dados abaixo foram extraídos diretamente da chave de acesso de 44 dígitos do QR Code."
            style={{ marginBottom: 16, borderRadius: 6 }}
          />

          <div
            style={{
              background: '#F9F7F2',
              border: '1px solid #E6E0D4',
              borderRadius: 6,
              padding: 14,
              marginBottom: 16,
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div>
              <Text type="secondary">Tipo / Número:</Text>{' '}
              <strong>{dadosLidos.numeroDocumento}</strong>{' '}
              <Tag color="green">Série {dadosLidos.serie}</Tag>
            </div>
            <div>
              <Text type="secondary">CNPJ Emissor:</Text> <strong>{dadosLidos.cnpjEmissor}</strong>
            </div>
            <div>
              <Text type="secondary">Competência / Emissão:</Text>{' '}
              <strong>{dadosLidos.dataEmissao || dadosLidos.anoMes}</strong>
            </div>
            <div>
              <Text type="secondary">Chave de Acesso (44 dígitos):</Text>
              <div style={{ fontFamily: 'monospace', fontSize: 11, wordBreak: 'break-all', marginTop: 2 }}>
                {dadosLidos.chaveAcesso}
              </div>
            </div>
          </div>

          {exigirValor && (
            <div>
              <Text strong>
                Valor Total do Documento (R$):
                {!dadosLidos.valorTotal && (
                  <Text type="secondary" style={{ fontWeight: 400, fontSize: 12, marginLeft: 6 }}>
                    (o QR Code {dadosLidos.modelo} da SEFAZ-SP não inclui o valor; confirme abaixo)
                  </Text>
                )}
              </Text>
              <InputNumber
                value={valorInformado}
                onChange={(v) => setValorInformado(v)}
                prefix="R$"
                min={0.01}
                step={0.5}
                precision={2}
                size="large"
                style={{ width: '100%', marginTop: 6 }}
                placeholder="Ex: 9,40"
              />
            </div>
          )}
        </div>
      ) : (
        <Tabs
          activeKey={abaAtiva}
          onChange={(k) => setAbaAtiva(k as 'camera' | 'imagem')}
          items={[
            {
              key: 'camera',
              label: (
                <span>
                  <CameraOutlined /> Usar Câmera
                </span>
              ),
              children: (
                <div>
                  {cameraErro ? (
                    <Alert type="warning" showIcon message={cameraErro} style={{ marginBottom: 12 }} />
                  ) : (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 10 }}>
                      Aponte a câmera para o QR Code impresso no cupom fiscal, bilhete BP-e ou nota fiscal.
                    </Text>
                  )}
                  <div
                    id={READER_ELEMENT_ID}
                    style={{
                      width: '100%',
                      minHeight: 260,
                      background: '#111',
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  />
                  {!cameraAtiva && !cameraErro && (
                    <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 8, textAlign: 'center' }}>
                      Iniciando câmera...
                    </Text>
                  )}
                </div>
              ),
            },
            {
              key: 'imagem',
              label: (
                <span>
                  <PictureOutlined /> Ler de uma Foto
                </span>
              ),
              children: (
                <div style={{ padding: '12px 0' }}>
                  <Upload.Dragger
                    beforeUpload={handleLerImagem}
                    showUploadList={false}
                    accept="image/*"
                    style={{ padding: 24, background: '#F9F7F2', borderColor: '#E6E0D4', borderRadius: 6 }}
                  >
                    <p className="ant-upload-drag-icon">
                      <QrcodeOutlined style={{ color: '#1B5E3A', fontSize: 40 }} />
                    </p>
                    <p className="ant-upload-text" style={{ fontWeight: 600 }}>
                      Clique ou arraste a foto do Cupom / BP-e / Nota Fiscal
                    </p>
                    <p className="ant-upload-hint" style={{ fontSize: 12 }}>
                      Leitura 100% local e gratuita — extrai Chave de 44 dígitos, CNPJ, Número e Valor (SAT) direto do QR Code.
                    </p>
                  </Upload.Dragger>
                </div>
              ),
            },
          ]}
        />
      )}
    </Modal>
  );
};
