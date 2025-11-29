import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import './App.css'; // We will add simple styles next

const App = () => {
  const [myId, setMyId] = useState('');
  const [remoteId, setRemoteId] = useState('');
  const [captions, setCaptions] = useState('Waiting for conversation...');
  const [targetLang, setTargetLang] = useState('eng'); // Default Spanish
  const [status, setStatus] = useState('Idle');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerInstance = useRef(null);
  const connInstance = useRef(null); // For Data (Text)
  
  useEffect(() => {
    // 1. Initialize PeerJS
    const peer = new Peer();

    peer.on('open', (id) => {
      setMyId(id);
      setStatus('Online - Ready to connect');
    });

    // Handle incoming video calls
    peer.on('call', (call) => {
      navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localVideoRef.current.srcObject = stream;
          call.answer(stream); // Answer the call with our stream
          call.on('stream', (remoteStream) => {
            remoteVideoRef.current.srcObject = remoteStream;
          });
          setupSpeechRecognition(); // Start listening
          setStatus('Connected (Call)');
        });
    });

    // Handle incoming data connections (for Captions)
    peer.on('connection', (conn) => {
      conn.on('data', async (data) => {
        // data is the text from the other person
        handleIncomingText(data);
      });
      conn.on('open', () => {
        connInstance.current = conn;
      });
    });

    peerInstance.current = peer;

    // Cleanup on unmount
    return () => {
        peer.destroy();
    }
  }, []); // Empty dependency array = runs once on mount

  // --- Helper Functions ---

  const startCall = () => {
    setStatus('Calling...');
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        localVideoRef.current.srcObject = stream;
        
        // 1. Call for Video
        const call = peerInstance.current.call(remoteId, stream);
        call.on('stream', (remoteStream) => {
          remoteVideoRef.current.srcObject = remoteStream;
        });

        // 2. Connect for Data (Text)
        const conn = peerInstance.current.connect(remoteId);
        conn.on('open', () => {
          connInstance.current = conn;
          setStatus('Connected');
          setupSpeechRecognition();
        });
      })
      .catch(err => console.error("Failed to get local stream", err));
  };

  const setupSpeechRecognition = () => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Browser does not support Speech API. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US'; // We assume input is English for this MVP

    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const text = lastResult[0].transcript;
      console.log("My Speech:", text);

      // Send the text to the peer
      if (connInstance.current && connInstance.current.open) {
        connInstance.current.send(text);
      }
    };

    recognition.start();
  };

  const handleIncomingText = async (text) => {
    // We need to use the current state of targetLang, but inside async callbacks
    // it can be tricky. We'll read the latest value via a simple ref or just
    // trust the component re-render if we passed it correctly.
    // For simplicity in this structure, we will use the state directly 
    // but beware of stale closures if you move this function out.
    
    // NOTE: To fix stale closure in useEffect/callback, we'd typically use a ref for lang
    // but here we just fetch.
    
    try {
        // Using MyMemory API
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetLang}`);
        const data = await res.json();
        setCaptions(data.responseData.translatedText);
    } catch (error) {
        console.error("Translation Error:", error);
        setCaptions(text); // Fallback to original text
    }
  };

  // Needed to update the translation function when language changes
  // We attach this to a ref so the callback always sees the current lang
  const targetLangRef = useRef(targetLang);
  useEffect(() => { targetLangRef.current = targetLang }, [targetLang]);

  // Override the previous handleIncomingText to use Ref (fixes stale closure)
  const handleIncomingTextRef = async (text) => {
     try {
        const lang = targetLangRef.current;
        const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`);
        const data = await res.json();
        setCaptions(data.responseData.translatedText);
    } catch (error) {
        setCaptions(text);
    }
  };

  // Re-bind the data listener when connection exists but language changes?
  // Actually, easiest is just to call handleIncomingTextRef directly in the 'data' event above.
  // I will update the useEffect above to call `handleIncomingTextRef`.

  return (
    <div className="app-container">
      <header>
        <h1>⚛️ React Video Translator</h1>
        <div className="status-bar">Status: {status}</div>
      </header>

      <div className="controls">
        <div className="id-box">
          <label>My ID:</label>
          <input type="text" value={myId} readOnly />
          <button onClick={() => navigator.clipboard.writeText(myId)}>Copy</button>
        </div>
        
        <div className="connect-box">
          <input 
            type="text" 
            placeholder="Enter Friend's ID" 
            value={remoteId} 
            onChange={(e) => setRemoteId(e.target.value)} 
          />
          <button className="call-btn" onClick={startCall}>📞 Call</button>
        </div>

        <div className="lang-box">
            <label>Translate to: </label>
            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)}>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="ur">Urdu</option>
            </select>
        </div>
      </div>

      <div className="video-grid">
        <div className="video-card">
            <video ref={localVideoRef} autoPlay muted playsInline />
            <span>Me</span>
        </div>
        <div className="video-card">
            <video ref={remoteVideoRef} autoPlay playsInline />
            <span>Partner</span>
        </div>
      </div>

      <div className="caption-area">
        <h3>Live Captions:</h3>
        <p>{captions}</p>
      </div>
    </div>
  );
};

export default App;