import "server-only";

export type ShiftImageStaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type ShiftImageExtraction = {
  employeeName: string;
  date: string;
  startTime: string;
  endTime: string;
  confidence: number;
  notes: string;
};

type ShiftImageParseInput = {
  imageBase64: string;
  mimeType: string;
  barName: string;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  members: ShiftImageStaffMember[];
};

const SHIFT_IMPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    shifts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          employeeName: { type: "string" },
          date: { type: "string" },
          startTime: { type: "string" },
          endTime: { type: "string" },
          confidence: { type: "number" },
          notes: { type: "string" },
        },
        required: ["employeeName", "date", "startTime", "endTime", "confidence", "notes"],
      },
    },
  },
  required: ["shifts"],
} as const;

function stripCodeFences(value: string) {
  const trimmed = value.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```(?:json)?/i, "")
      .replace(/```$/, "")
      .trim();
  }

  return trimmed;
}

function extractTextFromOpenAiResponse(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as {
    output_text?: unknown;
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: unknown }>;
    }>;
  };

  if (typeof record.output_text === "string" && record.output_text.trim().length > 0) {
    return record.output_text;
  }

  const pieces: string[] = [];

  for (const item of record.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim().length > 0) {
        pieces.push(content.text);
      }
    }
  }

  return pieces.join("\n").trim();
}

function normalizeExtractionItem(item: Partial<ShiftImageExtraction>): ShiftImageExtraction | null {
  const employeeName = String(item.employeeName ?? "").trim();
  const date = String(item.date ?? "").trim();
  const startTime = String(item.startTime ?? "").trim();
  const endTime = String(item.endTime ?? "").trim();
  const confidence = Number(item.confidence ?? 0);
  const notes = String(item.notes ?? "").trim();

  if (!employeeName || !date || !/^(\d{4})-(\d{2})-(\d{2})$/.test(date)) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTime)) {
    return null;
  }

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTime)) {
    return null;
  }

  return {
    employeeName,
    date,
    startTime,
    endTime,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    notes,
  };
}

export async function parseShiftImageWithOpenAI({
  imageBase64,
  mimeType,
  barName,
  rangeStart,
  rangeEnd,
  members,
}: ShiftImageParseInput): Promise<ShiftImageExtraction[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY mancante. Inserisci la chiave per analizzare la foto.");
  }

  const staffList = members
    .map((member) => `- ${member.firstName} ${member.lastName} (${member.role})`)
    .join("\n");

  const prompt = [
    `Stai leggendo una foto di un foglio turni per ${barName}.`,
    "Estrai solo i turni visibili e restituisci esclusivamente JSON valido.",
    "Ogni turno deve contenere: employeeName, date (YYYY-MM-DD), startTime (HH:MM), endTime (HH:MM), confidence (0-1), notes (stringa).",
    "Se il foglio usa giorni della settimana, inferisci la data corretta dentro il range dato.",
    "Se il nome e' scritto in modo poco chiaro, usa la forma piu vicina possibile a quella visibile e tieni confidence bassa.",
    "Non creare turni se non sei reasonably certain della data o degli orari.",
    "Se un orario attraversa la mezzanotte, mantieni comunque la data del giorno del turno solo se e' chiaramente indicato nel foglio.",
    `Range data: ${rangeStart ?? "non specificato"} -> ${rangeEnd ?? "non specificato"}.`,
    staffList ? `Personale disponibile:\n${staffList}` : "Personale disponibile non fornito.",
    "Se non trovi turni leggibili, restituisci {\"shifts\":[]}.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: "Sei un OCR per turni. Devi restituire solo dati strutturati e mai testo libero.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`,
              detail: "high",
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "shift_import_result",
          schema: SHIFT_IMPORT_SCHEMA,
          strict: true,
        },
      },
      max_output_tokens: 1800,
    }),
  });

  const rawPayload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (rawPayload && typeof rawPayload === "object" && "error" in rawPayload
        ? String((rawPayload as { error?: { message?: string } }).error?.message ?? "")
        : "") || `OpenAI error ${response.status}`;
    throw new Error(message);
  }

  const rawText = stripCodeFences(extractTextFromOpenAiResponse(rawPayload));

  if (!rawText) {
    throw new Error("Il modello non ha restituito dati leggibili.");
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("Impossibile interpretare il risultato dell'OCR.");
    }

    parsed = JSON.parse(rawText.slice(jsonStart, jsonEnd + 1));
  }

  const shifts = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { shifts?: unknown })?.shifts)
      ? ((parsed as { shifts: Array<Partial<ShiftImageExtraction>> }).shifts as Array<
          Partial<ShiftImageExtraction>
        >)
      : [];

  return shifts
    .map((item) => normalizeExtractionItem(item))
    .filter((item): item is ShiftImageExtraction => Boolean(item));
}
