
"use client";

import { useEffect, useRef, useState } from "react";
import {
    Mic,
    MicOff,
    Volume2,
    Loader2,
    Send,
    AudioLines,
} from "lucide-react";

import {
    getQuestionAudio,
    transcribeAudioAnswer,
} from "@/lib/api";

interface Props {
    onSubmit: (answer: string, timeTaken: number) => void;

    // Optional callback for submitting the original audio directly.
    onAudioSubmit?: (
        audioBlob: Blob,
        timeTaken: number
    ) => void | Promise<void>;

    busy: boolean;
    interviewId: string;
    questionId: string;
    mode: "text" | "audio";
}

type RecordStatus =
    | "idle"
    | "recording"
    | "transcribing"
    | "submitting-audio";

export default function AnswerRecorder({
    onSubmit,
    onAudioSubmit,
    busy,
    interviewId,
    questionId,
    mode,
}: Props) {
    const [answer, setAnswer] = useState("");
    const [error, setError] = useState("");
    const [seconds, setSeconds] = useState(0);
    const [audioStarted, setAudioStarted] = useState(false);
    const [recordStatus, setRecordStatus] =
        useState<RecordStatus>("idle");

    const [aiStatus, setAiStatus] = useState<
        "idle" | "loading" | "playing" | "done"
    >("idle");

    const [recordedAudio, setRecordedAudio] =
        useState<Blob | null>(null);

    const startedRef = useRef(Date.now());
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const audioUrlRef = useRef<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const mountedRef = useRef(true);

    // Interview timer
    useEffect(() => {
        const id = window.setInterval(() => {
            setSeconds(
                Math.floor((Date.now() - startedRef.current) / 1000)
            );
        }, 1000);

        return () => window.clearInterval(id);
    }, []);

    // Reset when question changes
    useEffect(() => {
        startedRef.current = Date.now();

        setSeconds(0);
        setAnswer("");
        setError("");
        setAudioStarted(false);
        setAiStatus("idle");
        setRecordStatus("idle");
        setRecordedAudio(null);

        return () => {
            // Prevent an old recording from transcribing after
            // the user has moved to another question.
            const recorder = mediaRecorderRef.current;

            if (recorder) {
                recorder.ondataavailable = null;
                recorder.onstop = null;

                if (recorder.state !== "inactive") {
                    recorder.stop();
                }
            }

            streamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            streamRef.current = null;
            mediaRecorderRef.current = null;
            chunksRef.current = [];

            audioRef.current?.pause();
            audioRef.current = null;

            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current);
                audioUrlRef.current = null;
            }
        };
    }, [questionId]);

    useEffect(() => {
        mountedRef.current = true;

        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Play AI-generated interview question
    async function playQuestion() {
        try {
            setError("");
            setAiStatus("loading");

            const blob = await getQuestionAudio(
                interviewId,
                questionId
            );

            const url = URL.createObjectURL(blob);
            audioUrlRef.current = url;

            const audio = new Audio(url);
            audioRef.current = audio;

            audio.onended = () => {
                setAiStatus("done");

                URL.revokeObjectURL(url);
                audioUrlRef.current = null;

                if (mode === "audio") {
                    void startRecording();
                }
            };

            audio.onerror = () => {
                setAiStatus("done");

                URL.revokeObjectURL(url);
                audioUrlRef.current = null;

                setError(
                    "Question audio is unavailable. You can still record or type your answer."
                );
            };

            await audio.play();
            setAiStatus("playing");
        } catch (err) {
            console.error("Question audio error:", err);

            setAiStatus("done");

            setError(
                "Question audio is temporarily unavailable. You can still answer manually or record your answer."
            );
        }
    }

    // Start microphone recording
    async function startRecording() {
        if (busy || recordStatus !== "idle") return;

        if (!navigator.mediaDevices?.getUserMedia) {
            setError("Microphone recording is not supported in this browser.");
            return;
        }

        try {
            setError("");
            setRecordedAudio(null);
            chunksRef.current = [];

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);

            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunksRef.current.push(event.data);
                }
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());

                if (streamRef.current === stream) {
                    streamRef.current = null;
                }

                const audioBlob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });

                mediaRecorderRef.current = null;

                console.log("Recording details:", {
                    mimeType: recorder.mimeType,
                    blobType: audioBlob.type,
                    size: audioBlob.size,
                    chunks: chunksRef.current.length,
                });

                if (!mountedRef.current) return;

                if (audioBlob.size === 0) {
                    setRecordStatus("idle");
                    setError("No audio was recorded. Please try again.");
                    return;
                }

                setRecordedAudio(audioBlob);
                setRecordStatus("transcribing");

                try {
                    const transcript = await transcribeAudioAnswer(
                        interviewId,
                        questionId,
                        audioBlob
                    );

                    if (!mountedRef.current) return;

                    if (transcript.trim()) {
                        setAnswer((previous) =>
                            previous.trim()
                                ? `${previous.trim()} ${transcript.trim()}`
                                : transcript.trim()
                        );

                        setError("");
                    } else {
                        setError(
                            "No speech detected. You can type your answer manually."
                        );
                    }
                } catch (err) {
                    console.error("Transcription error:", err);

                    if (mountedRef.current) {
                        setError(
                            "Transcription failed. Your recording is saved; you can type your answer manually or submit the recorded audio."
                        );
                    }
                } finally {
                    if (mountedRef.current) {
                        setRecordStatus("idle");
                    }
                }
            };

            recorder.start(250);

            setRecordStatus("recording");
        } catch (err) {
            console.error("Microphone error:", err);

            streamRef.current?.getTracks().forEach((track) => {
                track.stop();
            });

            streamRef.current = null;

            setRecordStatus("idle");

            setError(
                "Microphone access failed. Allow microphone permission or type your answer manually."
            );
        }
    }

    // Stop recording
    function stopRecording() {
        const recorder = mediaRecorderRef.current;

        if (recorder && recorder.state === "recording") {
            recorder.stop();
        }
    }

    // Submit typed or transcribed answer
    function submitTextAnswer() {
        if (!answer.trim()) {
            setError("Please write or record your answer first.");
            return;
        }

        setError("");
        onSubmit(answer.trim(), seconds);
    }

    // Submit original audio directly
    async function submitDirectAudio() {
        if (!recordedAudio) {
            setError("Please record your answer first.");
            return;
        }

        if (!onAudioSubmit) {
            setError(
                "Direct audio submission is not connected yet. Please submit your text answer instead."
            );
            return;
        }

        try {
            setError("");
            setRecordStatus("submitting-audio");

            await onAudioSubmit(recordedAudio, seconds);
        } catch (err) {
            console.error("Direct audio submission error:", err);

            setError(
                err instanceof Error
                    ? err.message
                    : "Could not submit audio. Please try again."
            );
        } finally {
            if (mountedRef.current) {
                setRecordStatus("idle");
            }
        }
    }

    const mm = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");

    const ss = (seconds % 60)
        .toString()
        .padStart(2, "0");

    const isRecording = recordStatus === "recording";
    const isTranscribing = recordStatus === "transcribing";
    const isSubmittingAudio = recordStatus === "submitting-audio";

    const isProcessing =
        isTranscribing || isSubmittingAudio;

    // Shared answer textarea
    const answerEditor = (
        <div style={{ marginBottom: 12 }}>
            <div
                style={{
                    fontSize: 13,
                    fontWeight: 600,
                    marginBottom: 8,
                }}
            >
                Your answer
            </div>

            <textarea
                value={answer}
                onChange={(event) => {
                    setAnswer(event.target.value);

                    if (event.target.value.trim()) {
                        setError("");
                    }
                }}
                disabled={busy || isRecording || isSubmittingAudio}
                placeholder={
                    "Your transcribed answer will appear here.\n\nIf your microphone does not work, you can type your answer manually..."
                }
                style={{
                    width: "100%",
                    minHeight: 130,
                    resize: "vertical",
                    padding: 12,
                    boxSizing: "border-box",
                }}
            />

            <div
                style={{
                    color: "#999",
                    fontSize: 12,
                    marginTop: 5,
                }}
            >
                Edit your transcript or type your answer manually.
            </div>
        </div>
    );

    const errorMessage = error ? (
        <div className="notice error" style={{ marginBottom: 12 }}>
            {error}
        </div>
    ) : null;

    // TEXT MODE
    if (mode === "text") {
        return (
            <div className="answer-box">
                <div className="answer-toolbar">
                    <span>Your answer</span>
                    <span>{mm}:{ss} spent</span>
                </div>

                <div
                    style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: 12,
                    }}
                >
                    <button
                        type="button"
                        className="button secondary"
                        onClick={() => void playQuestion()}
                        disabled={
                            busy ||
                            aiStatus === "loading" ||
                            aiStatus === "playing"
                        }
                    >
                        <Volume2 size={14} />
                        {aiStatus === "loading"
                            ? "Loading..."
                            : aiStatus === "playing"
                              ? "Playing..."
                              : "Hear question"}
                    </button>

                    <button
                        type="button"
                        className="button secondary"
                        onClick={
                            isRecording
                                ? stopRecording
                                : () => void startRecording()
                        }
                        disabled={busy || isProcessing}
                    >
                        {isRecording ? (
                            <MicOff size={14} />
                        ) : isTranscribing ? (
                            <Loader2 size={14} />
                        ) : (
                            <Mic size={14} />
                        )}

                        {isRecording
                            ? "Stop recording"
                            : isTranscribing
                              ? "Transcribing..."
                              : "Record answer"}
                    </button>
                </div>

                {answerEditor}
                {errorMessage}

                <button
                    type="button"
                    className="button primary"
                    disabled={busy || isProcessing || isRecording}
                    onClick={submitTextAnswer}
                >
                    {busy ? "Submitting..." : "Submit answer"}
                </button>
            </div>
        );
    }

    // AUDIO MODE
    return (
        <div className="answer-box">
            <div className="answer-toolbar">
                <span>Voice interview</span>
                <span>{mm}:{ss} spent</span>
            </div>

            {!audioStarted && (
                <div
                    style={{
                        textAlign: "center",
                        padding: "20px 0",
                    }}
                >
                    <button
                        type="button"
                        className="button primary"
                        disabled={busy}
                        onClick={() => {
                            setAudioStarted(true);
                            void playQuestion();
                        }}
                    >
                        <Volume2 size={16} />
                        Start — hear the question
                    </button>

                    <p
                        style={{
                            color: "#999",
                            fontSize: 13,
                            marginTop: 10,
                        }}
                    >
                        You can also type your answer below if audio is unavailable.
                    </p>
                </div>
            )}

            {audioStarted && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        marginBottom: 12,
                        borderRadius: 8,
                        background: "#1a1f2e",
                        fontSize: 13,
                    }}
                >
                    <Volume2 size={16} />

                    <span>
                        {aiStatus === "loading"
                            ? "Loading question audio..."
                            : aiStatus === "playing"
                              ? "AI is speaking..."
                              : aiStatus === "done"
                                ? "Question audio finished or unavailable"
                                : "Ready"}
                    </span>

                    <button
                        type="button"
                        className="button secondary"
                        style={{ marginLeft: "auto", fontSize: 12 }}
                        onClick={() => void playQuestion()}
                        disabled={
                            busy ||
                            aiStatus === "loading" ||
                            aiStatus === "playing"
                        }
                    >
                        Replay
                    </button>
                </div>
            )}

            {/* Microphone controls */}
            <div
                style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 14,
                }}
            >
                <button
                    type="button"
                    className={`button ${isRecording ? "primary" : "secondary"}`}
                    onClick={
                        isRecording
                            ? stopRecording
                            : () => void startRecording()
                    }
                    disabled={busy || isProcessing}
                >
                    {isRecording ? (
                        <MicOff size={16} />
                    ) : isTranscribing ? (
                        <Loader2 size={16} />
                    ) : (
                        <Mic size={16} />
                    )}

                    {isRecording
                        ? "Stop recording"
                        : isTranscribing
                          ? "Transcribing..."
                          : "Record answer"}
                </button>

                {isRecording && (
                    <span style={{ color: "#22c55e", fontSize: 13 }}>
                        Listening... Speak your answer.
                    </span>
                )}

                {isTranscribing && (
                    <span style={{ color: "#f59e0b", fontSize: 13 }}>
                        Converting speech to text...
                    </span>
                )}
            </div>

            {/* Always-visible manual answer area */}
            {answerEditor}

            {/* Original audio submission */}
            {recordedAudio && (
                <div
                    style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "#1a1f2e",
                        marginBottom: 12,
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: 13,
                            marginBottom: 10,
                        }}
                    >
                        <AudioLines size={16} />
                        Original recording saved
                    </div>

                    {onAudioSubmit && (
                        <button
                            type="button"
                            className="button secondary"
                            onClick={() => void submitDirectAudio()}
                            disabled={
                                busy ||
                                isRecording ||
                                isProcessing
                            }
                        >
                            {isSubmittingAudio ? (
                                <Loader2 size={15} />
                            ) : (
                                <Send size={15} />
                            )}

                            Submit original audio
                        </button>
                    )}
                </div>
            )}

            {errorMessage}

            <button
                type="button"
                className="button primary"
                disabled={
                    busy ||
                    isRecording ||
                    isProcessing ||
                    !answer.trim()
                }
                onClick={submitTextAnswer}
            >
                {busy
                    ? "Submitting..."
                    : "Submit written answer"}
            </button>
        </div>
    );
}
