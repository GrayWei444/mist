/**
 * AddFriendModal - 新增好友彈窗元件
 *
 * 整合 QR Code 掃描、顯示和邀請連結功能
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QRCodeVerification } from './QRCodeVerification';
import { InviteLink } from './InviteLink';
import { mqttService, MessageType, ConnectionState } from '../../services/mqtt';
import { useApp } from '../../providers/AppProvider';
import { useChatStore } from '../../stores/chatStore';
import { toBase64, fromBase64 } from '../../services/crypto';

type TabType = 'scan' | 'myqr' | 'invite';

// QR Code 資料結構
interface QRCodeData {
  v: number;
  pk: string;     // Ed25519 公鑰 (Base64)
  spk: string;    // SignedPreKey 公鑰 (Base64)
  sig: string;    // SignedPreKey 簽名 (Base64)
  name: string;
}

// X3DH 初始化訊息
interface X3DHInitPayload {
  ephemeralPublicKey: string;
  senderName: string;
}

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded?: (publicKey: string, isVerified: boolean) => void;
}

export function AddFriendModal({
  isOpen,
  onClose,
  onFriendAdded,
}: AddFriendModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'scanning' | 'connecting' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'qr-scanner-modal';

  const { publicKey, cryptoReady, createSession } = useApp();
  const { addFriend, userProfile } = useChatStore();

  // 處理掃描到的 QR Code
  const handleQrScanned = useCallback(async (qrText: string) => {
    if (!publicKey) {
      setScanError('身份未初始化');
      setScanStatus('error');
      return;
    }

    try {
      setScanStatus('connecting');
      setStatusMessage('正在解析 QR Code...');

      const peerQr: QRCodeData = JSON.parse(qrText);

      if (!peerQr.pk || !peerQr.spk || !peerQr.sig) {
        throw new Error('無效的 QR Code 格式');
      }

      setStatusMessage(`找到好友: ${peerQr.name}`);

      // 連接 MQTT (如果尚未連接)
      if (mqttService.getState() !== ConnectionState.CONNECTED) {
        setStatusMessage('正在連接伺服器...');
        await mqttService.connect(publicKey);
      }

      setStatusMessage('正在進行金鑰交換...');

      // 執行 X3DH (作為發起者) - 使用 AppProvider 的 createSession
      const peerIdentityPubKey = fromBase64(peerQr.pk);
      const peerSignedPreKeyPub = fromBase64(peerQr.spk);
      const peerSignature = fromBase64(peerQr.sig);

      const { x3dhResult } = createSession(
        peerIdentityPubKey,
        peerSignedPreKeyPub,
        peerSignature
      );

      console.log('[AddFriendModal] Session created with peer:', peerQr.pk.slice(0, 16) + '...');

      // 透過 MQTT 發送 X3DH 初始化訊息
      const initPayload: X3DHInitPayload = {
        ephemeralPublicKey: toBase64(x3dhResult.ephemeralPublicKey),
        senderName: userProfile.displayName || `用戶 ${publicKey.slice(0, 6)}`,
      };
      mqttService.sendToUser(peerQr.pk, MessageType.X3DH_INIT, initPayload);

      // 將對方加入好友列表
      addFriend(peerQr.pk, peerQr.name, 'verified');

      setScanStatus('success');
      setStatusMessage(`已成功添加 ${peerQr.name} 為好友！`);

      // 通知父組件
      onFriendAdded?.(peerQr.pk, true);

      // 2 秒後關閉
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '掃描失敗';
      setScanError(errorMsg);
      setScanStatus('error');
      setStatusMessage(errorMsg);
    }
  }, [publicKey, createSession, addFriend, userProfile, onFriendAdded, onClose]);

  // 開始掃描
  const startScanning = useCallback(async () => {
    setScanError('');
    setScanStatus('scanning');
    setStatusMessage('對準好友的 QR Code');

    try {
      // 確保容器存在
      await new Promise(resolve => setTimeout(resolve, 100));

      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          // 掃描成功，停止掃描並處理
          stopScanning();
          handleQrScanned(decodedText);
        },
        () => {
          // 掃描中
        }
      );

      setIsScanning(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '無法開啟相機';
      setScanError(errorMsg);
      setScanStatus('error');
      setStatusMessage(errorMsg);
    }
  }, [handleQrScanned]);

  // 停止掃描
  const stopScanning = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch {
        // 忽略
      }
    }
    setIsScanning(false);
  }, []);

  // 切換 tab 時停止掃描
  useEffect(() => {
    if (activeTab !== 'scan') {
      stopScanning();
    }
  }, [activeTab, stopScanning]);

  // 關閉時停止掃描
  useEffect(() => {
    if (!isOpen) {
      stopScanning();
      setScanStatus('idle');
      setScanError('');
    }
  }, [isOpen, stopScanning]);

  // 組件卸載時清理
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 彈窗內容 */}
      <div className="relative w-full max-w-md mx-4 bg-dark-card rounded-2xl shadow-2xl overflow-hidden">
        {/* 標題列 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">新增好友</h2>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 標籤切換 */}
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => setActiveTab('scan')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'scan'
                ? 'text-mist-400 border-b-2 border-mist-500 bg-mist-500/5'
                : 'text-dark-400 hover:text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              📷 掃描
            </span>
          </button>
          <button
            onClick={() => setActiveTab('myqr')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'myqr'
                ? 'text-mist-400 border-b-2 border-mist-500 bg-mist-500/5'
                : 'text-dark-400 hover:text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              🔲 我的碼
            </span>
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'invite'
                ? 'text-mist-400 border-b-2 border-mist-500 bg-mist-500/5'
                : 'text-dark-400 hover:text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              🔗 連結
            </span>
          </button>
        </div>

        {/* 內容區域 */}
        <div className="max-h-[70vh] overflow-y-auto">
          {activeTab === 'scan' && (
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="text-center mb-2">
                <h3 className="text-lg font-semibold text-white">掃描好友 QR Code</h3>
                <p className="text-sm text-dark-400 mt-1">對準好友手機上的 QR Code</p>
              </div>

              {/* 掃描區域 */}
              <div className="relative w-full max-w-[300px] aspect-square bg-dark-700 rounded-xl overflow-hidden">
                <div id={scannerContainerId} className="w-full h-full" />

                {/* 狀態覆蓋層 */}
                {!isScanning && scanStatus !== 'scanning' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-800/90">
                    {scanStatus === 'idle' && (
                      <>
                        <svg className="w-16 h-16 text-dark-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-dark-400 text-sm">點擊下方按鈕開啟相機</p>
                      </>
                    )}
                    {scanStatus === 'connecting' && (
                      <>
                        <div className="w-12 h-12 border-4 border-mist-500 border-t-transparent rounded-full animate-spin mb-4" />
                        <p className="text-mist-400">{statusMessage}</p>
                      </>
                    )}
                    {scanStatus === 'success' && (
                      <>
                        <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-green-400 font-medium">{statusMessage}</p>
                      </>
                    )}
                    {scanStatus === 'error' && (
                      <>
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
                          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                        <p className="text-red-400">{statusMessage || scanError}</p>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* 控制按鈕 */}
              {!cryptoReady ? (
                <div className="text-center text-dark-400">
                  <div className="w-8 h-8 border-2 border-dark-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-sm">正在初始化加密模組...</p>
                </div>
              ) : scanStatus === 'idle' || scanStatus === 'error' ? (
                <button
                  onClick={startScanning}
                  className="px-6 py-3 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
                >
                  📷 開啟相機掃描
                </button>
              ) : isScanning ? (
                <button
                  onClick={stopScanning}
                  className="px-6 py-3 bg-dark-600 hover:bg-dark-500 text-white rounded-xl font-medium transition-colors"
                >
                  ⏹️ 停止掃描
                </button>
              ) : null}

              {scanError && scanStatus !== 'error' && (
                <p className="text-red-400 text-sm text-center">{scanError}</p>
              )}
            </div>
          )}

          {activeTab === 'myqr' && (
            <QRCodeVerification
              onVerified={(publicKey) => {
                onFriendAdded?.(publicKey, true);
              }}
            />
          )}

          {activeTab === 'invite' && (
            <InviteLink
              onLinkCreated={(_link, code) => {
                console.log('[AddFriendModal] Invite created:', { code });
              }}
            />
          )}
        </div>

        {/* 說明區域 */}
        <div className="px-6 py-4 bg-dark-700/30 border-t border-dark-700">
          {activeTab === 'scan' && (
            <div className="flex items-start gap-3">
              <span className="text-mist-400 text-lg">📷</span>
              <div className="text-sm">
                <p className="text-dark-300 font-medium">掃描加好友</p>
                <p className="text-dark-500 mt-0.5">
                  掃描對方的 QR Code，自動完成加密金鑰交換
                </p>
              </div>
            </div>
          )}
          {activeTab === 'myqr' && (
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">🟢</span>
              <div className="text-sm">
                <p className="text-dark-300 font-medium">面對面驗證</p>
                <p className="text-dark-500 mt-0.5">
                  讓好友掃描您的 QR Code，建立最高信任等級的連結
                </p>
              </div>
            </div>
          )}
          {activeTab === 'invite' && (
            <div className="flex items-start gap-3">
              <span className="text-yellow-400 text-lg">🟡</span>
              <div className="text-sm">
                <p className="text-dark-300 font-medium">遠端邀請</p>
                <p className="text-dark-500 mt-0.5">
                  分享連結邀請好友，之後可透過 QR Code 升級為已驗證
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddFriendModal;
