
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
  Mic,
  Pause,
  StopCircle,
  Copy,
  Loader2,
  Wand2,
  Languages,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import {
  LANGUAGES,
  FORMATTING_STYLES,
  DEFAULT_LANGUAGE,
  DEFAULT_FORMATTING_STYLE,
  type SelectOption,
} from '@/lib/whisper-writer-config';
import {cn} from '@/lib/utils';


type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
type ProcessingStage = 'idle' | 'transcribing' | 'formatting' | 'error' | 'success';

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
  }, []);

  const handleCancelRecording = () => {
    if (mediaRecorderRef.current) {
        isCancelledRef.current = true; // Set cancellation flag
        // Manually stop tracks to prevent onstop from having a valid blob
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        mediaRecorderRef.current.stop(); // This will trigger onstop, but our flag will prevent transcription
    }
    resetState();
  };

  const handleStartRecording = async () => {
    if (recordingState === 'recording') return;
    setProcessingStage('idle');
    isCancelledRef.current = false; // Reset cancellation flag
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        // Only proceed if not cancelled
        if (isCancelledRef.current) {
            stream.getTracks().forEach(track => track.stop());
            console.log("Recording cancelled, transcription skipped.");
            return;
        }
        
        const audioBlob = new Blob(audioChunksRef.current, {type: mediaRecorderRef.current?.mimeType || 'audio/webm'});
        if (audioBlob.size === 0) {
            console.log("No audio data recorded.");
            stream.getTracks().forEach(track => track.stop());
            return;
        }

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
            // Insert new transcription at the last known cursor position
             setTranscription(prev => {
              const { start, end } = transcriptionCursorPositionRef.current;
              const newText = `${prev.substring(0, start)}${transcriptionResult.transcription}${prev.substring(end)}`;
              // We need to update the cursor position to be at the end of the inserted text
              const newCursorPos = start + transcriptionResult.transcription.length;
              transcriptionCursorPositionRef.current = { start: newCursorPos, end: newCursorPos };
              // Use a timeout to focus and set selection after the state update has rendered
              setTimeout(() => {
                transcriptionTextareaRef.current?.focus();
                transcriptionTextareaRef.current?.setSelectionRange(newCursorPos, newCursorPos);
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
        stream.getTracks().forEach(track => track.stop());
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

  const headerBgClass = () => {
    if (isRecording) return 'bg-[hsl(var(--header-recording-bg))]';
    if (processingStage === 'success') return 'bg-[hsl(var(--header-success-bg))]';
    return 'bg-[hsl(var(--header-idle-bg))]';
  };
  
  const moreLanguagesButtonLabel = LANGUAGES.find(lang => lang.value === selectedLanguage)?.label || 'More Languages';
  const showCustomLanguage = !['en-US', 'fa-IR'].includes(selectedLanguage);


  return (
    <>
      <Head>
        <title>Whisper Writer - AI-Powered Transcription & Formatting</title>
      </Head>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
        {/* Header */}
        <header className={cn("relative w-full h-48 transition-colors duration-500 flex flex-col justify-center items-center p-4", headerBgClass())}>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/50 opacity-50"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <img src="/icons/app-icon.svg" alt="Whisper Writer Logo" className="h-16 w-16 mb-2" />
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center p-4 space-y-4 overflow-y-auto">
          {/* Recording Controls */}
          <div className="relative flex items-center justify-center space-x-4 my-4">
              {showCancelAndStop && (
                  <Button onClick={handleCancelRecording} size="icon" variant="destructive" className="w-16 h-16 rounded-full bg-red-900/80 hover:bg-red-800">
                      <Trash2 className="h-8 w-8" />
                  </Button>
              )}

              {(recordingState === 'idle' || recordingState === 'stopped') && (
                  <>
                      <Button onClick={() => handleLanguageSelect('en-US')} variant={selectedLanguage === 'en-US' ? 'secondary' : 'ghost'} className="rounded-full h-12">EN</Button>
                      <Button onClick={handleStartRecording} size="icon" className="w-24 h-24 rounded-full bg-rose-200/10 hover:bg-rose-200/20 shadow-lg">
                          <Mic className="h-10 w-10 text-primary-foreground" />
                      </Button>
                      <Button onClick={() => handleLanguageSelect('fa-IR')} variant={selectedLanguage === 'fa-IR' ? 'secondary' : 'ghost'} className="rounded-full h-12">FA</Button>
                  </>
              )}

              {isRecording && (
                <Button onClick={recordingState === 'recording' ? handlePauseRecording : handleResumeRecording} size="icon" className="w-24 h-24 rounded-full bg-red-500/80 shadow-lg">
                  {recordingState === 'recording' ? <Pause className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                </Button>
              )}
              
              {showCancelAndStop && (
                <Button onClick={handleStopRecording} size="icon" variant="secondary" className="w-16 h-16 rounded-full bg-green-500/80 hover:bg-green-400">
                    <StopCircle className="h-8 w-8" />
                </Button>
              )}
          </div>
          {!(isRecording || showCancelAndStop) && (
             <Button onClick={() => setLanguageModalOpen(true)} variant="ghost" size="sm">
                <Languages className="mr-2 h-4 w-4" />
                {showCustomLanguage ? moreLanguagesButtonLabel : 'More Languages'}
              </Button>
          )}

          {/* Text Areas & Controls */}
          <div className="w-full max-w-md space-y-4">
            <div className="relative">
              <Label htmlFor="transcription-text" className="text-xs font-medium text-muted-foreground">Transcription (Editable)</Label>
              <Textarea
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
                rows={5}
                className="mt-1 shadow-inner text-sm bg-muted/30 border-primary/20 rounded-xl"
                disabled={isRecording || isLoading}
              />
            </div>
            
            <div className="flex flex-col space-y-2">
                <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isLoading || !transcription}>
                    <SelectTrigger className="w-full h-12 text-sm rounded-lg bg-muted/30 border-primary/20">
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
                 <Button onClick={handleFormatText} className="w-full h-12 text-base font-bold rounded-lg" disabled={isLoading || !transcription}>
                    {processingStage === 'formatting' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                    Format
                </Button>
            </div>
            
            <div className="relative">
                <Label htmlFor="formatted-text" className="text-xs font-medium text-muted-foreground">AI-Enhanced Text</Label>
                <div className="relative">
                    <Textarea
                        id="formatted-text"
                        value={formattedText}
                        readOnly
                        placeholder="Your formatted text will appear here..."
                        rows={6}
                        className="mt-1 shadow-inner text-sm bg-muted/30 border-primary/20 rounded-xl pr-12"
                        disabled={isLoading}
                    />
                    <Button onClick={() => handleCopyToClipboard(formattedText)} size="icon" variant="ghost" className="absolute top-2 right-2 h-8 w-8" disabled={!formattedText}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </div>
             <Button onClick={resetState} variant="outline" className="w-full h-12 text-base rounded-lg border-primary/30" disabled={isLoading}>
                  Reset
            </Button>
          </div>
        </main>
      </div>

      <Dialog open={isLanguageModalOpen} onOpenChange={setLanguageModalOpen}>
        <DialogContent className="sm:max-w-[425px] h-3/4 flex flex-col">
          <DialogHeader>
            <DialogTitle>Select Language</DialogTitle>
            <DialogDescription>
              Choose the language of your audio for the best transcription accuracy.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1">
             <div className="flex flex-col space-y-1 pr-4">
                {LANGUAGES.filter(lang => lang.value !== 'en-US' && lang.value !== 'fa-IR').map((lang) => (
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

    

    