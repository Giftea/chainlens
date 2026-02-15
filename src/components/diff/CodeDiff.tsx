"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronUp,
  ChevronDown,
  Columns2,
  Rows2,
  ChevronsUpDown,
} from "lucide-react";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineNumberA?: number;
  lineNumberB?: number;
}

interface CodeDiffProps {
  lines: DiffLine[];
  fileNameA: string;
  fileNameB: string;
}

const CONTEXT_LINES = 3;

interface DiffHunk {
  lines: DiffLine[];
  isCollapsed: boolean;
  startIndex: number;
}

export function CodeDiff({ lines, fileNameA, fileNameB }: CodeDiffProps) {
  const [viewMode, setViewMode] = useState<"split" | "unified">("split");
  const [expandedHunks, setExpandedHunks] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const changeIndices = useMemo(
    () => lines.reduce<number[]>((acc, line, i) => {
      if (line.type !== "unchanged") acc.push(i);
      return acc;
    }, []),
    [lines]
  );
  const [currentChangeIdx, setCurrentChangeIdx] = useState(0);

  // Build hunks: groups of changes with context, collapsing long unchanged sections
  const hunks = useMemo(() => {
    const result: DiffHunk[] = [];
    let i = 0;

    while (i < lines.length) {
      // Check if this is a change or near one
      const nearChange = changeIndices.some(
        (ci) => Math.abs(ci - i) <= CONTEXT_LINES
      );

      if (nearChange || lines[i].type !== "unchanged") {
        // Collect the hunk: include context lines around changes
        const hunkStart = i;
        const hunkLines: DiffLine[] = [];
        while (i < lines.length) {
          const nextChange = changeIndices.find((ci) => ci >= i);
          if (
            lines[i].type === "unchanged" &&
            nextChange !== undefined &&
            nextChange - i > CONTEXT_LINES * 2
          ) {
            // Add trailing context and break
            for (let c = 0; c < CONTEXT_LINES && i < lines.length; c++, i++) {
              hunkLines.push(lines[i]);
            }
            break;
          }
          if (
            lines[i].type === "unchanged" &&
            nextChange === undefined &&
            i - hunkStart > 0
          ) {
            // Trailing unchanged after last change, add context and break
            for (let c = 0; c < CONTEXT_LINES && i < lines.length; c++, i++) {
              hunkLines.push(lines[i]);
            }
            break;
          }
          hunkLines.push(lines[i]);
          i++;
        }
        result.push({ lines: hunkLines, isCollapsed: false, startIndex: hunkStart });
      } else {
        // Collapsed section of unchanged lines
        const collapsedStart = i;
        const collapsedLines: DiffLine[] = [];
        while (
          i < lines.length &&
          lines[i].type === "unchanged" &&
          !changeIndices.some((ci) => Math.abs(ci - i) <= CONTEXT_LINES)
        ) {
          collapsedLines.push(lines[i]);
          i++;
        }
        if (collapsedLines.length > 0) {
          result.push({
            lines: collapsedLines,
            isCollapsed: true,
            startIndex: collapsedStart,
          });
        }
      }
    }
    return result;
  }, [lines, changeIndices]);

  const toggleHunk = useCallback((startIndex: number) => {
    setExpandedHunks((prev) => {
      const next = new Set(prev);
      if (next.has(startIndex)) next.delete(startIndex);
      else next.add(startIndex);
      return next;
    });
  }, []);

  const jumpToChange = useCallback(
    (direction: "next" | "prev") => {
      if (changeIndices.length === 0) return;
      let nextIdx = currentChangeIdx;
      if (direction === "next") {
        nextIdx = (currentChangeIdx + 1) % changeIndices.length;
      } else {
        nextIdx =
          (currentChangeIdx - 1 + changeIndices.length) % changeIndices.length;
      }
      setCurrentChangeIdx(nextIdx);
      // Scroll to the change
      const lineIdx = changeIndices[nextIdx];
      const el = document.getElementById(`diff-line-${lineIdx}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [changeIndices, currentChangeIdx]
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        jumpToChange("next");
      }
      if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        jumpToChange("prev");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [jumpToChange]);

  const changeCount = changeIndices.length;
  const addedCount = lines.filter((l) => l.type === "added").length;
  const removedCount = lines.filter((l) => l.type === "removed").length;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "split" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("split")}
            className="h-7 text-xs hidden md:flex"
          >
            <Columns2 className="h-3 w-3 mr-1" />
            Split
          </Button>
          <Button
            variant={viewMode === "unified" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("unified")}
            className="h-7 text-xs"
          >
            <Rows2 className="h-3 w-3 mr-1" />
            Unified
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            <span className="text-green-500 mr-1">+{addedCount}</span>
            <span className="text-red-500">-{removedCount}</span>
          </Badge>

          {changeCount > 0 && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => jumpToChange("prev")}
                className="h-6 w-6 p-0"
                title="Previous change"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[50px] text-center">
                {currentChangeIdx + 1}/{changeCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => jumpToChange("next")}
                className="h-6 w-6 p-0"
                title="Next change"
              >
                <ChevronDown className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Diff content */}
      <div
        ref={scrollRef}
        className="border rounded-lg overflow-hidden bg-[#0d1117] text-sm font-mono"
      >
        {/* File headers */}
        {viewMode === "split" ? (
          <div className="hidden md:grid grid-cols-2 border-b border-border/30 sticky top-0 z-10 bg-[#161b22]">
            <div className="px-3 py-2 text-xs text-red-400 border-r border-border/30 truncate">
              {fileNameA}
            </div>
            <div className="px-3 py-2 text-xs text-green-400 truncate">
              {fileNameB}
            </div>
          </div>
        ) : (
          <div className="border-b border-border/30 sticky top-0 z-10 bg-[#161b22]">
            <div className="px-3 py-2 text-xs text-muted-foreground flex gap-3">
              <span className="text-red-400">{fileNameA}</span>
              <span className="text-muted-foreground">{"->"}</span>
              <span className="text-green-400">{fileNameB}</span>
            </div>
          </div>
        )}

        {/* Lines */}
        <div className="overflow-auto max-h-[600px]">
          {hunks.map((hunk, hunkIdx) => {
            if (hunk.isCollapsed && !expandedHunks.has(hunk.startIndex)) {
              return (
                <button
                  key={`hunk-${hunkIdx}`}
                  onClick={() => toggleHunk(hunk.startIndex)}
                  className="w-full flex items-center justify-center gap-2 py-1.5 bg-[#1c2128] hover:bg-[#262c36] text-xs text-muted-foreground border-y border-border/20 transition-colors"
                >
                  <ChevronsUpDown className="h-3 w-3" />
                  <span>
                    {hunk.lines.length} unchanged line{hunk.lines.length !== 1 ? "s" : ""}
                  </span>
                </button>
              );
            }

            const displayLines = hunk.isCollapsed
              ? hunk.lines
              : hunk.lines;

            if (viewMode === "split") {
              return (
                <SplitView
                  key={`hunk-${hunkIdx}`}
                  lines={displayLines}
                  startIndex={hunk.startIndex}
                />
              );
            }

            return (
              <UnifiedView
                key={`hunk-${hunkIdx}`}
                lines={displayLines}
                startIndex={hunk.startIndex}
              />
            );
          })}

          {lines.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              No source code differences found
            </div>
          )}
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        <span>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[9px]">Ctrl+N</kbd> Next change
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[9px]">Ctrl+P</kbd> Previous change
        </span>
      </div>
    </div>
  );
}

// ============================================================
//                 SPLIT VIEW (side-by-side)
// ============================================================

function SplitView({
  lines,
  startIndex,
}: {
  lines: DiffLine[];
  startIndex: number;
}) {
  // Pair up lines: removed on left, added on right, unchanged on both
  const pairs: {
    left: DiffLine | null;
    right: DiffLine | null;
    globalIdx: number;
  }[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === "unchanged") {
      pairs.push({ left: line, right: line, globalIdx: startIndex + i });
      i++;
    } else if (line.type === "removed") {
      // Collect consecutive removed, then pair with consecutive added
      const removed: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "removed") {
        removed.push(lines[i]);
        i++;
      }
      const added: DiffLine[] = [];
      while (i < lines.length && lines[i].type === "added") {
        added.push(lines[i]);
        i++;
      }
      const maxLen = Math.max(removed.length, added.length);
      for (let j = 0; j < maxLen; j++) {
        pairs.push({
          left: removed[j] || null,
          right: added[j] || null,
          globalIdx: startIndex + (i - maxLen + j),
        });
      }
    } else if (line.type === "added") {
      pairs.push({
        left: null,
        right: line,
        globalIdx: startIndex + i,
      });
      i++;
    }
  }

  return (
    <div className="hidden md:block">
      {pairs.map((pair, idx) => (
        <div
          key={idx}
          id={`diff-line-${pair.globalIdx}`}
          className="grid grid-cols-2"
        >
          <SplitLine line={pair.left} side="left" />
          <SplitLine line={pair.right} side="right" />
        </div>
      ))}
    </div>
  );
}

function SplitLine({
  line,
  side,
}: {
  line: DiffLine | null;
  side: "left" | "right";
}) {
  if (!line) {
    return (
      <div
        className={`flex ${
          side === "left" ? "border-r border-border/20" : ""
        } bg-[#0d1117]/50`}
      >
        <div className="w-10 shrink-0 text-right pr-2 py-0.5 text-[11px] text-muted-foreground/30 select-none" />
        <div className="flex-1 py-0.5 px-2" />
      </div>
    );
  }

  const lineNum = side === "left" ? line.lineNumberA : line.lineNumberB;
  const bgColor =
    line.type === "removed"
      ? "bg-red-500/10"
      : line.type === "added"
      ? "bg-green-500/10"
      : "";
  const textColor =
    line.type === "removed"
      ? "text-red-300"
      : line.type === "added"
      ? "text-green-300"
      : "text-gray-300";
  const gutterBg =
    line.type === "removed"
      ? "bg-red-500/20"
      : line.type === "added"
      ? "bg-green-500/20"
      : "";

  return (
    <div
      className={`flex ${bgColor} ${
        side === "left" ? "border-r border-border/20" : ""
      }`}
    >
      <div
        className={`w-10 shrink-0 text-right pr-2 py-0.5 text-[11px] text-muted-foreground/50 select-none ${gutterBg}`}
      >
        {lineNum ?? ""}
      </div>
      <div className={`flex-1 py-0.5 px-2 ${textColor} whitespace-pre overflow-x-auto`}>
        {line.type === "removed" && (
          <span className="text-red-400 mr-1 select-none">-</span>
        )}
        {line.type === "added" && (
          <span className="text-green-400 mr-1 select-none">+</span>
        )}
        {line.content}
      </div>
    </div>
  );
}

// ============================================================
//                 UNIFIED VIEW (stacked)
// ============================================================

function UnifiedView({
  lines,
  startIndex,
}: {
  lines: DiffLine[];
  startIndex: number;
}) {
  return (
    <div>
      {lines.map((line, idx) => {
        const bgColor =
          line.type === "removed"
            ? "bg-red-500/10"
            : line.type === "added"
            ? "bg-green-500/10"
            : "";
        const textColor =
          line.type === "removed"
            ? "text-red-300"
            : line.type === "added"
            ? "text-green-300"
            : "text-gray-300";
        const gutterBg =
          line.type === "removed"
            ? "bg-red-500/20"
            : line.type === "added"
            ? "bg-green-500/20"
            : "";
        const prefix =
          line.type === "removed" ? "-" : line.type === "added" ? "+" : " ";

        return (
          <div
            key={idx}
            id={`diff-line-${startIndex + idx}`}
            className={`flex ${bgColor}`}
          >
            <div
              className={`w-10 shrink-0 text-right pr-2 py-0.5 text-[11px] text-muted-foreground/50 select-none ${gutterBg}`}
            >
              {line.lineNumberA ?? ""}
            </div>
            <div
              className={`w-10 shrink-0 text-right pr-2 py-0.5 text-[11px] text-muted-foreground/50 select-none ${gutterBg}`}
            >
              {line.lineNumberB ?? ""}
            </div>
            <div
              className={`flex-1 py-0.5 px-2 ${textColor} whitespace-pre overflow-x-auto`}
            >
              <span
                className={`${
                  line.type !== "unchanged"
                    ? line.type === "removed"
                      ? "text-red-400"
                      : "text-green-400"
                    : "text-transparent"
                } mr-1 select-none`}
              >
                {prefix}
              </span>
              {line.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
