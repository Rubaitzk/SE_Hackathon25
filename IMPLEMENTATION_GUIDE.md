# Video Call Translation App - Implementation Guide

## Overview
This is a real-time video call application that connects two users and translates incoming speech to a desired language using Rev AI for speech-to-text and MyMemory for translation.

## Changes Made

### 1. **Styling Separation** ✅
- **Issue**: All CSS was embedded inline in `App.jsx`, causing build errors
- **Solution**: Removed all inline styles and properly imported `./App.css`
- **Files Modified**:
  - `src/App.jsx`: Removed ~130 lines of inline CSS
  - `src/App.css`: Enhanced with better styling for controls and improved visual hierarchy

### 2. **Fixed Translation Logic** ✅
- **Issue**: `handleIncomingTextRef` had inconsistent error handling and didn't validate API responses properly
- **Improvements**:
  - Added proper response status checking (`responseStatus === 200`)
  - Added error logging to help debug translation failures
  - Added emoji indicators for captions (📝)
  - Fallback to original text if translation fails
  - Validation of empty text before processing

### 3. **Improved Speech-to-Text (STT) Implementation** ✅

#### Key Enhancements:
1. **Token Validation**: 
   - Checks if Rev AI token is properly set before attempting connection
   - Shows user-friendly error message if token is missing

2. **Better Error Handling**:
   - Try-catch wrapper for WebSocket creation
   - Proper error logging with context
   - Error state management in UI

3. **Improved Audio Processing**:
   - Clearer buffer size documentation (4096)
   - Proper Float32 to Int16 PCM conversion
   - Correct endianness handling (little-endian)

4. **Enhanced Message Handling**:
   - Properly handles both 'partial' and 'final' messages from Rev AI
   - Only sends 'final' results to avoid overwhelming the peer
   - Shows partial transcriptions for user feedback
   - Proper element extraction from Rev AI response

5. **Better Cleanup**:
   - Proper disconnection of all audio nodes
   - Safe audio context closure
   - Null checks before cleanup operations

6. **Status Updates**:
   - Real-time status indicators (🎙️ Listening, ✅ Sent, etc.)
   - Clear feedback on connection state
   - Temporary status messages that auto-reset

## How to Use

### Prerequisites
1. Install dependencies:
   ```bash
   npm install
   ```

2. Get a Rev AI API token from https://www.rev.ai/auth/signup

### Setup
1. Open `src/App.jsx`
2. Replace the placeholder token on line 7:
   ```javascript
   const REV_AI_TOKEN = "YOUR_ACTUAL_TOKEN_HERE";
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open the app in two browsers/tabs to test:
   - Copy your ID from the first instance
   - Paste it in the second instance's "Friend's ID" field
   - Click "📞 Call" to initiate

### Features
- **Real-time Video**: See your partner's video feed
- **Speech Recognition**: Your speech is transcribed in real-time using Rev AI
- **Translation**: Incoming speech is translated to your selected language
- **Language Options**: Spanish, French, German, Japanese, Urdu
- **Mic/Camera Controls**: Toggle audio and video on/off

## Architecture

### Data Flow
```
Local User's Audio
    ↓
Audio Context (WebAudioAPI)
    ↓
Float32 PCM Audio
    ↓
Convert to Int16 PCM
    ↓
Send to Rev AI via WebSocket
    ↓
Rev AI returns transcribed text
    ↓
Send to Peer via PeerJS DataConnection
    ↓
Remote User receives text
    ↓
Translate via MyMemory API
    ↓
Display in captions area
```

## API Services Used

### 1. Rev AI (Speech-to-Text)
- **Endpoint**: `wss://api.rev.ai/speechtotext/v1/stream`
- **Format**: Raw PCM audio (16-bit, little-endian)
- **Authentication**: Access token in URL
- **Response**: JSON with transcription elements

### 2. MyMemory (Translation)
- **Endpoint**: `https://api.mymemory.translated.net/get`
- **Free Tier**: Available (rate-limited)
- **Supports**: 100+ language pairs
- **Format**: JSON response with `responseData.translatedText`

### 3. PeerJS (P2P Connection)
- **Signaling Server**: Public signaling at peerjs.com
- **Connection Type**: WebRTC for video/audio, DataConnection for text
- **No Authentication**: Required for hackathon

## Troubleshooting

### No captions appearing
1. Check if Rev AI token is set correctly
2. Check browser console for errors
3. Verify microphone permissions are granted
4. Check network in DevTools (WebSocket connection should be OPEN)

### Translation not working
1. Check internet connection
2. Verify language code is supported (check MyMemory API)
3. Check browser console for fetch errors

### Video not showing
1. Grant camera permissions when prompted
2. Check if another app is using the camera
3. Ensure both peers have called `startCall` properly

### Audio issues
1. Check microphone is not muted in system settings
2. Try toggling mic off/on in the app
3. Check WebAudio API support in browser

## Browser Compatibility
- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ❌ Internet Explorer (not supported)

## Performance Notes
- Uses 4096 buffer size for optimal latency/processing balance
- Sends only 'final' transcriptions to reduce network overhead
- Partial transcriptions shown locally for user feedback
- Audio processing happens on every audio frame (~44.1kHz)

## Security Considerations
- ⚠️ Rev AI token is in frontend (only for hackathon, not production)
- Use environment variables in production
- Backend proxy recommended for API calls
- Consider HTTPS for production deployments

## Next Steps for Production
1. Move API tokens to backend
2. Implement token refresh mechanism
3. Add error recovery and reconnection logic
4. Use AudioWorklet instead of deprecated ScriptProcessorNode
5. Implement local speech recognition cache
6. Add WebRTC connection monitoring
7. Implement proper user authentication

## File Structure
```
src/
├── App.jsx          (Main component - cleaned up, improved STT/translation logic)
├── App.css          (Separated styles - enhanced)
├── main.jsx
└── index.css
```

## Testing Checklist
- [ ] Styles load correctly
- [ ] Video feeds appear on both sides
- [ ] STT transcriptions appear in captions
- [ ] Translations work correctly
- [ ] Language switching works
- [ ] Mic toggle works
- [ ] Camera toggle works
- [ ] Status bar updates reflect actual state
- [ ] No console errors
- [ ] App works on 2 different browser windows

---

**Last Updated**: November 2025
**Status**: ✅ Ready for testing
