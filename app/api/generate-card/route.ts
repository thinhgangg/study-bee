import { NextResponse } from "next/server";

interface DictionaryEntry {
  word?: string;
  phonetic?: string;
  phonetics?: Array<{ text?: string }>;
  meanings?: Array<{
    partOfSpeech?: string;
    synonyms?: string[];
    antonyms?: string[];
    definitions?: Array<{
      definition?: string;
      example?: string;
      synonyms?: string[];
      antonyms?: string[];
    }>;
  }>;
}

interface DictionaryData {
  word: string;
  phonetic: string;
  part_of_speech: string;
  english_definition: string;
  english_example: string;
  synonyms: string[];
  antonyms: string[];
}

interface GeminiCard {
  word: string;
  phonetic: string;
  part_of_speech: string;
  vietnamese_meaning: string;
  english_example: string;
  vietnamese_example: string;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  image_query: string;
}

interface GeminiAttemptError {
  model: string;
  status: number;
  statusText: string;
  message: string | null;
}

const DEFAULT_GEMINI_MODELS = [
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
];

const GEMINI_MODELS = (
  process.env.GEMINI_MODEL
    ? [process.env.GEMINI_MODEL, ...DEFAULT_GEMINI_MODELS]
    : DEFAULT_GEMINI_MODELS
).filter((model, index, models) => models.indexOf(model) === index);

function cleanJsonText(text: string) {
  return text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function getGeminiErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return null;

  const error = (value as Record<string, unknown>).error;
  if (!error || typeof error !== "object") return null;

  const message = (error as Record<string, unknown>).message;
  return typeof message === "string" ? message : null;
}

function normalizeStringArray(value: unknown) {
  const values =
    typeof value === "string"
      ? value.split(/\n|;|\|/)
      : Array.isArray(value)
        ? value
        : [];

  return values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, items) => {
      const normalized = item.toLowerCase();

      return items.findIndex((other) => other.toLowerCase() === normalized) === index;
    });
}

function normalizeAntonyms(value: unknown) {
  const antonyms = normalizeStringArray(value);

  return antonyms.filter((item) => {
    const normalized = item.toLowerCase();

    return ![
      "none",
      "n/a",
      "no common antonym",
      "no natural antonym",
      "not applicable",
      "không có",
      "không có từ trái nghĩa phổ biến",
    ].includes(normalized);
  });
}

function limitItems(items: string[], limit = 5) {
  return items.slice(0, limit);
}

function normalizeGeminiCard(
  value: unknown,
  fallbackWord: string,
  dictionaryData: DictionaryData | null,
): GeminiCard {
  const data = value && typeof value === "object" ? value : {};
  const record = data as Record<string, unknown>;

  return {
    word:
      typeof record.word === "string" && record.word.trim()
        ? record.word.trim()
        : fallbackWord,
    phonetic:
      typeof record.phonetic === "string" && record.phonetic.trim()
        ? record.phonetic.trim()
        : dictionaryData?.phonetic ?? "",
    part_of_speech:
      typeof record.part_of_speech === "string" && record.part_of_speech.trim()
        ? record.part_of_speech.trim()
        : dictionaryData?.part_of_speech ?? "",
    vietnamese_meaning:
      typeof record.vietnamese_meaning === "string"
        ? record.vietnamese_meaning.trim()
        : "",
    english_example:
      typeof record.english_example === "string" && record.english_example.trim()
        ? record.english_example.trim()
        : dictionaryData?.english_example ?? "",
    vietnamese_example:
      typeof record.vietnamese_example === "string"
        ? record.vietnamese_example.trim()
        : "",
    synonyms: limitItems(
      normalizeStringArray(record.synonyms).length > 0
        ? normalizeStringArray(record.synonyms)
        : dictionaryData?.synonyms ?? [],
    ),
    antonyms: limitItems(normalizeAntonyms(record.antonyms)),
    collocations: limitItems(normalizeStringArray(record.collocations), 6),
    image_query:
      typeof record.image_query === "string" && record.image_query.trim()
        ? record.image_query.trim()
        : buildFallbackImageQuery(fallbackWord, dictionaryData),
  };
}

async function fetchDictionaryData(word: string): Promise<DictionaryData | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
    );

    if (!response.ok) {
      return null;
    }

    const entries = (await response.json()) as DictionaryEntry[];
    const entry = entries[0];

    if (!entry) return null;

    const meaning = entry.meanings?.find((item) =>
      item.definitions?.some((definition) => definition.definition),
    );
    const definition = meaning?.definitions?.find((item) => item.definition);

    if (!meaning || !definition?.definition) return null;

    const phonetic =
      entry.phonetic ??
      entry.phonetics?.find((item) => item.text)?.text ??
      "";

    return {
      word: entry.word ?? word,
      phonetic,
      part_of_speech: meaning.partOfSpeech ?? "",
      english_definition: definition.definition,
      english_example: definition.example ?? "",
      synonyms: limitItems(
        normalizeStringArray([
          ...(meaning.synonyms ?? []),
          ...(definition.synonyms ?? []),
        ]),
      ),
      antonyms: limitItems(
        normalizeAntonyms([
          ...(meaning.antonyms ?? []),
          ...(definition.antonyms ?? []),
        ]),
      ),
    };
  } catch (error) {
    console.error("Dictionary API error:", error);
    return null;
  }
}

function buildFallbackImageQuery(
  word: string,
  dictionaryData: DictionaryData | null,
) {
  const partOfSpeech = dictionaryData?.part_of_speech;
  const base = word.trim();

  if (partOfSpeech === "noun") {
    return `${base} concept education`;
  }

  return `${base} visual concept education`;
}

async function generateWithGemini({
  apiKey,
  prompt,
}: {
  apiKey: string;
  prompt: string;
}) {
  const errors: GeminiAttemptError[] = [];

  for (const model of GEMINI_MODELS) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.25,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (response.ok) {
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      return {
        text: data.candidates?.[0]?.content?.parts?.[0]?.text ?? null,
        model,
      };
    }

    const errorBody = await response.json().catch(() => null);
    const error = {
      model,
      status: response.status,
      statusText: response.statusText,
      message: getGeminiErrorMessage(errorBody),
    };

    errors.push(error);
    console.error("Gemini API error:", error);

    if (response.status !== 503) {
      break;
    }
  }

  return { text: null, model: null, errors };
}

function buildPixabayQueries(
  word: string,
  imageQuery: string,
  dictionaryData: DictionaryData | null,
) {
  const cleanImageQuery = imageQuery.trim();
  const hasMultipleTerms = cleanImageQuery.split(/\s+/).length > 1;
  const primary = hasMultipleTerms
    ? cleanImageQuery
    : buildFallbackImageQuery(word, dictionaryData);

  return [
    primary,
    `${word} learning vocabulary concept`,
    `${word} education illustration`,
  ].filter((query, index, queries) => queries.indexOf(query) === index);
}

async function fetchPixabayImages({
  word,
  imageQuery,
  dictionaryData,
}: {
  word: string;
  imageQuery: string;
  dictionaryData: DictionaryData | null;
}) {
  const apiKey = process.env.PIXABAY_API_KEY;
  const imageUrls: string[] = [];

  if (!apiKey) {
    throw new Error("Missing PIXABAY_API_KEY");
  }

  for (const query of buildPixabayQueries(word, imageQuery, dictionaryData)) {
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      image_type: "photo",
      safesearch: "true",
      per_page: "10",
      order: "popular",
    });

    const response = await fetch(`https://pixabay.com/api/?${params.toString()}`);

    if (!response.ok) {
      throw new Error("Pixabay request failed");
    }

    const data = (await response.json()) as {
      hits?: Array<{ webformatURL?: string; largeImageURL?: string }>;
    };
    for (const hit of data.hits ?? []) {
      const imageUrl = hit.webformatURL ?? hit.largeImageURL;

      if (imageUrl && !imageUrls.includes(imageUrl)) {
        imageUrls.push(imageUrl);
      }

      if (imageUrls.length >= 6) {
        return imageUrls;
      }
    }
  }

  return imageUrls;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { word?: unknown };
    const word = typeof body.word === "string" ? body.word.trim() : "";

    if (!word) {
      return NextResponse.json(
        { message: "Vui lòng nhập từ tiếng Anh cần tạo thẻ." },
        { status: 400 },
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      return NextResponse.json(
        { message: "Thiếu GEMINI_API_KEY trong .env.local." },
        { status: 500 },
      );
    }

    const dictionaryData = await fetchDictionaryData(word);

    const prompt = `
Bạn là trợ lý tạo flashcard từ vựng IELTS cho người học Việt Nam.
Từ/cụm từ người dùng nhập: "${word}".

Dữ liệu nền từ Free Dictionary API, có thể null:
${JSON.stringify(dictionaryData, null, 2)}

Chỉ trả về một JSON object hợp lệ, không markdown, không giải thích thêm.
JSON phải đúng cấu trúc:
{
  "word": string,
  "phonetic": string,
  "part_of_speech": string,
  "vietnamese_meaning": string,
  "english_example": string,
  "vietnamese_example": string,
  "synonyms": string[],
  "antonyms": string[],
  "collocations": string[],
  "image_query": string
}

Yêu cầu nội dung:
- Nếu dictionaryData không null, hãy ưu tiên phonetic, part_of_speech và definition từ dictionaryData để tránh bịa nghĩa.
- Nếu dictionaryData null, vẫn tạo flashcard dựa trên từ/cụm từ người dùng nhập. Điều này thường xảy ra với IELTS phrases như "carbon footprint", "renewable energy", "social inequality".
- vietnamese_meaning là bản dịch/giải nghĩa tiếng Việt tự nhiên, ngắn gọn, phù hợp IELTS.
- english_example là ví dụ IELTS tự nhiên, rõ ngữ cảnh học thuật hoặc đời sống.
- vietnamese_example là bản dịch chính xác của english_example.
- synonyms phải là mảng các từ/cụm từ riêng lẻ, tối đa 5 mục. Mỗi item phải kèm nghĩa tiếng Việt theo format: "English synonym — nghĩa tiếng Việt". Không gộp thành một chuỗi dài.
- Ưu tiên synonyms từ dictionaryData nếu phù hợp; có thể bổ sung thêm nhưng không bịa. Nếu dùng synonym từ dictionaryData, vẫn phải thêm nghĩa tiếng Việt vào cùng item.
- antonyms phải là mảng các từ/cụm từ trái nghĩa thật sự, tự nhiên, phổ biến. Mỗi item phải kèm nghĩa tiếng Việt theo format: "English antonym — nghĩa tiếng Việt". Không được bịa antonyms.
- Nếu không có trái nghĩa tự nhiên, đặc biệt với danh từ/cụm danh từ như "medication", "carbon footprint", hãy trả antonyms là [].
- Không trả các giá trị như "none", "N/A", "no antonym"; hãy dùng [].
- collocations phải là mảng 4-6 cụm từ tự nhiên, phổ biến, phù hợp IELTS.
- Mỗi collocation phải kèm nghĩa tiếng Việt theo format: "English collocation — nghĩa tiếng Việt".
- Ví dụ: "prescribe medication — kê thuốc", "chronic insomnia — chứng mất ngủ mãn tính", "reduce inequality — giảm bất bình đẳng".
- Nếu không có collocation rõ ràng, hãy trả collocations là [].
- Không gộp collocations thành một chuỗi dài; mỗi item là một cụm riêng.

Yêu cầu image_query cho Pixabay:
- image_query phải là tiếng Anh, 3-6 từ khóa cụ thể, dễ ra ảnh minh họa đúng nghĩa.
- Không được chỉ là đúng một từ gốc.
- Thêm ngữ cảnh thị giác cụ thể, ví dụ vật thể, nơi chốn, ngành, hoặc tình huống.
- Với từ dễ mơ hồ, tránh keyword gây ảnh sai. Ví dụ "medication" nên là "medicine tablets pharmacy healthcare", không phải "oil capsule".
`;

    const geminiResult = await generateWithGemini({
      apiKey: geminiApiKey,
      prompt,
    });

    if (!geminiResult.text) {
      const lastError = geminiResult.errors?.at(-1);

      return NextResponse.json(
        {
          message: lastError?.message
            ? `Gemini lỗi: ${lastError.message}`
            : "Không thể tạo thẻ bằng Gemini. Vui lòng thử lại.",
        },
        { status: 502 },
      );
    }

    let generatedCard: GeminiCard;

    try {
      generatedCard = normalizeGeminiCard(
        JSON.parse(cleanJsonText(geminiResult.text)),
        word,
        dictionaryData,
      );
    } catch {
      console.error("Invalid Gemini JSON:", geminiResult.text);

      return NextResponse.json(
        { message: "Gemini trả về JSON không hợp lệ. Vui lòng thử lại." },
        { status: 502 },
      );
    }

    let imageOptions: string[] = [];

    try {
      imageOptions = await fetchPixabayImages({
        word,
        imageQuery: generatedCard.image_query,
        dictionaryData,
      });
    } catch (error) {
      console.error("Pixabay error:", error);
    }

    return NextResponse.json({
      word: generatedCard.word,
      phonetic: generatedCard.phonetic,
      part_of_speech: generatedCard.part_of_speech,
      vietnamese_meaning: generatedCard.vietnamese_meaning,
      english_example: generatedCard.english_example,
      vietnamese_example: generatedCard.vietnamese_example,
      synonyms: generatedCard.synonyms,
      antonyms: generatedCard.antonyms,
      collocations: generatedCard.collocations,
      image_url: imageOptions[0] ?? null,
      image_options: imageOptions,
      dictionary_data: dictionaryData,
      generated_by_model: geminiResult.model,
    });
  } catch (error) {
    console.error("Generate card error:", error);

    return NextResponse.json(
      { message: "Có lỗi xảy ra khi tạo thẻ. Vui lòng thử lại." },
      { status: 500 },
    );
  }
}
