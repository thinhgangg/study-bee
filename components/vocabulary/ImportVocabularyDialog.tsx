"use client";

import { useMemo, useRef, useState } from "react";
import {
  CircleHelp,
  Download,
  FileSpreadsheet,
  Trash2,
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

const headers = [
  "word",
  "phonetic",
  "part_of_speech",
  "vietnamese_meaning",
  "english_example",
  "vietnamese_example",
  "synonyms",
  "antonyms",
  "collocations",
  "image_url",
] as const;

type ImportHeader = (typeof headers)[number];

interface ImportRow {
  sourceRow: number;
  word: string;
  phonetic: string | null;
  part_of_speech: string | null;
  vietnamese_meaning: string;
  english_example: string | null;
  vietnamese_example: string | null;
  synonyms: string[];
  antonyms: string[];
  collocations: string[];
  image_url: string | null;
}

interface SkippedRow {
  sourceRow: number;
  reason: string;
}

export function ImportVocabularyDialog({
  deckId,
  onImported,
}: {
  deckId: string;
  onImported: () => void | Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [skippedRows, setSkippedRows] = useState<SkippedRow[]>([]);
  const [headerError, setHeaderError] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState("");

  const canConfirm = rows.length > 0 && !headerError && !saving;

  const previewLabel = useMemo(() => {
    if (!rows.length && !skippedRows.length) return "Chưa có dữ liệu preview";
    return `${rows.length} dòng hợp lệ, ${skippedRows.length} dòng bị skip`;
  }, [rows.length, skippedRows.length]);

  function resetImport() {
    setFileName("");
    setRows([]);
    setSkippedRows([]);
    setHeaderError("");
    setResult("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const sample = [
      headers.join(","),
      [
        "sleep deprivation",
        "/sli:p depriveishn/",
        "noun",
        "thiếu ngủ",
        "Sleep deprivation affects concentration.",
        "Thiếu ngủ ảnh hưởng đến sự tập trung.",
        "lack of sleep;insufficient sleep",
        "rest",
        "chronic sleep deprivation;suffer from sleep deprivation",
        "",
      ]
        .map(escapeCsvCell)
        .join(","),
    ].join("\n");

    const blob = new Blob([`\uFEFF${sample}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "studybee-vocabulary-template.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;

    setFileName(file.name);
    setHeaderError("");
    setResult("");

    try {
      const isCsv = file.name.toLowerCase().endsWith(".csv");
      const workbook = isCsv
        ? XLSX.read(await file.text(), { type: "string" })
        : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];

      if (!firstSheetName) {
        setHeaderError("File không có sheet dữ liệu.");
        setRows([]);
        setSkippedRows([]);
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<string[]>(sheet, {
        header: 1,
        defval: "",
        blankrows: false,
      });

      parseMatrix(matrix);
    } catch (err: unknown) {
      setHeaderError(
        err instanceof Error ? err.message : "Không thể đọc file.",
      );
      setRows([]);
      setSkippedRows([]);
    }
  }

  function parseMatrix(matrix: string[][]) {
    const rawHeader = matrix[0]?.map((value) => String(value).trim()) ?? [];
    const missingHeaders = headers.filter(
      (header) => !rawHeader.includes(header),
    );

    if (missingHeaders.length > 0) {
      setHeaderError(`Thiếu cột bắt buộc: ${missingHeaders.join(", ")}`);
      setRows([]);
      setSkippedRows([]);
      return;
    }

    const indexes = Object.fromEntries(
      headers.map((header) => [header, rawHeader.indexOf(header)]),
    ) as Record<ImportHeader, number>;
    const validRows: ImportRow[] = [];
    const skipped: SkippedRow[] = [];

    matrix.slice(1).forEach((rawRow, index) => {
      const sourceRow = index + 2;
      const getValue = (header: ImportHeader) =>
        String(rawRow[indexes[header]] ?? "").trim();
      const word = getValue("word");
      const vietnameseMeaning = getValue("vietnamese_meaning");

      if (!word) {
        skipped.push({ sourceRow, reason: "Thiếu word" });
        return;
      }

      if (!vietnameseMeaning) {
        skipped.push({ sourceRow, reason: "Thiếu vietnamese_meaning" });
        return;
      }

      validRows.push({
        sourceRow,
        word,
        phonetic: nullable(getValue("phonetic")),
        part_of_speech: nullable(getValue("part_of_speech")),
        vietnamese_meaning: vietnameseMeaning,
        english_example: nullable(getValue("english_example")),
        vietnamese_example: nullable(getValue("vietnamese_example")),
        synonyms: splitList(getValue("synonyms")),
        antonyms: splitList(getValue("antonyms")),
        collocations: splitList(getValue("collocations")),
        image_url: nullable(getValue("image_url")),
      });
    });

    setRows(validRows);
    setSkippedRows(skipped);
  }

  function removeRow(sourceRow: number) {
    setRows((current) => current.filter((row) => row.sourceRow !== sourceRow));
  }

  async function handleConfirm() {
    if (!canConfirm) return;

    setSaving(true);
    setResult("");

    try {
      const { data: orderRows, error: orderError } = await supabase
        .from("cards")
        .select("order_index")
        .eq("deck_id", deckId)
        .order("order_index", { ascending: false, nullsFirst: false })
        .limit(1);

      if (orderError) throw orderError;

      const maxOrderIndex =
        typeof orderRows?.[0]?.order_index === "number"
          ? orderRows[0].order_index
          : -1;
      const payload = rows.map((row, index) => ({
        deck_id: deckId,
        word: row.word,
        phonetic: row.phonetic,
        part_of_speech: row.part_of_speech,
        vietnamese_meaning: row.vietnamese_meaning,
        english_example: row.english_example,
        vietnamese_example: row.vietnamese_example,
        synonyms: row.synonyms,
        antonyms: row.antonyms,
        collocations: row.collocations,
        image_url: row.image_url,
        order_index: maxOrderIndex + index + 1,
      }));

      const { error: insertError } = await supabase
        .from("cards")
        .insert(payload);
      if (insertError) throw insertError;

      setResult(
        `Thêm thành công ${payload.length} từ, skip ${skippedRows.length} dòng.`,
      );
      setRows([]);
      await onImported();
    } catch (err: unknown) {
      setResult(
        err instanceof Error ? err.message : "Không thể import dữ liệu.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) resetImport();
        }}
      >
        <DialogTrigger asChild>
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-yellow-50"
          >
            <Upload className="h-4 w-4 text-yellow-700" />
            Nhập từ vựng
          </button>
        </DialogTrigger>

        <DialogContent className="flex h-[88vh] max-h-[88vh] flex-col overflow-hidden border border-yellow-100 bg-white p-0 shadow-2xl shadow-yellow-100/70 sm:max-w-5xl">
          <div className="shrink-0 border-b border-yellow-100 bg-[#FFFBEB] px-5 py-5">
            <DialogHeader>
              <DialogTitle className="font-heading text-2xl font-bold text-gray-900">
                Nhập từ vựng
              </DialogTitle>
            </DialogHeader>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 py-4">
            <div className="shrink-0 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={downloadTemplate}
                className="h-10 gap-2 rounded-full bg-white font-bold"
              >
                <Download className="h-4 w-4" />
                Tải template mẫu
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGuideOpen(true)}
                className="h-10 gap-2 rounded-full bg-white font-bold"
              >
                <CircleHelp className="h-4 w-4" />
                Hướng dẫn
              </Button>
            </div>

            <label className="flex shrink-0 cursor-pointer items-center justify-center gap-3 rounded-2xl border border-dashed border-yellow-300 bg-yellow-50/50 px-5 py-4 text-center transition-colors hover:bg-yellow-50">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
              <FileSpreadsheet className="h-8 w-8 shrink-0 text-yellow-700" />
              <p className="font-bold text-gray-900">
                Chọn file CSV hoặc Excel
              </p>
              <p className="text-sm text-gray-500">
                {fileName || "Hỗ trợ .csv, .xlsx, .xls"}
              </p>
            </label>

            {headerError && (
              <p className="shrink-0 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                {headerError}
              </p>
            )}

            <div className="flex min-h-0 flex-1 flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-bold text-gray-900">Xem trước</p>
                <p className="text-xs font-semibold text-gray-500">
                  {previewLabel}
                </p>
              </div>

              {rows.length > 0 && (
                <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-gray-100">
                  <table className="min-w-[1100px] text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs font-bold text-gray-500">
                      <tr>
                        <th className="px-3 py-2">Dòng</th>
                        <th className="px-3 py-2">Từ</th>
                        <th className="px-3 py-2">Nghĩa</th>
                        <th className="px-3 py-2">Loại từ</th>
                        <th className="px-3 py-2">Ví dụ</th>
                        <th className="px-3 py-2">Từ đồng nghĩa</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((row) => (
                        <tr key={row.sourceRow} className="align-top">
                          <td className="px-3 py-2 text-xs font-bold text-gray-400">
                            {row.sourceRow}
                          </td>
                          <td className="px-3 py-2 font-bold text-gray-900">
                            {row.word}
                          </td>
                          <td className="px-3 py-2 text-amber-700">
                            {row.vietnamese_meaning}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {row.part_of_speech ?? ""}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {row.english_example ?? ""}
                          </td>
                          <td className="px-3 py-2 text-gray-500">
                            {row.synonyms.join("; ")}
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => removeRow(row.sourceRow)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-50"
                              aria-label="Xóa dòng"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {skippedRows.length > 0 && (
                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                  <p className="text-sm font-bold text-amber-800">
                    Dòng bị skip
                  </p>
                  <div className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs font-semibold text-amber-700">
                    {skippedRows.map((row) => (
                      <p key={`${row.sourceRow}-${row.reason}`}>
                        Dòng {row.sourceRow}: {row.reason}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {result && (
                <p className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700">
                  {result}
                </p>
              )}
            </div>
          </div>

          <div className="shrink-0 flex flex-col-reverse gap-2 border-t border-yellow-100 bg-[#FFFBEB] p-4 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="h-10 rounded-full bg-white px-5 font-bold"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="h-10 rounded-full bg-gray-900 px-5 font-bold text-yellow-300 hover:bg-gray-700"
            >
              {saving ? "Đang lưu..." : "Xác nhận"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}

function ImportGuideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-yellow-100 bg-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">
            Hướng dẫn điền file import
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm leading-relaxed text-gray-600">
          <p>
            Header phải đúng tên cột:{" "}
            <span className="font-bold text-gray-900">
              {headers.join(", ")}
            </span>
            .
          </p>
          <div className="grid gap-2 rounded-2xl bg-yellow-50 p-4">
            <p>
              <b>word</b> và <b>vietnamese_meaning</b>: bắt buộc.
            </p>
            <p>
              <b>phonetic</b>, <b>part_of_speech</b>, <b>english_example</b>,{" "}
              <b>vietnamese_example</b>, <b>image_url</b>: có thể để trống.
            </p>
            <p>
              <b>synonyms</b>, <b>antonyms</b>, <b>collocations</b>: nhập nhiều
              mục bằng dấu <b>;</b>.
            </p>
          </div>
          <p className="rounded-2xl border border-gray-100 bg-gray-50 p-3 font-mono text-xs">
            lack of sleep;insufficient sleep;sleep loss
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function splitList(value: string) {
  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nullable(value: string) {
  return value.trim() || null;
}

function escapeCsvCell(value: string) {
  if (!/[",\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
