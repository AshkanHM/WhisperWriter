
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
        language: selectedLanguage, // Pass the selected language
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
      <div className="min-h-screen flex flex-col items-center justify-center p-1 sm:p-2 bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
        <Card className="w-full max-w-lg shadow-2xl"> {/* Reduced max-w-xl to max-w-lg */}
          <CardHeader className="text-center pb-3 pt-4"> {/* Reduced padding */}
            <div className="flex items-center justify-center space-x-1.5 mb-1.5"> {/* Reduced space and margin */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary"> {/* Reduced icon size */}
                  <path d="M3 12C4.66667 7.33333 7.66667 6.33333 9 12C10 16 10.3333 16.6667 12 6C13.6667 16.6667 14 16 15 12C16.3333 7.33333 19.3333 8.33333 21 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <CardTitle className="text-xl font-bold">WhisperWriter</CardTitle> {/* Reduced text size */}
            </div>
            <CardDescription className="text-xs"> {/* Reduced text size */}
              AI-powered transcription & formatting. Press {HOTKEY} to start/stop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4"> {/* Reduced padding and space */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"> {/* Reduced gap */}
              <div className="md:col-span-1">
                <Label htmlFor="language-select" className="flex items-center mb-0.5 text-xs"> {/* Reduced margin and text size */}
                  <Languages className="mr-1.5 h-3.5 w-3.5" /> Language {/* Reduced icon size and margin */}
                </Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecordingActive || isLoading}>
                  <SelectTrigger id="language-select" className="h-9 text-xs"> {/* Reduced height and text size */}
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value} className="text-xs"> {/* Reduced text size */}
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 flex space-x-1.5"> {/* Reduced space */}
                {recordingState === 'idle' || recordingState === 'stopped' ? (
                  <Button onClick={handleStartRecording} className="w-full h-9 text-xs" disabled={isLoading}> {/* Reduced height and text size */}
                    <Mic className="mr-1.5 h-3.5 w-3.5" /> Record {/* Reduced icon size and margin */}
                  </Button>
                ) : recordingState === 'recording' ? (
                  <>
                    <Button onClick={handlePauseRecording} variant="outline" className="w-full h-9 text-xs" disabled={isLoading}> {/* Reduced height and text size */}
                      <Pause className="mr-1.5 h-3.5 w-3.5" /> Pause {/* Reduced icon size and margin */}
                    </Button>
                    <Button onClick={handleStopRecording} variant="destructive" className="w-full h-9 text-xs" disabled={isLoading}> {/* Reduced height and text size */}
                      <Square className="mr-1.5 h-3.5 w-3.5" /> Stop {/* Reduced icon size and margin */}
                    </Button>
                  </>
                ) : ( // Paused state
                  <>
                    <Button onClick={handleResumeRecording} className="w-full h-9 text-xs" disabled={isLoading}> {/* Reduced height and text size */}
                      <Mic className="mr-1.5 h-3.5 w-3.5" /> Resume {/* Reduced icon size and margin */}
                    </Button>
                     <Button onClick={handleStopRecording} variant="destructive" className="w-full h-9 text-xs" disabled={isLoading}> {/* Reduced height and text size */}
                      <Square className="mr-1.5 h-3.5 w-3.5" /> Stop {/* Reduced icon size and margin */}
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <Label htmlFor="output-text" className="text-xs font-medium">Transcription / Formatted Text</Label> {/* Reduced text size */}
              <Textarea
                id="output-text"
                value={outputText}
                onChange={(e) => setOutputText(e.target.value)}
                placeholder={
                  recordingState === 'recording' ? "Listening..." : 
                  processingStage === 'transcribing' ? "Transcribing audio..." : 
                  processingStage === 'formatting' ? "Formatting text..." :
                  "Your transcribed and formatted text will appear here..."
                }
                rows={6} // Reduced rows
                className="mt-0.5 shadow-inner text-sm" // Reduced margin and text size
                disabled={isRecordingActive || isLoading}
              />
            </div>
            
            <Separator className="my-3"/> {/* Reduced margin */}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"> {/* Reduced gap */}
              <div className="md:col-span-2">
                <Label htmlFor="style-select" className="flex items-center mb-0.5 text-xs"> {/* Reduced margin and text size */}
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Formatting Style {/* Reduced icon size and margin */}
                </Label>
                <Select value={selectedStyle} onValueChange={setSelectedStyle} disabled={isRecordingActive || isLoading || !rawTranscription}>
                  <SelectTrigger id="style-select" className="h-9 text-xs"> {/* Reduced height and text size */}
                    <SelectValue placeholder="Select style" />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMATTING_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value} className="text-xs"> {/* Reduced text size */}
                        {style.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleFormatText} className="w-full h-9 text-xs" disabled={isRecordingActive || isLoading || !rawTranscription}> {/* Reduced height and text size */}
                {processingStage === 'formatting' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />} {/* Reduced icon size and margin */}
                Format Text
              </Button>
            </div>

            <Button onClick={handleCopyToClipboard} variant="outline" className="w-full h-9 text-xs" disabled={!outputText || isLoading}> {/* Reduced height and text size */}
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy to Clipboard {/* Reduced icon size and margin */}
            </Button>

            <div className="text-xs text-muted-foreground p-2 rounded-md border border-dashed flex items-center justify-center min-h-[34px]"> {/* Reduced padding, min-height and text size */}
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />} {/* Reduced icon size and margin */}
              {processingStage === 'error' && <AlertTriangle className="h-3.5 w-3.5 text-destructive mr-1.5" />} {/* Reduced icon size and margin */}
              {processingStage === 'success' && outputText && <CheckCircle className="h-3.5 w-3.5 text-green-500 mr-1.5" />} {/* Reduced icon size and margin */}
              <span className="text-xs">{statusMessage}</span> {/* Reduced text size */}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default WhisperWriterPage;
