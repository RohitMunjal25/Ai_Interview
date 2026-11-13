
"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { getQuestionAudio, transcribeAudioAnswer } from "@/lib/api";

interface Props {
    onSubmit: (answer: string, timeTaken: number) => void;
    busy: boolean;
    interviewId: string;
    questionId: string;
    mode: "text" | "audio";
}

const SILENCE_THRESHOLD = 10;
const SILENCE_DELAY_MS = 2500;

export default function AnswerRecorder({
    onSubmit,
    busy,
    interviewId,
    questionId,
    mode,
}: Props) {
    const [answer, setAnswer] = useState("");
    const [error, setError] = useState("");
    const [started] = useState(() => Date.now());
    const [seconds, setSeconds] = useState(0);
    const [audioStarted, setAudioStarted] = useState(false);

    const [aiStatus, setAiStatus] = useState<
        "idle" | "loading" | "playing" | "done"
    >("idle");

    const [recordStatus, setRecordStatus] = useState<
        "idle" | "recording" | "transcribing"
    >("idle");

    const [silenceCountdown, setSilenceCountdown] =
        useState<number | null>(null);

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const silenceTimerRef = useRef<number | null>(null);
    const silenceCountdownRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Timer
    useEffect(() => {
        const id = window.setInterval(() => {
            setSeconds(Math.floor((Date.now() - started) / 1000));
        }, 1000);

        return () => window.clearInterval(id);
    }, [started]);

    // Cleanup when question changes or component unmounts
    useEffect(() => {
        return () => {
            audioRef.current?.pause();
            audioRef.current = null;

            stopSilenceDetection();

            if (mediaRecorderRef.current?.state === "recording") {
                mediaRecorderRef.current.stop();
            }

            streamRef.current?.getTracks().forEach((track) => track.stop());
        };
    }, [questionId]);

    // Reset state for every new question
    useEffect(() => {
        setAnswer("");
        setAudioStarted(false);
        setAiStatus("idle");
        setRecordStatus("idle");
        setError("");
    }, [questionId]);

    function stopSilenceDetection() {
        if (silenceTimerRef.current !== null) {
            window.clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }

        if (silenceCountdownRef.current !== null) {
            window.clearInterval(silenceCountdownRef.current);
            silenceCountdownRef.current = null;
        }

        setSilenceCountdown(null);
    }

    // Play AI-generated question audio
    async function playQuestion() {
        try {
            setError("");
            setAiStatus("loading");

            const blob = await getQuestionAudio(interviewId, questionId);

            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);

            audioRef.current = audio;

            audio.onended = () => {
                setAiStatus("done");
                URL.revokeObjectURL(url);

                if (mode === "audio") {
                    void startRecording();
                }
            };

            audio.onerror = () => {
                setAiStatus("done");
                URL.revokeObjectURL(url);

                setError(
                    "Could not play audio. You can still record your answer."
                );

                if (mode === "audio") {
                    void startRecording();
                }
            };

            await audio.play();

            setAiStatus("playing");
        } catch (err) {
            console.error("Question audio error:", err);

            setAiStatus("done");
            setError("Could not load question audio.");

            if (mode === "audio") {
                void startRecording();
            }
        }
    }

    // Start microphone recording
    async function startRecording() {
        if (mediaRecorderRef.current?.state === "recording") {
            return;
        }

        setError("");

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
            });

            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);

            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.onstop = async () => {
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;

                stopSilenceDetection();

                const audioBlob = new Blob(chunksRef.current, {
                    type: "audio/webm",
                });

                if (audioBlob.size === 0) {
                    setError("No audio was recorded. Please try again.");
                    setRecordStatus("idle");
                    return;
                }

                setRecordStatus("transcribing");

                try {
                    // IMPORTANT: Pass questionId as required by the API
                    const text = await transcribeAudioAnswer(
                        interviewId,
                        questionId,
                        audioBlob
                    );

                    if (text?.trim()) {
                        setAnswer((prev) =>
                            prev ? `${prev} ${text.trim()}` : text.trim()
                        );
                    } else {
                        setError(
                            "No speech was detected. Please try recording again."
                        );
                    }
                } catch (err) {
                    console.error("Audio transcription error:", err);

                    setError(
                        err instanceof Error
                            ? `Transcription failed: ${err.message}`
                            : "Voice transcription failed. Please type your answer below."
                    );
                } finally {
                    setRecordStatus("idle");
                }
            };

            recorder.start(100);

            mediaRecorderRef.current = recorder;

            setRecordStatus("recording");

            // Silence detection using Web Audio API
            const audioCtx = new AudioContext();

            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();

            analyser.fftSize = 512;

            source.connect(analyser);

            analyserRef.current = analyser;

            const data = new Uint8Array(analyser.frequencyBinCount);

            let silenceStart: number | null = null;

            function checkSilence() {
                if (!analyserRef.current) return;

                analyserRef.current.getByteFrequencyData(data);

                const avg =
                    data.reduce((a, b) => a + b, 0) / data.length;

                if (avg < SILENCE_THRESHOLD) {
                    if (silenceStart === null) {
                        silenceStart = Date.now();

                        setSilenceCountdown(
                            Math.ceil(SILENCE_DELAY_MS / 1000)
                        );

                        silenceCountdownRef.current =
                            window.setInterval(() => {
                                const remaining = Math.ceil(
                                    (
                                        SILENCE_DELAY_MS -
                                        (Date.now() -
                                            (silenceStart ?? Date.now()))
                                    ) / 1000
                                );

                                setSilenceCountdown(
                                    remaining > 0 ? remaining : 0
                                );
                            }, 500);
                    } else if (
                        Date.now() - silenceStart >= SILENCE_DELAY_MS
                    ) {
                        stopRecording();
                        return;
                    }
                } else {
                    if (silenceStart !== null) {
                        silenceStart = null;
                        stopSilenceDetection();
                    }
                }

                if (mediaRecorderRef.current?.state === "recording") {
                    requestAnimationFrame(checkSilence);
                }
            }

            requestAnimationFrame(checkSilence);
        } catch (err) {
            console.error("Microphone recording error:", err);

            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;

            setRecordStatus("idle");

            setError(
                "Microphone access failed. Please allow microphone access and try again."
            );
        }
    }

    // Stop microphone recording
    function stopRecording() {
        if (mediaRecorderRef.current?.state === "recording") {
            mediaRecorderRef.current.stop();
        }

        mediaRecorderRef.current = null;
        analyserRef.current = null;

        setRecordStatus("idle");

        stopSilenceDetection();
    }

    // Submit answer
    function submit() {
        if (!answer.trim()) {
            setError("Please write or record an answer before submitting.");
            return;
        }

        setError("");

        onSubmit(answer.trim(), seconds);
    }

    const mm = Math.floor(seconds / 60)
        .toString()
        .padStart(2, "0");

    const ss = (seconds % 60)
        .toString()
        .padStart(2, "0");

    const isTranscribing = recordStatus === "transcribing";
    const isRecording = recordStatus === "recording";

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
                        gap: 8,
                        marginBottom: 10,
                    }}
                >
                    <button
                        type="button"
                        className="button secondary"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                        }}
                        onClick={() => void playQuestion()}
                        disabled={
                            aiStatus === "loading" ||
                            aiStatus === "playing" ||
                            busy
                        }
                    >
                        {aiStatus === "loading" || aiStatus === "playing" ? (
                            <Loader2 size={14} />
                        ) : (
                            <Volume2 size={14} />
                        )}

                        {aiStatus === "loading"
                            ? "Loading..."
                            : aiStatus === "playing"
                              ? "Playing..."
                              : "Hear question"}
                    </button>

                    <button
                        type="button"
                        className={`button ${
                            isRecording ? "primary" : "secondary"
                        }`}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 13,
                        }}
                        onClick={
                            isRecording
                                ? stopRecording
                                : () => void startRecording()
                        }
                        disabled={busy || isTranscribing}
                    >
                        {isTranscribing ? (
                            <Loader2 size={14} />
                        ) : isRecording ? (
                            <MicOff size={14} />
                        ) : (
                            <Mic size={14} />
                        )}

                        {isTranscribing
                            ? "Transcribing..."
                            : isRecording
                              ? "Stop recording"
                              : "Record answer"}
                    </button>
                </div>

                <textarea
                    value={answer}
                    onChange={(e) => {
                        setAnswer(e.target.value);
                        if (e.target.value.trim()) setError("");
                    }}
                    placeholder="Think out loud. Strong answers are specific, structured, and grounded in your experience."
                />

                {error && (
                    <div className="notice error">{error}</div>
                )}

                <button
                    className="button primary"
                    disabled={busy || isTranscribing}
                    onClick={submit}
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

            {!audioStarted ? (
                <div
                    style={{
                        textAlign: "center",
                        padding: "24px 0",
                    }}
                >
                    <button
                        type="button"
                        className="button primary"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            margin: "0 auto",
                        }}
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
                            color: "#aaa",
                            fontSize: 13,
                            marginTop: 10,
                        }}
                    >
                        Click to hear the question, then answer by voice.
                    </p>
                </div>
            ) : (
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
                    <Volume2
                        size={16}
                        style={{
                            color:
                                aiStatus === "playing" ? "#6c8fff" : "#555",
                        }}
                    />

                    <span
                        style={{
                            color:
                                aiStatus === "playing" ? "#6c8fff" : "#aaa",
                        }}
                    >
                        {aiStatus === "loading"
                            ? "Loading question audio..."
                            : aiStatus === "playing"
                              ? "AI is speaking..."
                              : aiStatus === "done"
                                ? "AI finished speaking"
                                : "Preparing..."}
                    </span>
                </div>
            )}

            {/* Microphone status */}
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
                {isRecording ? (
                    <>
                        <Mic
                            size={16}
                            style={{ color: "#22c55e" }}
                        />

                        <span style={{ color: "#22c55e" }}>
                            {silenceCountdown !== null
                                ? `Listening... stopping in ${silenceCountdown}s`
                                : "Listening... speak your answer"}
                        </span>

                        <button
                            type="button"
                            className="button secondary"
                            style={{
                                marginLeft: "auto",
                                fontSize: 12,
                                padding: "4px 10px",
                            }}
                            onClick={stopRecording}
                        >
                            Stop early
                        </button>
                    </>
                ) : isTranscribing ? (
                    <>
                        <Loader2
                            size={16}
                            style={{ color: "#f59e0b" }}
                        />

                        <span style={{ color: "#f59e0b" }}>
                            Transcribing your answer...
                        </span>
                    </>
                ) : (
                    <>
                        <MicOff
                            size={16}
                            style={{ color: "#555" }}
                        />

                        <span style={{ color: "#aaa" }}>
                            {aiStatus === "playing"
                                ? "Mic starts after AI finishes"
                                : "Microphone idle"}
                        </span>
                    </>
                )}
            </div>

            {/* Editable transcript */}
            {(answer || isTranscribing) && (
                <div style={{ marginBottom: 12 }}>
                    <div
                        style={{
                            fontSize: 12,
                            color: "#aaa",
                            marginBottom: 4,
                        }}
                    >
                        Your transcribed answer (you can edit before
                        submitting):
                    </div>

                    <textarea
                        value={answer}
                        onChange={(e) => {
                            setAnswer(e.target.value);
                            if (e.target.value.trim()) setError("");
                        }}
                        placeholder="Your spoken answer will appear here..."
                        style={{ minHeight: 100 }}
                    />
                </div>
            )}

            {error && (
                <div className="notice error">{error}</div>
            )}

            <button
                className="button primary"
                disabled={
                    busy ||
                    isTranscribing ||
                    isRecording ||
                    !answer.trim()
                }
                onClick={submit}
            >
                {busy
                    ? "Submitting..."
                    : isTranscribing
                      ? "Transcribing..."
                      : isRecording
                        ? "Recording..."
                        : "Submit answer"}
            </button>
        </div>
    );
}
