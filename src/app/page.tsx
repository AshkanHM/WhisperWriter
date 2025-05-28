
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
  const [outputText, setOutputText] = useState<string>('');
  const [rawTranscription, setRawTranscription] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>(DEFAULT_FORMATTING_STYLE);
  const [statusMessage, setStatusMessage] = useState<string>('Ready to record.');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const {toast} = useToast();

  const HOTKEY = 'Alt+R';

  const handleStartRecording = async () => {
    if (recordingState === 'recording') return;
    setStatusMessage('Initializing recording...');
    setProcessingStage('idle');
    setOutputText('');
    setRawTranscription('');
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
            setRawTranscription(transcriptionResult.transcription);
            setOutputText(transcriptionResult.transcription);
            setStatusMessage('Transcription complete. Ready to format or copy.');
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
      // Actual status update will happen in onstop handler
    }
  };

  const toggleRecording = useCallback(() => {
    if (recordingState === 'idle' || recordingState === 'stopped') {
      handleStartRecording();
    } else if (recordingState === 'recording') {
      handleStopRecording(); 
    } else if (recordingState === 'paused') {
      handleResumeRecording(); // Or stop, depending on desired hotkey behavior for pause
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
    if (!rawTranscription) {
      toast({title: 'No Text to Format', description: 'Please record and transcribe audio first.', variant: 'default'});
      return;
    }
    setStatusMessage('Formatting text...');
    setProcessingStage('formatting');
    try {
      const formatResult = await formatText({
        text: rawTranscription,
        style: selectedStyle,
      });
      setOutputText(formatResult.formattedText);
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
    if (!outputText) {
      toast({title: 'Nothing to Copy', description: 'The text area is empty.', variant: 'default'});
      return;
    }
    navigator.clipboard.writeText(outputText)
      .then(() => {
        toast({title: 'Copied to Clipboard!', description: 'The text has been copied.'});
        setStatusMessage('Text copied to clipboard.');
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
        <title>WhisperWriter - Real-time Transcription & Formatting</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <Card className="w-full max-w-2xl shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-2">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
                    <path d="M12 2C11.073 2 10.243 2.675 10.046 3.556C8.492 3.913 7.218 5.151 6.833 6.722C5.898 6.943 5.117 7.686 4.843 8.601C3.961 8.805 3.25 9.524 3.014 10.406C2.188 10.575 1.5 11.226 1.5 12C1.5 12.774 2.188 13.425 3.014 13.594C3.25 14.476 3.961 15.195 4.843 15.399C5.117 16.314 5.898 17.057 6.833 17.278C7.218 18.849 8.492 20.087 10.046 20.444C10.243 21.325 11.073 22 12 22C12.927 22 13.757 21.325 13.954 20.444C15.508 20.087 16.782 18.849 17.167 17.278C18.102 17.057 18.883 16.314 19.157 15.399C20.039 15.195 20.75 14.476 20.986 13.594C21.812 13.425 22.5 12.774 22.5 12C22.5 11.226 21.812 10.575 20.986 10.406C20.75 9.524 20.039 8.805 19.157 8.601C18.883 7.686 18.102 6.943 17.167 6.722C16.782 5.151 15.508 3.913 13.954 3.556C13.757 2.675 12.927 2 12 2ZM12 4C12.5523 4 13 4.44772 13 5C13 5.55228 12.5523 6 12 6C11.4477 6 11 5.55228 11 5C11 4.44772 11.4477 4 12 4ZM9 7C9.55228 7 10 7.44772 10 8C10 8.55228 9.55228 9 9 9C8.44772 9 8 8.55228 8 8C8 7.44772 8.44772 7 9 7ZM15 7C15.5523 7 16 7.44772 16 8C16 8.55228 15.5523 9 15 9C14.4477 9 14 8.55228 14 8C14 7.44772 14.4477 7 15 7ZM6.5 11C7.05228 11 7.5 11.4477 7.5 12C7.5 12.5523 7.05228 13 6.5 13C5.94772 13 5.5 12.5523 5.5 12C5.5 11.4477 5.94772 11 6.5 11ZM17.5 11C18.0523 11 18.5 11.4477 18.5 12C18.5 12.5523 18.0523 13 17.5 13C16.9477 13 16.5 12.5523 16.5 12C16.5 11.4477 16.9477 11 17.5 11ZM9 15C9.55228 15 10 15.4477 10 16C10 16.5523 9.55228 17 9 17C8.44772 17 8 16.5523 8 16C8 15.4477 8.44772 15 9 15ZM15 15C15.5523 15 16 15.4477 16 16C16 16.5523 15.5523 17 15 17C14.4477 17 14 16.5523 14 16C14 15.4477 14.4477 15 15 15ZM12 18C12.5523 18 13 18.4477 13 19C13 19.5523 12.5523 20 12 20C11.4477 20 11 19.5523 11 19C11 18.4477 11.4477 18 12 18Z" fill="currentColor"/>
                </svg>
                <CardTitle className="text-3xl font-bold">WhisperWriter</CardTitle>
            </div>
            <CardDescription>Real-time AI-powered transcription and text formatting. Press {HOTKEY} to start/stop recording.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-1">
                <Label htmlFor="language-select" className="flex items-center mb-1">
                  <Languages className="mr-2 h-4 w-4" /> Language
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecordingActive || isLoading}>
                  <SelectTrigger id="language-select">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex space-x-2">
                {recordingState === 'idle' || recordingState === 'stopped' ? (
                  <Button onClick={handleStartRecording} className="w-full" disabled={isLoading}>
                    <Mic className="mr-2 h-5 w-5" /> Record
                  </Button>
                ) : recordingState === 'recording' ? (
                  <>
                    <Button onClick={handlePauseRecording} variant="outline" className="w-full" disabled={isLoading}>
                      <Pause className="mr-2 h-5 w-5" /> Pause
                    </Button>
                    <Button onClick={handleStopRecording} variant="destructive" className="w-full" disabled={isLoading}>
                      <Square className="mr-2 h-5 w-5" /> Stop
                    </Button>
                  </>
                ) : ( // Paused state
                  <>
                    <Button onClick={handleResumeRecording} className="w-full" disabled={isLoading}>
                      <Mic className="mr-2 h-5 w-5" /> Resume
                    </Button>
                     <Button onClick={handleStopRecording} variant="destructive" className="w-full" disabled={isLoading}>
                      <Square className="mr-2 h-5 w-5" /> Stop
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <Label htmlFor="output-text" className="text-sm font-medium">Transcription / Formatted Text</Label>
              <Textarea
                id="output-text"
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)} // Allow manual edits
                placeholder={
                  recordingState === 'recording' ? "Listening..." : 
                  processingStage === 'transcribing' ? "Transcribing audio..." : 
                  processingStage === 'formatting' ? "Formatting text..." :
                  "Your transcribed and formatted text will appear here..."
                }
                rows={10}
                className="mt-1 shadow-inner"
                disabled={isRecordingActive || isLoading}
              />
            </div>
            
            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div className="md:col-span-2">
                <Label htmlFor="style-select" className="flex items-center mb-1">
                  <Wand2 className="mr-2 h-4 w-4" /> Formatting Style
                </Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isRecordingActive || isLoading || !rawTranscription}>
                  <SelectTrigger id="style-select">
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATTING_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFormatText} className="w-full" disabled={isRecordingActive || isLoading || !rawTranscription}>
                {processingStage === 'formatting' ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
                Format Text
              </Button>
            </div>

            <Button onClick={handleCopyToClipboard} variant="outline" className="w-full" disabled={!outputText || isLoading}>
              <Copy className="mr-2 h-5 w-5" /> Copy to Clipboard
            </Button>

            <div className="text-sm text-muted-foreground p-3 rounded-md border border-dashed flex items-center justify-center min-h-[40px]">
              {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {processingStage === 'error' && <AlertTriangle className="h-4 w-4 text-destructive mr-2" />}
              {processingStage === 'success' && outputText && <CheckCircle className="h-4 w-4 text-green-500 mr-2" />}
              <span>{statusMessage}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default WhisperWriterPage;

