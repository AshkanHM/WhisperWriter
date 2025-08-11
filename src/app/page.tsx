
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
import {Label} from '@/components/ui/label';
import {useToast} from '@/hooks/use-toast';
import {transcribeAudio} from '@/ai/flows/transcribe-audio';
import {formatText} from '@/ai/flows/format-text';
import {
  Mic,
  Pause,
  Square,
  Copy,
  Loader2,
  Wand2,
  Languages,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  LANGUAGES,
  FORMATTING_STYLES,
  DEFAULT_LANGUAGE,
  DEFAULT_FORMATTING_STYLE,
  type SelectOption,
} from '@/lib/whisper-writer-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';
type ProcessingStage = 'idle' | 'transcribing' | 'formatting' | 'error' | 'success';

const WhisperWriterPage: NextPage = () => {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(DEFAULT_LANGUAGE);
  const [transcription, setTranscription] = useState<string>('');
  const [formattedText, setFormattedText] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_FORMATTING_STYLE);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to record.');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const {toast} = useToast();

  const HOTKEY = 'Alt+R';

  const resetState = () => {
    setRecordingState('idle');
    setProcessingStage('idle');
    setSelectedLanguage(DEFAULT_LANGUAGE);
    setTranscription('');
    setFormattedText('');
    setSelectedStyle(DEFAULT_FORMATTING_STYLE);
    setStatusMessage('Ready to record.');
    if (mediaRecorderRef.current?.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  const handleStartRecording = async () => {
    if (recordingState === 'recording') return;
    // Reset relevant fields before starting a new recording
    setTranscription('');
    setFormattedText('');
    setProcessingStage('idle');
    setStatusMessage('Initializing recording...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {type: mediaRecorderRef.current?.mimeType || 'audio/webm'});
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          setStatusMessage('Transcribing audio...');
          setProcessingStage('transcribing');
          try {
            const transcriptionResult = await transcribeAudio({
              audioDataUri: base64Audio,
              language: selectedLanguage,
            });
            setTranscription(transcriptionResult.transcription);
            setStatusMessage('Transcription complete. Edit if needed, then format.');
            setProcessingStage('success');
          } catch (error) {
            console.error('Transcription error:', error);
            setStatusMessage('Error during transcription. Please try again.');
            setProcessingStage('error');
            toast({title: 'Transcription Failed', description: (error as Error).message, variant: 'destructive'});
          }
        };
        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setRecordingState('recording');
      setStatusMessage(`Recording in ${LANGUAGES.find(l => l.value === selectedLanguage)?.label || 'selected language'}... Press ${HOTKEY} to stop.`);
    } catch (error) {
      console.error('Error starting recording:', error);
      setStatusMessage('Failed to start recording. Check microphone permissions.');
      setProcessingStage('error');
      toast({title: 'Recording Error', description: 'Could not access microphone. Please check permissions.', variant: 'destructive'});
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      setStatusMessage('Recording paused.');
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      setStatusMessage('Recording resumed...');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && (recordingState === 'recording' || recordingState === 'paused')) {
      mediaRecorderRef.current.stop();
      setRecordingState('stopped'); // 'stopped' is a transient state before transcription begins
    }
  };

  const toggleRecording = useCallback(() => {
    if (recordingState === 'idle' || recordingState === 'stopped') {
      handleStartRecording();
    } else if (recordingState === 'recording') {
      handleStopRecording(); 
    } else if (recordingState === 'paused') {
      handleResumeRecording();
    }
  }, [recordingState, selectedLanguage]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key.toUpperCase() === 'R') {
        event.preventDefault();
        toggleRecording();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleRecording]);


  const handleFormatText = async () => {
    if (!transcription) {
      toast({title: 'No Text to Format', description: 'Please record or type text into the transcription box first.', variant: 'default'});
      return;
    }
    setStatusMessage('Formatting text...');
    setProcessingStage('formatting');
    try {
      const formatResult = await formatText({
        text: transcription,
        style: selectedStyle,
        language: selectedLanguage,
      });
      setFormattedText(formatResult.formattedText);
      setStatusMessage('Text formatting complete.');
      setProcessingStage('success');
    } catch (error) {
      console.error('Formatting error:', error);
      setStatusMessage('Error during text formatting.');
      setProcessingStage('error');
      toast({title: 'Formatting Failed', description: (error as Error).message, variant: 'destructive'});
    }
  };

  const handleCopyToClipboard = () => {
    if (!formattedText) {
      toast({title: 'Nothing to Copy', description: 'The formatted text box is empty.', variant: 'default'});
      return;
    }
    navigator.clipboard.writeText(formattedText)
      .then(() => {
        toast({title: 'Copied to Clipboard!', description: 'The formatted text has been copied.'});
        setStatusMessage('Formatted text copied to clipboard.');
      })
      .catch(err => {
        console.error('Failed to copy text: ', err);
        toast({title: 'Copy Failed', description: 'Could not copy text to clipboard.', variant: 'destructive'});
        setStatusMessage('Failed to copy text.');
      });
  };

  const isLoading = processingStage === 'transcribing' || processingStage === 'formatting';
  const isRecordingActive = recordingState === 'recording' || recordingState === 'paused';

  return (
    <>
      <Head>
        <title>Whisper Writer - Real-time Transcription & Formatting</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-1 sm:p-2 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <Card className="w-full max-w-sm shadow-2xl">
          <CardHeader className="text-center pb-2 pt-3">
             <div className="flex items-center justify-center space-x-1.5 mb-1">
                 <svg width="18" height="18" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4,24C4,24 10,12,24,12C38,12 44,24,44,24C44,24 38,36,24,36C10,36 4,24,4,24Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                  <path d="M24,29C26.7614,29,29,26.7614,29,24C29,21.2386,26.7614,19,24,19C21.2386,19,19,21.2386,19,24C19,26.7614,21.2386,29,24,29Z" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"/>
                </svg>
                <CardTitle className="text-lg font-bold">Whisper Writer</CardTitle>
            </div>
            <CardDescription className="text-xs">
              AI-powered transcription & formatting. Press {HOTKEY} to start/stop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div className="md:col-span-1">
                <Label htmlFor="language-select" className="flex items-center mb-0.5 text-xs">
                  <Languages className="mr-1 h-3 w-3" /> Language
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecordingActive || isLoading}>
                  <SelectTrigger id="language-select" className="h-9 text-xs">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-xs">
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex space-x-1.5">
                {recordingState === 'idle' || recordingState === 'stopped' ? (
                  <Button onClick={handleStartRecording} className="w-full h-9 text-xs" disabled={isLoading}>
                    <Mic className="mr-1.5 h-3 w-3" /> Record
                  </Button>
                ) : recordingState === 'recording' ? (
                  <>
                    <Button onClick={handlePauseRecording} variant="outline" className="w-full h-9 text-xs" disabled={isLoading}>
                      <Pause className="mr-1.5 h-3 w-3" /> Pause
                    </Button>
                    <Button onClick={handleStopRecording} variant="destructive" className="w-full h-9 text-xs" disabled={isLoading}>
                      <Square className="mr-1.5 h-3 w-3" /> Stop
                    </Button>
                  </>
                ) : ( // Paused state
                  <>
                    <Button onClick={handleResumeRecording} className="w-full h-9 text-xs" disabled={isLoading}>
                      <Mic className="mr-1.5 h-3 w-3" /> Resume
                    </Button>
                     <Button onClick={handleStopRecording} variant="destructive" className="w-full h-9 text-xs" disabled={isLoading}>
                      <Square className="mr-1.5 h-3 w-3" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <Label htmlFor="transcription-text" className="text-xs font-medium">Transcription (Editable)</Label>
              <Textarea
                id="transcription-text"
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder={
                  recordingState === 'recording' ? "Listening..." : 
                  processingStage === 'transcribing' ? "Transcribing audio..." : 
                  "Your transcribed text will appear here. You can edit it before formatting."
                }
                rows={4}
                className="mt-0.5 shadow-inner text-sm"
                disabled={isRecordingActive || isLoading}
              />
            </div>
            
            <Separator className="my-2"/>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
              <div className="md:col-span-2">
                <Label htmlFor="style-select" className="flex items-center mb-0.5 text-xs">
                  <Wand2 className="mr-1 h-3 w-3" /> Formatting Style
                </Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isRecordingActive || isLoading || !transcription}>
                  <SelectTrigger id="style-select" className="h-9 text-xs">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATTING_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value} className="text-xs">
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFormatText} className="w-full h-9 text-xs" disabled={isRecordingActive || isLoading || !transcription}>
                {processingStage === 'formatting' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3 w-3" />}
                Format
              </Button>
            </div>
            
            <div className="relative">
                <Label htmlFor="formatted-text" className="text-xs font-medium">AI-Enhanced Text</Label>
                <Textarea
                    id="formatted-text"
                    value={formattedText}
                    readOnly
                    placeholder="Your formatted text will appear here..."
                    rows={5}
                    className="mt-0.5 shadow-inner text-sm bg-muted/50"
                    disabled={isLoading}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
                <Button onClick={handleCopyToClipboard} variant="outline" className="w-full h-9 text-xs" disabled={!formattedText || isLoading}>
                  <Copy className="mr-1.5 h-3 w-3" /> Copy
                </Button>
                <Button onClick={resetState} variant="ghost" className="w-full h-9 text-xs" disabled={isLoading}>
                  <RefreshCw className="mr-1.5 h-3 w-3" /> Reset
                </Button>
            </div>

            <div className="text-xs text-muted-foreground p-2 rounded-md border border-dashed flex items-center justify-center min-h-[34px]">
              {isLoading && <Loader2 className="h-3 w-3 animate-spin mr-1.5" />}
              {processingStage === 'error' && <AlertTriangle className="h-3 w-3 text-destructive mr-1.5" />}
              {processingStage === 'success' && (transcription || formattedText) && <CheckCircle className="h-3 w-3 text-green-500 mr-1.5" />}
              <span className="text-center">{statusMessage}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default WhisperWriterPage;

    