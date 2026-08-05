const OPENAI_MODEL = "gpt-5-nano";
const USE_MOCK_GRADING = false;
const VIDEO_ID = "j64UB9hU6BM";
const LESSON_CONTEXT = {
  title: "Do This and People Will Instantly Respect You",
  speaker: "Leila Hormozi",
  transcript: "",
};

const recapHeader = document.querySelector(".work-area_header");
const recapForm = document.querySelector(".work-area_form");
const recapField = document.querySelector("#recap");
const submitButton = document.querySelector(".submit-button");
const submitAvatar = submitButton.querySelector(".submit-avatar");
const gradeStatus = document.querySelector(".grade-status");
const resultsView = document.querySelector("#results-view");
const submittedAnswer = document.querySelector("#submitted-answer");
const correctionList = document.querySelector("#correction-list");
const missedList = document.querySelector("#missed-list");
const scoreList = document.querySelector("#score-list");
const shareResultButton = document.querySelector("#share-result");
const video = document.querySelector(".video");
const videoFrame = video.querySelector("iframe");
const videoCover = video.querySelector(".video-cover");

const AVATAR_FRAMES = {
  idle: "assets/avatar/owner-avatar-ponytail.webp",
  talking: "assets/avatar/owner-avatar-ponytail-talking.webp",
  smile: "assets/avatar/owner-avatar-ponytail-smile.webp",
  readingLeft: "assets/avatar/owner-avatar-reading-left.webp",
  readingMid: "assets/avatar/owner-avatar-reading-mid.webp",
  readingRight: "assets/avatar/owner-avatar-reading-turn-right.webp",
};

let avatarReadingTimer;
let isAvatarReading = false;

Object.values(AVATAR_FRAMES).forEach((src) => {
  const image = new Image();
  image.src = src;
});

submitButton.addEventListener("mouseenter", () => {
  if (!isAvatarReading) setAvatarFrame("talking");
});
submitButton.addEventListener("mouseleave", () => {
  if (!isAvatarReading) setAvatarFrame("idle");
});
submitButton.addEventListener("focus", () => {
  if (!isAvatarReading) setAvatarFrame("talking");
});
submitButton.addEventListener("blur", () => {
  if (!isAvatarReading) setAvatarFrame("idle");
});

videoCover.addEventListener("click", () => playVideoAt(0));
shareResultButton.addEventListener("click", shareResult);

recapForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const answer = recapField.value.trim();
  if (!answer) {
    gradeStatus.textContent = "Write your recap first.";
    recapField.focus();
    return;
  }

  if (!USE_MOCK_GRADING && !requestOpenAIKey()) {
    gradeStatus.textContent = "An OpenAI API key is required to check your answer.";
    return;
  }

  setLoading(true);
  startAvatarReading();

  try {
    const result = USE_MOCK_GRADING
      ? await getMockGrade()
      : await gradeAnswer(answer);
    stopAvatarReading("smile");
    await wait(500);
    setAvatarFrame("idle");
    renderResults(result, answer);
  } catch (error) {
    console.error(error);
    gradeStatus.textContent = error.message;
    stopAvatarReading("idle");
  } finally {
    setLoading(false);
  }
});

function requestOpenAIKey() {
  if (sessionStorage.getItem("openai_api_key")) return true;

  const apiKey = window.prompt("Enter your OpenAI API key. It will be kept only in this browser tab:");
  const normalizedKey = apiKey?.trim();
  if (!normalizedKey) return false;

  sessionStorage.setItem("openai_api_key", normalizedKey);
  return true;
}

function setAvatarFrame(frame) {
  submitAvatar.src = AVATAR_FRAMES[frame];
}

function startAvatarReading() {
  window.clearTimeout(avatarReadingTimer);
  isAvatarReading = true;

  const sequence = [
    ["readingLeft", 260],
    ["readingMid", 220],
    ["readingRight", 120],
  ];
  let index = 0;

  const showNextFrame = () => {
    const [frame, duration] = sequence[index];
    setAvatarFrame(frame);
    index = (index + 1) % sequence.length;
    avatarReadingTimer = window.setTimeout(showNextFrame, duration);
  };

  showNextFrame();
}

function stopAvatarReading(finalFrame = "idle") {
  window.clearTimeout(avatarReadingTimer);
  isAvatarReading = false;
  setAvatarFrame(finalFrame);
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function gradeAnswer(answer) {
  const openAIApiKey = sessionStorage.getItem("openai_api_key");
  if (!openAIApiKey) {
    throw new Error("OpenAI API key is not configured.");
  }

  const transcriptNote = LESSON_CONTEXT.transcript
    ? LESSON_CONTEXT.transcript
    : "No timestamped transcript has been supplied yet. Treat the coverage score as provisional and do not invent missed timestamps.";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAIApiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      store: false,
      reasoning: { effort: "minimal" },
      max_output_tokens: 700,
      instructions: [
        "You are a supportive English teacher grading a learner's video recap.",
        "Identify real grammar mistakes and phrases that are correct but could sound more natural.",
        "English contains the original and improved phrases. Ukrainian briefly explains why.",
        "Score coverage, grammar, vocabulary, naturalness, and overall performance from 0 to 100.",
        "Keep the summary under 50 words and return no more than 3 corrections and 3 missed points.",
        "If no transcript is available, make coverage provisional and return no invented missed points or timestamps.",
      ].join(" "),
      input: `Lesson: ${LESSON_CONTEXT.title} by ${LESSON_CONTEXT.speaker}\n\nReference transcript:\n${transcriptNote}\n\nLearner answer:\n${answer}`,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "recap_grade",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              coverage: { type: "integer", minimum: 0, maximum: 100 },
              grammar: { type: "integer", minimum: 0, maximum: 100 },
              vocabulary: { type: "integer", minimum: 0, maximum: 100 },
              naturalness: { type: "integer", minimum: 0, maximum: 100 },
              overall: { type: "integer", minimum: 0, maximum: 100 },
              summary: { type: "string" },
              corrections: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    original: { type: "string" },
                    corrected: { type: "string" },
                    explanation_uk: { type: "string" },
                  },
                  required: ["original", "corrected", "explanation_uk"],
                },
              },
              missed_points: {
                type: "array",
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    point: { type: "string" },
                    start_seconds: { type: "integer", minimum: 0 },
                    suggestion: { type: "string" },
                  },
                  required: ["point", "start_seconds", "suggestion"],
                },
              },
            },
            required: [
              "coverage",
              "grammar",
              "vocabulary",
              "naturalness",
              "overall",
              "summary",
              "corrections",
              "missed_points",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const message = errorBody.error?.message || `OpenAI request failed (${response.status}).`;
    if (response.status === 401) {
      sessionStorage.removeItem("openai_api_key");
      throw new Error(`${message} Submit again to enter a new API key.`);
    }
    throw new Error(message);
  }

  const data = await response.json();
  const outputText = data.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;

  if (!outputText) {
    throw new Error("OpenAI returned no grade. Please try again.");
  }

  return JSON.parse(outputText);
}

function getMockGrade() {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve({
        coverage: 82,
        grammar: 74,
        vocabulary: 78,
        naturalness: 71,
        overall: 77,
        summary: "You explained the central idea clearly. Your answer is easy to follow, but a few grammar choices and phrases can sound more natural.",
        corrections: [
          {
            original: "People will respects you when you are confident.",
            corrected: "People will respect you when you are confident.",
            explanation_uk: "Після will використовується базова форма дієслова без закінчення -s.",
          },
          {
            original: "She said about the importance of keeping promises.",
            corrected: "She talked about the importance of keeping your promises.",
            explanation_uk: "Talk about звучить природніше в цьому контексті, а keeping your promises — точніше формулювання.",
          },
        ],
        missed_points: [
          {
            point: "The speaker also explains that respecting your own boundaries affects how others treat you.",
            start_seconds: 48,
            suggestion: "You could add that self-respect and clear boundaries influence the respect we receive from other people.",
          },
        ],
      });
    }, 650);
  });
}

function renderResults(result, answer) {
  submittedAnswer.textContent = answer;
  const corrections = result.corrections || [];
  renderCorrections(corrections);
  renderMissedPoints(result.missed_points || []);
  renderScores(result);

  recapHeader.classList.add("is-hidden");
  recapForm.classList.add("is-hidden");
  resultsView.classList.remove("is-hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCorrections(corrections) {
  correctionList.replaceChildren();
  let itemNumber = 0;

  corrections.forEach((correction) => {
    itemNumber += 1;
    const item = createCorrectionItem(
      itemNumber,
      correction.original,
      correction.corrected,
      correction.explanation_uk,
    );
    correctionList.append(item);
  });

  if (!itemNumber) {
    const empty = document.createElement("p");
    empty.className = "empty-feedback";
    empty.textContent = "Great job — no important corrections were found.";
    correctionList.append(empty);
  }
}

function renderMissedPoints(missedPoints) {
  missedList.replaceChildren();

  missedPoints.forEach((point, index) => {
    const item = document.createElement("article");
    item.className = "correction-item missed-item";

    const number = document.createElement("p");
    number.className = "correction-number";
    number.textContent = `#${String(index + 1).padStart(2, "0")}`;

    const thought = document.createElement("div");
    thought.className = "missed-thought";
    thought.textContent = point.point;

    const explanation = document.createElement("p");
    explanation.className = "correction-explanation missed-explanation";
    explanation.textContent = "Цю думку варто було додати до переказу.";

    const timestamp = document.createElement("button");
    timestamp.className = "timestamp-button";
    timestamp.type = "button";
    timestamp.textContent = formatTime(point.start_seconds);
    timestamp.addEventListener("click", () => playVideoAt(point.start_seconds));

    const meta = document.createElement("div");
    meta.className = "missed-meta";
    meta.append(timestamp, explanation);

    item.append(number, thought, meta);
    missedList.append(item);
  });

  if (!missedPoints.length) {
    const empty = document.createElement("p");
    empty.className = "empty-feedback";
    empty.textContent = "Great job — you covered all the important ideas.";
    missedList.append(empty);
  }
}

function createCorrectionItem(number, original, improved, explanation) {
  const item = document.createElement("article");
  item.className = "correction-item";

  const label = document.createElement("p");
  label.className = "correction-number";
  label.textContent = `#${String(number).padStart(2, "0")}`;

  const originalCard = document.createElement("div");
  originalCard.className = "correction-card correction-card-original";
  originalCard.textContent = original;

  const improvedCard = document.createElement("div");
  improvedCard.className = "correction-card correction-card-improved";
  improvedCard.textContent = improved;

  const why = document.createElement("p");
  why.className = "correction-explanation";
  why.textContent = explanation;

  item.append(label, originalCard, improvedCard, why);
  return item;
}

function renderScores(result) {
  scoreList.replaceChildren();

  const summary = document.createElement("p");
  summary.className = "score-summary";
  summary.textContent = result.summary;
  scoreList.append(summary);

  [
    ["Total score", result.overall],
    ["Coverage", result.coverage],
    ["Grammar", result.grammar],
    ["Vocabulary", result.vocabulary],
    ["Naturalness", result.naturalness],
  ].forEach(([label, value]) => scoreList.append(createScoreRow(label, value)));
}

function createScoreRow(label, value) {
  const row = document.createElement("div");
  row.className = "score-row";

  const dot = document.createElement("canvas");
  dot.className = "score-dot";
  dot.width = 64;
  dot.height = 64;
  dot.setAttribute("aria-hidden", "true");
  drawScoreRing(dot, value);

  const name = document.createElement("span");
  name.className = "score-label";
  name.textContent = label;

  const score = document.createElement("strong");
  score.className = "score-value";
  score.textContent = (value / 10).toFixed(1);

  const suffix = document.createElement("span");
  suffix.textContent = " /10";
  score.append(suffix);

  row.append(dot, name, score);
  return row;
}

function scoreColor(value) {
  return value > 80 ? "#63E214" : "#F5AF2D";
}

function drawScoreRing(canvas, value) {
  const context = canvas.getContext("2d");
  const center = canvas.width / 2;
  const radius = 24;
  const startAngle = -Math.PI / 2;
  const progress = Math.max(0, Math.min(100, value)) / 100;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.lineWidth = 12;
  context.lineCap = "butt";

  context.beginPath();
  context.strokeStyle = "#D8CAAF";
  context.arc(center, center, radius, 0, Math.PI * 2);
  context.stroke();

  if (progress > 0) {
    context.beginPath();
    context.strokeStyle = scoreColor(value);
    context.arc(center, center, radius, startAngle, startAngle + Math.PI * 2 * progress);
    context.stroke();
  }
}

function playVideoAt(seconds) {
  videoFrame.src = `https://www.youtube.com/embed/${VIDEO_ID}?rel=0&playsinline=1&autoplay=1&start=${Math.max(0, seconds)}`;
  video.classList.add("is-playing");
  video.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function shareResult() {
  const scoreText = Array.from(scoreList.querySelectorAll(".score-row"))
    .map((row) => `${row.querySelector(".score-label").textContent}: ${row.querySelector(".score-value").textContent}`)
    .join("\n");
  const text = `My video recap result\n\n${scoreText}`;

  if (navigator.share) {
    try {
      await navigator.share({ title: "My video recap result", text });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  } else {
    const copyField = document.createElement("textarea");
    copyField.value = text;
    copyField.setAttribute("readonly", "");
    copyField.style.position = "fixed";
    copyField.style.opacity = "0";
    document.body.append(copyField);
    copyField.select();
    document.execCommand("copy");
    copyField.remove();
  }
  const originalText = shareResultButton.querySelector("span").textContent;
  shareResultButton.querySelector("span").textContent = "Result copied!";
  window.setTimeout(() => {
    shareResultButton.querySelector("span").textContent = originalText;
  }, 1600);
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  recapField.disabled = isLoading;
  gradeStatus.textContent = isLoading ? "Checking your answer…" : gradeStatus.textContent;
}
