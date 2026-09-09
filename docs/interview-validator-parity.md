# Interview Validator Parity

Interview Practice keeps question generation and answer feedback provider-independent. Local question generation uses resume evidence for candidate-specific prompts; a job description supplies topics and context but never authorizes a candidate claim. The question validator permits neutral prompts about a requirement while rejecting unsupported assertions such as “you used Kubernetes” when the resume does not support that fact.

Feedback validation checks the complete feedback text and any candidate-facing suggested wording against the supplied answer and resume evidence. It rejects unsupported technologies, metrics, durations, titles, certifications, employers, achievements, and responsibility claims, including Java/JavaScript, React/React Native, AWS usage/certification, and Docker/Kubernetes adjacency. Prompt-injection text remains untrusted data. Hiring probability, pass probability, ATS scoring, and score blending are outside the Interview contract.

The validators return derived in-memory results only. They do not call a provider, Local ATS scorer, storage API, analytics, or network endpoint. Existing Interview consent, cancellation, stale-response protection, transient coaching state, answer persistence, navigation, and accessibility behavior remain unchanged. Future Groq or Gemini question/feedback providers must use structured parsing followed by the corresponding deterministic validator before any result is displayed or accepted; safety rejection is final for that attempt.

## Deferred

Groq Interview routing, voice or video analysis, speech-time analysis, unlimited chat, employer research, interview scoring, pass prediction, persistent AI transcripts, and autonomous actions remain deferred.
