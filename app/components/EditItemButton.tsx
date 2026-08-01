"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { ItemFormModal, type ItemFormValues } from "./ItemFormModal";
import type { DbKey } from "@/lib/dbFields";

export function EditItemButton({
  dbKey,
  pageId,
  initialValues,
  existingPhotoUrls,
  className,
}: {
  dbKey: DbKey;
  pageId: string;
  initialValues: Partial<ItemFormValues>;
  existingPhotoUrls?: string[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="수정"
        className={
          className ??
          "absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-[#1E3A8A]"
        }
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      {open && (
        <ItemFormModal
          dbKey={dbKey}
          mode="edit"
          pageId={pageId}
          initialValues={initialValues}
          existingPhotoUrls={existingPhotoUrls}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
