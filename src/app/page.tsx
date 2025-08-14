
"use client";

import type {NextPage} from 'next';
import Head from 'next/head';
import React, {useState, useRef, useEffect, useCallback} from 'react';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';

import StyleSelect from '@/components/StyleSelect';

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
  ClipboardPaste,
} from 'lucide-react';
import {
  LANGUAGES,
  FORMATTING_STYLES,
  DEFAULT_LANGUAGE,
  DEFAULT_FORMATTING_STYLE,
} from '@/lib/whisper-writer-config';
import {cn} from '@/lib/utils';

// Minimal Lucide-style broom icon
export function BroomIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m13 11 9-9" />
      <path d="M14.6 12.6c.8.8.9 2.1.2 3L10 22l-8-8 6.4-4.8c.9-.7 2.2-.6 3 .2Z" />
      <path d="m6.8 10.4 6.8 6.8" />
      <path d="m5 17 1.4-1.4" />
    </svg>
  );
}



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
  
  const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

const hasTranscription = transcription.trim().length > 0;
const hasFormatted     = formattedText.trim().length   > 0;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isCancelledRef = useRef<boolean>(false);
  const transcriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptionCursorPositionRef = useRef<{ start: number, end: number }>({ start: 0, end: 0 });
  const {toast} = useToast();

  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);
  

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
  
    // Reset textarea sizes
    if (transcriptionTextareaRef.current) {
      transcriptionTextareaRef.current.style.height = '';
      transcriptionTextareaRef.current.style.width = '';
    }
    if (aiTextareaRef.current) {
      aiTextareaRef.current.style.height = '';
      aiTextareaRef.current.style.width = '';
    }
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

        setRecordingState('idle');

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
// keep the new cursor position for later, but don't focus on mobile
const isMobile =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

// was: setTimeout(() => { el.focus(); el.setSelectionRange(...); }, 0);
if (!isMobile) {
  requestAnimationFrame(() => {
    const el = transcriptionTextareaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    el.setSelectionRange(newCursorPos, newCursorPos);
  });
}

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
      setRecordingState('stopped');
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
  
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setTranscription(current => current + (current ? ' ' : '') + text);
      toast({ title: "Pasted from Clipboard!" });
    } catch (err) {
      toast({ title: "Paste Failed", variant: "destructive" });
    }
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

  const formattingDisabled = isLoading || !transcription;

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
  const gliderPos =
  selectedLanguage === 'fa-IR' ? 'left' :
  selectedLanguage === 'en-US' ? 'right' :
  'none';
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
            <img src="/Images/ww_logo.webp" alt="Whisper Writer Logo" className="h-[52px] w-auto" />
          </div>
{/* Recording Controls — Glassy Cluster (languages in idle; cancel/stop when active) */}
<div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-20 pointer-events-none">
  {mounted && (
    <div
      id="rec-cluster"
        className="relative"
      style={
        {
          // sizing tokens
          // @ts-ignore
          "--size": "144px", // main button
          "--side": "56px",  // side buttons
          "--gap": "18px",   // space between main and sides
        } as React.CSSProperties
      }
    >
{/* LEFT SIDE */}
{(recordingState === 'recording' || recordingState === 'paused') ? (
  <button
    onClick={handleCancelRecording}
    aria-label="Cancel recording"
    className="rec-side-btn rec-left pointer-events-auto"
  >
    <Trash2 className="w-1/2 h-1/2" />
  </button>
) : null}



      {/* MAIN BUTTON */}
      <button
        aria-pressed={recordingState === 'recording'}
        aria-label={
          (recordingState === 'idle' || recordingState === 'stopped') ? "Start recording"
          : recordingState === 'recording' ? "Pause recording"
          : "Resume recording"
        }
        onClick={() => {
          if (recordingState === 'idle' || recordingState === 'stopped') return handleStartRecording();
          if (recordingState === 'recording') return handlePauseRecording();
          if (recordingState === 'paused') return handleResumeRecording();
        }}
        className={cn(
            "rec-btn pointer-events-auto",
            recordingState
        )}
      >
        {/* Idle: mic icon */}
        <div className="icon icon-mic" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 1 1-8 0V5a4 4 0 0 1 4-4z"/>
                <path d="M19 11a7 7 0 0 1-14 0"/><path d="M12 18v5"/><path d="M8 23h8"/>
            </svg>
        </div>

        {/* Recording: animated waveform */}
        <div className="icon icon-wave" aria-hidden="true">
            <div className="wave">
                <div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div><div className="bar"></div>
            </div>
        </div>

        {/* Paused: pause icon */}
        <div className="icon icon-pause" aria-hidden="true">
            <div className="pause-shape">
                <div className="pause-bar"></div><div className="pause-bar"></div>
            </div>
        </div>
      </button>

{/* RIGHT SIDE */}
{(recordingState === 'recording' || recordingState === 'paused') ? (
  <button
    onClick={handleStopRecording}
    aria-label="Stop and submit"
    className="rec-side-btn rec-right pointer-events-auto"
  >
    <span className="rec-stop-square" />
  </button>
) : null}



{(recordingState !== 'recording' && recordingState !== 'paused') && (
  <div className="lang-switch" role="radiogroup" aria-label="Language selector">
    {/* Left: Persian */}
    <button
      className={`lang-option lang-left ${selectedLanguage === 'fa-IR' ? 'is-active' : ''}`}
      role="radio"
      aria-checked={selectedLanguage === 'fa-IR'}
      onClick={() => setSelectedLanguage('fa-IR')}
    >
      Persian
    </button>

    {/* Right: English */}
    <button
      className={`lang-option lang-right ${selectedLanguage === 'en-US' ? 'is-active' : ''}`}
      role="radio"
      aria-checked={selectedLanguage === 'en-US'}
      onClick={() => setSelectedLanguage('en-US')}
    >
      English
    </button>

    <div className="lang-track" aria-hidden="true">
      <div className="lang-rail" />
      <div className="lang-glider" data-pos={gliderPos} />
    </div>
  </div>
)}


    </div>
  )}
</div>




        </header>

        {/* Shader layer */}
        <div className="absolute top-40 left-0 h-32 w-full flex-shrink-0 bg-gradient-to-b from-[var(--bg)] to-transparent z-10 pointer-events-none" />

        {/* Main Content */}
        <main
  className={cn(
    "relative flex-1 flex flex-col items-center p-4 space-y-4",
    "overflow-y-auto pt-60 main-bg z-0 main-scroll",
    "pb-[calc(env(safe-area-inset-bottom)+80px)] sm:pb-40"
  )}
>
 
          {/* Text Areas & Controls */}
          <div className="w-full max-w-lg space-y-6 flex flex-col items-center z-0 mt-4">
            
          <div className="glossy-card">
              <div className="flex items-center justify-between mb-2">
                <div className="glossy-badge">
                  <span className={cn("dot", hasTranscription && "dot-on")} />
                  {" "}Transcription (Editable)
                </div>
                <button
                  type="button"
                  className="btn-card-ghost btn-sm -mt-3"
                  onClick={handlePasteFromClipboard}
                  disabled={isLoading || isRecording}
                  aria-label="Paste from clipboard"
                  title="Paste"
                >
                  <ClipboardPaste className="h-4 w-4" />
                  <span>Paste</span>
                </button>
              </div>
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
            
            <div className="w-full max-w-lg flex flex-col space-y-3">
  {/* Formatting selector card – fancy dropdown */}
  <div className="glossy-card overflow-hidden">
    <StyleSelect
      label="Formatting Style"
      options={FORMATTING_STYLES.map(s => ({ label: s.label, value: s.value }))}
      value={selectedStyle}
      onChange={(v) => setSelectedStyle(v)}
      disabled={isLoading || !transcription}
    />
  </div>

  {/* Keep your existing action button below */}
  <button
    onClick={handleFormatText}
    className="btn-glossy btn-glossy-ghost"
    disabled={isLoading || !transcription}
  >
    {processingStage === 'formatting'
      ? <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      : <Wand2 className="mr-2 h-5 w-5" />
    }
    Re-Write & Enhance
  </button>
</div>


{/* === AI-Enhanced Text Card (Copy button moved to header) === */}
<div className="glossy-card">
  <div className="flex items-center justify-between mb-2">
    <div className="glossy-badge">
      <span className={cn("dot", hasFormatted && "dot-on")} />
      {" "}AI-Enhanced Text
    </div>


    {/* New visible Copy button (outside the textarea) */}
    <button
      type="button"
      className="btn-card-ghost btn-sm -mt-3"
      onClick={() => handleCopyToClipboard(formattedText)}
      disabled={!formattedText}
      aria-label="Copy formatted text"
      title="Copy"
    >
      <Copy className="h-4 w-4" />
      <span>Copy</span>
    </button>
  </div>

  {/* Textarea no longer needs right padding or absolute icon */}
  <textarea
    ref={aiTextareaRef}
    id="formatted-text"
    value={formattedText}
    onChange={(e) => setFormattedText(e.target.value)}
    placeholder="Your formatted text will appear here..."
    className="glossy-textbox"
    disabled={isLoading}
  />
</div>



<div className="w-full max-w-lg !mt-4 mb-10">
  <button onClick={resetState} className="btn-clear-glassy" disabled={isLoading}>
  <BroomIcon className="mr-2 h-5 w-5 -rotate-12" />
  Clear
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

    
