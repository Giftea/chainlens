"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Eye,
  Pencil,
  Coins,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { AnalyzedABI, AnalyzedFunction } from "@/lib/abiAnalyzer";

interface FunctionListProps {
  analyzedABI: AnalyzedABI;
  selectedFunction: AnalyzedFunction | null;
  onSelectFunction: (func: AnalyzedFunction) => void;
}

const CATEGORY_CONFIG = {
  read: {
    label: "Read Functions",
    icon: Eye,
    dotColor: "bg-green-500",
    iconColor: "text-green-500",
  },
  write: {
    label: "Write Functions",
    icon: Pencil,
    dotColor: "bg-orange-500",
    iconColor: "text-orange-500",
  },
  payable: {
    label: "Payable Functions",
    icon: Coins,
    dotColor: "bg-red-500",
    iconColor: "text-red-500",
  },
} as const;

export function FunctionList({
  analyzedABI,
  selectedFunction,
  onSelectFunction,
}: FunctionListProps) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const filtered = useMemo(() => {
    if (!search.trim()) return analyzedABI.functions;
    const q = search.toLowerCase();
    return analyzedABI.functions.filter((fn) =>
      fn.name.toLowerCase().includes(q)
    );
  }, [analyzedABI.functions, search]);

  const grouped = useMemo(() => {
    const groups: Record<string, AnalyzedFunction[]> = {
      read: [],
      write: [],
      payable: [],
    };
    for (const fn of filtered) {
      groups[fn.category].push(fn);
    }
    return groups;
  }, [filtered]);

  const toggleCollapse = (category: string) => {
    setCollapsed((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search functions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-8 text-sm"
        />
      </div>

      <div className="space-y-2 overflow-y-auto max-h-[600px] pr-1">
        {(["read", "write", "payable"] as const).map((category) => {
          const funcs = grouped[category];
          if (funcs.length === 0) return null;
          const config = CATEGORY_CONFIG[category];
          const Icon = config.icon;
          const isCollapsed = collapsed[category];

          return (
            <div key={category}>
              <button
                onClick={() => toggleCollapse(category)}
                className="flex items-center gap-2 w-full text-left py-1.5 px-1 hover:bg-muted/50 rounded transition-colors"
              >
                {isCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Icon className={`h-4 w-4 ${config.iconColor}`} />
                <span className="text-sm font-medium">{config.label}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {funcs.length}
                </Badge>
              </button>

              {!isCollapsed && (
                <div className="ml-2 space-y-0.5 mt-1">
                  {funcs.map((fn) => {
                    const isSelected = selectedFunction?.name === fn.name;
                    return (
                      <button
                        key={fn.name}
                        onClick={() => onSelectFunction(fn)}
                        className={`w-full text-left flex items-center gap-2 py-1.5 px-2 rounded text-sm transition-colors ${
                          isSelected
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dotColor}`} />
                        <span className="font-mono text-xs truncate">{fn.name}</span>
                        {fn.inputs.length > 0 && (
                          <Badge variant="outline" className="text-[9px] ml-auto shrink-0">
                            {fn.inputs.length}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">
            {search ? `No functions matching "${search}"` : "No functions found"}
          </p>
        )}
      </div>
    </div>
  );
}
