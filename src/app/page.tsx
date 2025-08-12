
"use client";

import type {NextPage} from 'next';
import Head from 'next/head';
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';
import {transcribeAudio} from '@/ai/flows/transcribe-audio';
import {formatText} from '@/ai/flows/format-text';
import {
  Pause,
  StopCircle,
  Copy,
  Loader2,
  Wand2,
  Languages,
  Check,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import {
  LANGUAGES,
  FORMATTING_STYLES,
  DEFAULT_LANGUAGE,
  DEFAULT_FORMATTING_STYLE,
} from '@/lib/whisper-writer-config';
import {cn} from '@/lib/utils';


type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
type ProcessingStage = 'idle' | 'transcribing' | 'formatting' | 'error' | 'success';

const HEADER_IMAGES = {
  neutral: '/Images/neutral_state.webp',
  recording: '/Images/recording_state.webp',
  transcribing: '/Images/transcripting_state.webp',
  done: '/Images/done_state.webp',
};

const WhisperWriterPage: NextPage = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [transcription, setTranscription] = useState<string>('');
  const [formattedText, setFormattedText] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_FORMATTING_STYLE);
  const [isLanguageModalOpen, setLanguageModalOpen] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isCancelledRef = useRef<boolean>(false);
  const transcriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptionCursorPositionRef = useRef<{ start: number, end: number }>({ start: 0, end: 0 });
  const {toast} = useToast();

  const resetState = useCallback(() => {
    if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setRecordingState('idle');
    setProcessingStage('idle');
    setTranscription('');
    setFormattedText('');
    setSelectedStyle(DEFAULT_FORMATTING_STYLE);
    setSelectedLanguage(DEFAULT_LANGUAGE);
  }, []);

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
        isCancelledRef.current = true;
        // Directly stop tracks to avoid onstop event firing with valid data
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        try {
            if (mediaRecorderRef.current.state !== 'inactive') {
                mediaRecorderRef.current.stop();
            }
        } catch (e) {
            console.error("Error stopping media recorder:", e)
        }
    }
    // Only reset recording-related state, not the text
    setRecordingState('idle');
    setProcessingStage('idle');
    audioChunksRef.current = [];
  };

  const handleStartRecording = async () => {
    if (recordingState === 'recording') return;
    setProcessingStage('idle');
    isCancelledRef.current = false; 
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        if (isCancelledRef.current) {
            console.log("Recording cancelled, transcription skipped.");
            isCancelledRef.current = false; // Reset for next recording
            return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, {type: mediaRecorderRef.current?.mimeType || 'audio/webm'});
        if (audioBlob.size === 0) {
            console.log("No audio data recorded.");
            setRecordingState('idle'); 
            return;
        }

        setRecordingState('stopped');

        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setProcessingStage('transcribing');
          try {
            const transcriptionResult = await transcribeAudio({
              audioDataUri: base64Audio,
              language: selectedLanguage,
            });
             setTranscription(prev => {
              const { start, end } = transcriptionCursorPositionRef.current;
              // Add a space if inserting between existing text and not at the beginning
              const separator = prev.length > 0 && start > 0 && prev[start - 1] !== ' ' ? ' ' : '';
              const newText = `${prev.substring(0, start)}${separator}${transcriptionResult.transcription}${prev.substring(end)}`;
              const newCursorPos = start + transcriptionResult.transcription.length + separator.length;
              setTimeout(() => {
                transcriptionTextareaRef.current?.focus();
                transcriptionTextareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
                transcriptionCursorPositionRef.current = { start: newCursorPos, end: newCursorPos };
              }, 0);
              return newText;
            });
            setProcessingStage('success');
          } catch (error) {
            console.error('Transcription error:', error);
            setProcessingStage('error');
            toast({title: 'Transcription Failed', description: (error as Error).message, variant: 'destructive'});
          }
        };
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
    } catch (error) {
      console.error('Error starting recording:', error);
      setProcessingStage('error');
      toast({title: 'Recording Error', description: 'Could not access microphone. Please check permissions.', variant: 'destructive'});
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop();
    }
  };

  const handleFormatText = async () => {
    if (!transcription) {
      toast({title: 'No Text to Format', description: 'Please record or type text into the transcription box first.', variant: 'default'});
      return;
    }
    setProcessingStage('formatting');
    try {
      const formatResult = await formatText({
        text: transcription,
        style: selectedStyle,
        language: selectedLanguage,
      });
      setFormattedText(formatResult.formattedText);
      setProcessingStage('success');
    } catch (error) {
      console.error('Formatting error:', error);
      setProcessingStage('error');
      toast({title: 'Formatting Failed', description: (error as Error).message, variant: 'destructive'});
    }
  };

  const handleCopyToClipboard = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy)
      .then(() => toast({title: 'Copied to Clipboard!'}))
      .catch(err => toast({title: 'Copy Failed', variant: 'destructive'}));
  };
  
  const handleLanguageSelect = (langValue: string) => {
    setSelectedLanguage(langValue);
    setLanguageModalOpen(false);
  };

  const handleTranscriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setTranscription(e.target.value);
    transcriptionCursorPositionRef.current = { start: e.target.selectionStart, end: e.target.selectionEnd };
  };

  const handleTranscriptionSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    transcriptionCursorPositionRef.current = { start: target.selectionStart, end: target.selectionEnd };
  };


  const isLoading = processingStage === 'transcribing' || processingStage === 'formatting';
  const isRecording = recordingState === 'recording' || recordingState === 'paused';
  const showCancelAndStop = recordingState === 'recording' || recordingState === 'paused';

  const getHeaderState = () => {
    if (isRecording) return 'recording';
    if (processingStage === 'transcribing' || processingStage === 'formatting') return 'transcribing';
    if (processingStage === 'success') return 'done';
    return 'neutral';
  };
  
  const getLanguageButtonLabel = () => {
    if (selectedLanguage === 'en-US' || selectedLanguage === 'fa-IR') {
      return 'More Languages';
    }
    const selectedLang = LANGUAGES.find(lang => lang.value === selectedLanguage);
    return selectedLang ? selectedLang.label : 'More Languages';
  };

  return (
    <>
      <Head>
        <title>Whisper Writer - AI-Powered Transcription & Formatting</title>
        {/* Preload header images */}
        <link rel="preload" href={HEADER_IMAGES.neutral} as="image" />
        <link rel="preload" href={HEADER_IMAGES.recording} as="image" />
        <link rel="preload" href={HEADER_IMAGES.transcribing} as="image" />
        <link rel="preload" href={HEADER_IMAGES.done} as="image" />
      </Head>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Header */}
        <header className="fixed top-0 left-0 right-0 z-30 w-full h-40 flex flex-col justify-start items-center p-4">
          {/* Background Images */}
          {Object.entries(HEADER_IMAGES).map(([state, src]) => (
            <div
              key={state}
              className={cn(
                "absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-500 ease-in-out",
                getHeaderState() === state ? "opacity-100" : "opacity-0"
              )}
              style={{ backgroundImage: `url(${src})` }}
            />
          ))}

           <button onClick={() => setLanguageModalOpen(true)} className="glossy-badge absolute top-4 left-4 z-10 !mb-0">
                <Languages className="h-5 w-5" />
                <span>{getLanguageButtonLabel()}</span>
            </button>
           <div className="absolute top-4 right-4 z-10">
            <img src="/Images/ww_logo.webp" alt="Whisper Writer Logo" className="h-[38px] w-auto" />
          </div>
          {/* Recording Controls - Moved into Header */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 flex items-center justify-center space-x-4 z-20">
              {showCancelAndStop && (
                  <Button onClick={handleCancelRecording} size="icon" variant="destructive" className="w-16 h-16 rounded-full bg-red-900/80">
                      <Trash2 className="h-8 w-8" />
                  </Button>
              )}

              {(recordingState === 'idle' || recordingState === 'stopped') && (
                  <>
                      <Button onClick={() => setSelectedLanguage('en-US')} variant={selectedLanguage === 'en-US' ? 'secondary' : 'ghost'} className="rounded-full h-12">EN</Button>
                      <Button onClick={handleStartRecording} size="icon" className="w-36 h-36 rounded-full bg-rose-200/10 shadow-lg text-6xl">
                          🎙️
                      </Button>
                      <Button onClick={() => setSelectedLanguage('fa-IR')} variant={selectedLanguage === 'fa-IR' ? 'secondary' : 'ghost'} className="rounded-full h-12">FA</Button>
                  </>
              )}

              {isRecording && (
                <Button onClick={recordingState === 'recording' ? handlePauseRecording : handleResumeRecording} size="icon" className="w-32 h-32 rounded-full bg-red-500/80 shadow-lg">
                  {recordingState === 'recording' ? <Pause className="h-16 w-16" /> : <span className="text-6xl">🎙️</span>}
                </Button>
              )}
              
              {showCancelAndStop && (
                <Button onClick={handleStopRecording} size="icon" variant="secondary" className="w-16 h-16 rounded-full bg-green-500/80">
                    <StopCircle className="h-8 w-8" />
                </Button>
              )}
          </div>
        </header>

        {/* Shader layer */}
        <div className="absolute top-40 left-0 h-48 w-full flex-shrink-0 bg-gradient-to-b from-[var(--bg)] to-transparent z-10 pointer-events-none" />

        {/* Main Content */}
        <main className="relative flex-1 flex flex-col items-center p-4 space-y-4 overflow-y-auto pt-60 main-bg z-0">
          
          {/* Text Areas & Controls */}
          <div className="w-full max-w-lg space-y-6 flex flex-col items-center z-0">
            
            <div className="glossy-card">
              <div className="glossy-badge"><span className="dot"></span> Transcription (Editable)</div>
              <textarea
                id="transcription-text"
                ref={transcriptionTextareaRef}
                value={transcription}
                onChange={handleTranscriptionChange}
                onSelect={handleTranscriptionSelect}
                placeholder={
                  isRecording ? "Listening..." : 
                  processingStage === 'transcribing' ? "Transcribing..." : 
                  "Transcribed text will appear here."
                }
                className="glossy-textbox"
                disabled={isRecording || isLoading}
              />
            </div>
            
            <div className="w-full max-w-lg flex flex-col space-y-2">
                <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isLoading || !transcription}>
                    <SelectTrigger className="w-full h-12 text-sm rounded-lg bg-black/20 border-white/20">
                        <SelectValue placeholder="Select style" />
                    </SelectTrigger>
                    <SelectContent>
                        {FORMATTING_STYLES.map((style) => (
                        <SelectItem key={style.value} value={style.value} className="text-sm">
                            {style.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                 <button onClick={handleFormatText} className="btn-glossy btn-glossy-ghost" disabled={isLoading || !transcription}>
                    {processingStage === 'formatting' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                    Format
                </button>
            </div>
            
            <div className="glossy-card">
                <div className="glossy-badge">
                  <span className={cn(
                      "dot",
                      (processingStage === 'success' && formattedText) && "bg-green-500 shadow-[0_0_14px_#22c55e]"
                    )}>
                  </span> AI-Enhanced Text
                </div>
                <div className="relative">
                    <textarea
                        id="formatted-text"
                        value={formattedText}
                        onChange={(e) => setFormattedText(e.target.value)}
                        placeholder="Your formatted text will appear here..."
                        className="glossy-textbox pr-12"
                        disabled={isLoading}
                    />
                    <Button onClick={() => handleCopyToClipboard(formattedText)} size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8" disabled={!formattedText}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="w-full max-w-lg">
              <button onClick={resetState} className="btn-glossy w-full" disabled={isLoading}>
                    <RefreshCw className="mr-2 h-5 w-5" />
                    Reset
              </button>
            </div>
          </div>
        </main>
      </div>

      <Dialog open={isLanguageModalOpen} onOpenChange={setLanguageModalOpen}>
        <DialogContent className="glossy-card !max-w-[425px] !w-full !p-4 !border !bg-white/5 !rounded-2xl h-3/4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Language</DialogTitle>
            <DialogDescription>
              Choose the language of your audio for the best transcription accuracy.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
             <div className="flex flex-col space-y-1 pr-4">
                {LANGUAGES.map((lang) => (
                  <Button
                    key={lang.value}
                    variant={selectedLanguage === lang.value ? "secondary" : "ghost"}
                    onClick={() => handleLanguageSelect(lang.value)}
                    className="w-full justify-start"
                  >
                    <span className="flex-1 text-left">{lang.label}</span>
                    {selectedLanguage === lang.value && <Check className="h-4 w-4" />}
                  </Button>
                ))}
             </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WhisperWriterPage;

    
