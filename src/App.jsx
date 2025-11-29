import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import './App.css';

const App = () => {
  // States
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [remoteIdInput, setRemoteIdInput] = useState('');
  const [captions, setCaptions] = useState('🎤 Waiting for speech...');
  const [targetLang, setTargetLang] = useState('es');
  const [status, setStatus] = useState('Initializing...');
  const [isCallActive, setIsCallActive] = useState(false);
  const [recognitionActive, setRecognitionActive] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerInstance = useRef(null);
  const connInstance = useRef(null);
  const localStreamRef = useRef(null);
  const callInstanceRef = useRef(null);
  const targetLangRef = useRef(targetLang);
  const recognitionRef = useRef(null);

  // Keep ref in sync
  useEffect(() => { targetLangRef.current = targetLang; }, [targetLang]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setRecognitionActive(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript.trim()) {
          const text = finalTranscript.trim();
          console.log('🎤 Final:', text);
          setStatus('✅ Sending...');
          
          if (connInstance.current && connInstance.current.open) {
            connInstance.current.send(text);
            setTimeout(() => {
              if (isCallActive) setStatus('🎤 Listening...');
            }, 1200);
          }
        }

        if (interimTranscript) {
          setCaptions(`🎙️ ${interimTranscript}`);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setStatus(`⚠️ Error: ${event.error}`);
      };

      recognition.onend = () => {
        setRecognitionActive(false);
        if (isCallActive) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    }
  }, [isCallActive]);

  // Handle incoming translated text
  const handleIncomingText = async (text) => {
    if (!text || text.trim().length === 0) return;
    
    try {
      const lang = targetLangRef.current || 'es';
      const langMap = { es: 'es', fr: 'fr', de: 'de', ja: 'ja', ur: 'ur', pt: 'pt', it: 'it', zh: 'zh-CN' };
      const langCode = langMap[lang] || 'es';

      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${langCode}`,
        { method: 'GET' }
      );
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        const translated = data.responseData.translatedText;
        console.log(`[Translation] "${text}" -> "${translated}" (${lang})`);
        setCaptions(`📝 ${translated}`);
      } else {
        console.warn('Translation service error:', data);
        setCaptions(`📝 ${text}`);
      }
    } catch (error) {
      console.error('Translation Error:', error);
      setCaptions(`📝 ${text}`);
    }
  };

  // Setup PeerJS
  useEffect(() => {
    const peer = new Peer();
    peerInstance.current = peer;

    peer.on('open', (id) => {
      setMyId(id);
      setStatus('✅ Ready to connect');
    });

    peer.on('call', (call) => {
      setStatus('📞 Incoming call...');
      setRemoteId(call.peer);
      setIsCallActive(true);
      
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          if (localVideoRef.current) localVideoRef.current.srcObject = stream;
          call.answer(stream);
          callInstanceRef.current = call;

          call.on('stream', (remoteStream) => {
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
          });

          setStatus('✅ Connected');
          startListening();
        })
        .catch((err) => {
          console.error('getUserMedia failed', err);
          setStatus('❌ Media access denied');
        });
    });

    peer.on('connection', (conn) => {
      connInstance.current = conn;
      conn.on('data', (data) => handleIncomingText(data));
      conn.on('open', () => {
        setStatus('✅ Connected');
      });
    });

    return () => {
      stopListening();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, []);

  // Start Web Speech Recognition
  const startListening = () => {
    if (recognitionRef.current && !recognitionActive) {
      try {
        recognitionRef.current.start();
        setStatus('🎤 Listening...');
      } catch (error) {
        console.error('Error starting recognition:', error);
      }
    }
  };

  // Stop Web Speech Recognition
  const stopListening = () => {
    if (recognitionRef.current && recognitionActive) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error('Error stopping recognition:', error);
      }
    }
  };

  // Start Call
  const startCall = async () => {
    if (!remoteIdInput.trim()) {
      setStatus('⚠️ Please enter a friend ID');
      return;
    }

    setStatus('📞 Calling...');
    setRemoteId(remoteIdInput);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const call = peerInstance.current.call(remoteIdInput, stream);
      callInstanceRef.current = call;

      call.on('stream', (remoteStream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      });

      call.on('close', () => {
        endCall();
      });

      const conn = peerInstance.current.connect(remoteIdInput);
      conn.on('open', () => {
        connInstance.current = conn;
        setIsCallActive(true);
        setStatus('✅ Connected');
        startListening();
      });
      
      conn.on('data', (data) => handleIncomingText(data));
    } catch (err) {
      console.error('Failed to get local stream', err);
      setStatus('❌ Media error');
    }
  };

  // End Call
  const endCall = () => {
    setStatus('Call ended');
    setIsCallActive(false);
    setRemoteId('');
    setRemoteIdInput('');
    setCaptions('🎤 Waiting for speech...');
    
    stopListening();

    if (callInstanceRef.current) {
      callInstanceRef.current.close();
      callInstanceRef.current = null;
    }

    if (connInstance.current) {
      connInstance.current.close();
      connInstance.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }

    setTimeout(() => setStatus('✅ Ready to connect'), 500);
  };

  // Toggle Mic
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].enabled = !audioTracks[0].enabled;
        setMicOn(audioTracks[0].enabled);
        if (!audioTracks[0].enabled) {
          stopListening();
        } else {
          startListening();
        }
      }
    }
  };

  // Toggle Camera
  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0].enabled = !videoTracks[0].enabled;
        setCameraOn(videoTracks[0].enabled);
      }
    }
  };

  // Copy ID to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(myId);
    setStatus('✅ ID copied to clipboard!');
    setTimeout(() => setStatus('✅ Ready to connect'), 2000);
  };

  return (
    <div className="app-container">
      {!isCallActive ? (
        // Pre-Call UI
        <>
          <div className="pre-call-screen">
            <header className="pre-call-header">
              <h1>🎥 Video Call Translator</h1>
              <p>Connect with anyone, translate everything</p>
            </header>

            <div className="status-display">{status}</div>

            <div className="id-section">
              <div className="id-display">
                <label>Your ID</label>
                <div className="id-box-display">
                  <code>{myId || 'Generating...'}</code>
                  <button onClick={copyToClipboard} className="copy-btn">
                    📋 Copy
                  </button>
                </div>
              </div>

              <div className="friend-id-section">
                <label>Call a Friend</label>
                <input
                  type="text"
                  placeholder="Paste friend's ID here"
                  value={remoteIdInput}
                  onChange={(e) => setRemoteIdInput(e.target.value)}
                  className="friend-id-input"
                  onKeyPress={(e) => e.key === 'Enter' && startCall()}
                />
                <button onClick={startCall} className="call-btn">
                  📞 Call
                </button>
              </div>
            </div>

            <footer className="pre-call-footer">
              <p>📝 Share your ID with a friend and wait for their call, or paste their ID to call them!</p>
            </footer>
          </div>
        </>
      ) : (
        // Active Call UI
        <>
          <div className="call-screen">
            {/* Main Remote Video */}
            <div className="video-main">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video"
              />
              <div className="video-label">Partner</div>
            </div>

            {/* Local Video (Bottom Right) */}
            <div className="video-pip">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="local-video"
              />
              <div className="video-label-small">You</div>
            </div>

            {/* Top Controls Bar */}
            <div className="top-controls">
              <div className="status-badge">{status}</div>
              
              <div className="controls-group">
                <button 
                  onClick={toggleMic} 
                  className={`control-btn ${micOn ? 'active' : ''}`}
                  title="Toggle Microphone"
                >
                  {micOn ? '🎤' : '🔇'}
                </button>
                <button 
                  onClick={toggleCamera} 
                  className={`control-btn ${cameraOn ? 'active' : ''}`}
                  title="Toggle Camera"
                >
                  {cameraOn ? '📷' : '📹'}
                </button>
              </div>
            </div>

            {/* Language Selection & Captions */}
            <div className="bottom-panel">
              <div className="language-selector">
                <label>Translate to:</label>
                <select 
                  value={targetLang} 
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="lang-select"
                >
                  <option value="es">🇪🇸 Spanish</option>
                  <option value="fr">🇫🇷 French</option>
                  <option value="de">🇩🇪 German</option>
                  <option value="ja">🇯🇵 Japanese</option>
                  <option value="pt">🇵🇹 Portuguese</option>
                  <option value="it">🇮🇹 Italian</option>
                  <option value="ur">🇵🇰 Urdu</option>
                </select>
              </div>

              <div className="captions-box">
                <p className="captions-text">{captions}</p>
              </div>

              <button onClick={endCall} className="end-call-btn">
                📞 End Call
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;
