import { Mic, MicOff, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export function VoiceControls({
  latestPrompt,
  promptKey,
  disabled = false,
  onTranscriptAppend,
  onInterimChange,
}) {
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState(null);

  const recognitionRef = useRef(null);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const sttSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const stopSpeaking = useCallback(() => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [ttsSupported]);

  const speakText = useCallback(
    (text) => {
      if (!ttsSupported || isMuted || !text.trim()) return;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        setIsSpeaking(false);
      }
    },
    [isMuted, ttsSupported],
  );

  useEffect(() => {
    if (!latestPrompt || isMuted) return;
    speakText(latestPrompt);
    return () => {
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [promptKey, latestPrompt, isMuted, speakText, ttsSupported]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (ttsSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [ttsSupported]);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopSpeaking();
    } else if (latestPrompt && ttsSupported) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(latestPrompt);
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    setSpeechError(null);
    if (!sttSupported) {
      setSpeechError('Voice dictation requires Chrome, Edge, or Safari speech recognition support.');
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      onInterimChange?.('');
      return;
    }

    stopSpeaking();

    const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechCtor) return;

    try {
      const recognition = new SpeechCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let finalChunk = '';
        let interimChunk = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const res = event.results[i];
          const transcript = res[0]?.transcript || '';
          if (res.isFinal) {
            finalChunk += `${transcript} `;
          } else {
            interimChunk += transcript;
          }
        }
        if (finalChunk.trim()) {
          onTranscriptAppend(finalChunk.trim());
        }
        onInterimChange?.(interimChunk.trim());
      };

      recognition.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone access was denied. Enable mic permission or type your answer.');
        } else if (event.error !== 'aborted') {
          setSpeechError('Voice recognition paused. You can resume or type directly.');
        }
        setIsListening(false);
        onInterimChange?.('');
      };

      recognition.onend = () => {
        setIsListening(false);
        onInterimChange?.('');
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsListening(true);
    } catch {
      setSpeechError('Could not start microphone dictation.');
      setIsListening(false);
    }
  };

  return (
    <div className="space-y-3 py-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Voice Controls
        </span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {isListening ? 'Listening' : isSpeaking ? 'Speaking' : isMuted ? 'Audio muted' : 'Audio ready'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={toggleMute}
          disabled={!ttsSupported}
          aria-pressed={isMuted}
          aria-label={isMuted ? 'Unmute interviewer voice' : 'Mute interviewer voice'}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50 whitespace-nowrap"
        >
          {isMuted ? (
            <>
              <VolumeX className="h-4 w-4 text-zinc-500 dark:text-zinc-400" aria-hidden="true" />
              Unmute
            </>
          ) : (
            <>
              <Volume2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              Mute Voice
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => speakText(latestPrompt)}
          disabled={!ttsSupported || isMuted || !latestPrompt}
          aria-label="Replay interviewer question"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50 whitespace-nowrap"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Replay
        </button>
      </div>

      <button
        type="button"
        onClick={toggleListening}
        disabled={disabled || !sttSupported}
        aria-pressed={isListening}
        aria-label={isListening ? 'Stop voice dictation' : 'Start voice dictation'}
        className={`flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 disabled:opacity-50 whitespace-nowrap ${
          isListening
            ? 'bg-red-600 text-white hover:bg-red-700'
            : 'border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        {isListening ? (
          <>
            <MicOff className="h-4 w-4" aria-hidden="true" />
            Stop Dictation
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            Answer by Voice
          </>
        )}
      </button>

      {!sttSupported && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Browser speech-to-text is unavailable here; type your response below.
        </p>
      )}
      {speechError && (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
          {speechError}
        </p>
      )}
    </div>
  );
}
