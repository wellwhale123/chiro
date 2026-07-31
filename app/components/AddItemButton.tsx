"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ItemFormModal } from "./ItemFormModal";
import type { DbKey } from "@/lib/dbFields";

export function AddItemButton({ dbKey }: { dbKey: DbKey }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-xl border border-[#1E3A8A]/30 bg-white px-4 py-2 text-xs font-bold tracking-wide text-[#1E3A8A] shadow-sm transition hover:bg-blue-50"
      >
        <Plus className="h-3.5 w-3.5" />
        추가
      </button>
      {open && <ItemFormModal dbKey={dbKey} mode="create" onClose={() => setOpen(false)} />}
    </>
  );
}
