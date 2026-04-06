import { useState, useRef } from 'react';

export const useVoiceInput = () => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>('');
  const hasCalledResultRef = useRef<boolean>(false);

  const startListening = (
    onResult: (transcript: string) => void, 
    onError?: (error: string) => void,
    onInterim?: (transcript: string) => void
  ) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Ваш браузер не поддерживает голосовой ввод.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'ru-RU';
    recognition.continuous = true;
    recognition.interimResults = true;
    transcriptRef.current = '';
    hasCalledResultRef.current = false;

    recognition.onstart = () => setIsRecording(true);
    
    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; ++i) {
        fullTranscript += event.results[i][0].transcript;
      }
      transcriptRef.current = fullTranscript;
      
      if (onInterim) {
        onInterim(fullTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      if (onError) onError(event.error);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      
      if (transcriptRef.current.trim() && !hasCalledResultRef.current) {
        hasCalledResultRef.current = true;
        const finalTranscript = transcriptRef.current;
        transcriptRef.current = ''; // Clear immediately
        onResult(finalTranscript);
      }
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  return { isRecording, startListening, stopListening };
};
