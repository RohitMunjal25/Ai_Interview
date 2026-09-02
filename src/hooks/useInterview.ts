"use client";
import { useState } from "react";
import type { Question } from "@/types";
export function useInterview() { const [questions, setQuestions] = useState<Question[]>([]); const [currentIndex, setCurrentIndex] = useState(0); return { questions, setQuestions, currentIndex, nextQuestion: () => setCurrentIndex((value) => value + 1), currentQuestion: questions[currentIndex] }; }