"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, Plus, Pause, Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

type AdminPopup = {
  id: string;
  title: string;
  slug: string;
  status: "활성" | "일시중지";
  capacity: number | null;
  deadline: string | null;
};

const inputClass =
  "rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-[#1E3A8A]";
const labelClass = "text-xs font-bold text-slate-500";

function emptyForm() {
  return {
    title: "",
    description: "",
    capacity: "",
    useWaitlist: false,
    deadline: "",
    depositAmount: "",
    applicantDbUrl: "",
    fieldSpec: "이름(타이틀) / 학번(숫자)",
    rosterUrl: "",
    teamSlotCount: "",
    noticeTitle: "",
    autoOpenHome: true,
  };
}

export function PopupAdminPanel() {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "create">("list");
  const [popups, setPopups] = useState<AdminPopup[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

  function loadList() {
    fetch("/api/popups?all=1", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setPopups(data.popups);
        else setListError(data?.error || "목록을 불러오지 못했습니다.");
      })
      .catch(() => setListError("목록을 불러오지 못했습니다."));
  }

  useEffect(() => {
    if (open && view === "list") loadList();
  }, [open, view]);

  function updateForm<K extends keyof ReturnType<typeof emptyForm>>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const deadlineIso = form.deadline ? `${form.deadline}:00+09:00` : "";
      const res = await fetch("/api/popups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          capacity: form.capacity ? Number(form.capacity) : null,
          useWaitlist: form.useWaitlist,
          deadline: deadlineIso,
          depositAmount: form.depositAmount ? Number(form.depositAmount) : null,
          applicantDbUrl: form.applicantDbUrl.trim(),
          fieldSpec: form.fieldSpec.trim(),
          rosterUrl: form.rosterUrl.trim() || undefined,
          teamSlotCount: form.teamSlotCount ? Number(form.teamSlotCount) : null,
          noticeTitle: form.noticeTitle.trim() || undefined,
          autoOpenHome: form.autoOpenHome,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) throw new Error(data?.error || "생성 중 오류가 발생했습니다.");

      setForm(emptyForm());
      setView("list");
      loadList();
      router.refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(popup: AdminPopup) {
    const nextStatus = popup.status === "활성" ? "일시중지" : "활성";
    await fetch(`/api/popups/${popup.slug}/admin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    loadList();
    router.refresh();
  }

  async function handleDelete(popup: AdminPopup) {
    if (!window.confirm(`"${popup.title}" 팝업을 삭제할까요? (연결된 노션 표는 그대로 남습니다)`)) return;
    await fetch(`/api/popups/${popup.slug}/admin`, { method: "DELETE" });
    loadList();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
      >
        팝업 관리
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[300] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8 backdrop-blur-sm sm:px-6"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-white bg-white p-6 shadow-2xl sm:p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-1 text-xs font-bold tracking-widest text-[#1E3A8A] uppercase">Admin</p>
                  <h2 className="text-xl font-black text-slate-800">
                    {view === "list" ? "팝업 관리" : "팝업 생성"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="닫기"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {view === "list" ? (
                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    onClick={() => setView("create")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
                  >
                    <Plus className="h-4 w-4" /> 새 팝업 생성
                  </button>

                  {listError && <p className="text-sm font-medium text-red-600">{listError}</p>}
                  {!listError && popups === null && (
                    <p className="py-4 text-center text-sm text-slate-400">불러오는 중...</p>
                  )}
                  {popups?.length === 0 && (
                    <p className="py-4 text-center text-sm text-slate-400">아직 만든 팝업이 없습니다.</p>
                  )}

                  <div className="flex flex-col gap-2">
                    {popups?.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-slate-800">{p.title}</p>
                          <p className="text-xs text-slate-400">
                            {p.status}
                            {p.capacity ? ` · 정원 ${p.capacity}명` : ""}
                            {p.deadline ? ` · ~${new Date(p.deadline).toLocaleString("ko-KR")}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => toggleStatus(p)}
                            title={p.status === "활성" ? "일시중지" : "재활성화"}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          >
                            {p.status === "활성" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(p)}
                            title="삭제"
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreate} className="flex flex-col gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>팝업 제목</span>
                    <input
                      required
                      type="text"
                      value={form.title}
                      onChange={(e) => updateForm("title", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>안내 문구</span>
                    <textarea
                      value={form.description}
                      onChange={(e) => updateForm("description", e.target.value)}
                      className={`${inputClass} min-h-[70px]`}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1.5">
                      <span className={labelClass}>정원 (비우면 무제한)</span>
                      <input
                        type="number"
                        value={form.capacity}
                        onChange={(e) => updateForm("capacity", e.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <label className="flex items-end gap-2 pb-2.5">
                      <input
                        type="checkbox"
                        checked={form.useWaitlist}
                        onChange={(e) => updateForm("useWaitlist", e.target.checked)}
                        className="h-4 w-4 accent-[#1E3A8A]"
                      />
                      <span className={labelClass}>예비번호 사용</span>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>마감 일시</span>
                    <input
                      required
                      type="datetime-local"
                      value={form.deadline}
                      onChange={(e) => updateForm("deadline", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>입금 금액 (비우면 입금 없음)</span>
                    <input
                      type="number"
                      value={form.depositAmount}
                      onChange={(e) => updateForm("depositAmount", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>연결된 노션 표 링크 (신청자 명단이 쌓일 표)</span>
                    <input
                      required
                      type="url"
                      value={form.applicantDbUrl}
                      onChange={(e) => updateForm("applicantDbUrl", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>신청 표 필드 구성</span>
                    <input
                      required
                      type="text"
                      value={form.fieldSpec}
                      onChange={(e) => updateForm("fieldSpec", e.target.value)}
                      className={inputClass}
                    />
                    <span className="text-[11px] text-slate-400">
                      예: 이름(타이틀) / 학번(숫자) / 입금내역(파일). 타입: 타이틀/텍스트/숫자/파일/체크박스/날짜/리스트:옵션1,옵션2
                      <br />
                      &quot;학과&quot;, &quot;학년&quot; 필드를 추가하면(둘 다 텍스트) 명단에서 자동으로 채워지고 신청자가 직접 입력하지 않습니다.
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>명단 DB 링크 (비우면 통합 부원 명단 사용)</span>
                    <input
                      type="url"
                      value={form.rosterUrl}
                      onChange={(e) => updateForm("rosterUrl", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>팀원 희망 칸 수 (비우면 미사용)</span>
                    <input
                      type="number"
                      value={form.teamSlotCount}
                      onChange={(e) => updateForm("teamSlotCount", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className={labelClass}>공지 제목 (비우면 팝업 제목과 동일)</span>
                    <input
                      type="text"
                      value={form.noticeTitle}
                      onChange={(e) => updateForm("noticeTitle", e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.autoOpenHome}
                      onChange={(e) => updateForm("autoOpenHome", e.target.checked)}
                      className="h-4 w-4 accent-[#1E3A8A]"
                    />
                    <span className={labelClass}>홈페이지 접속 시 자동으로 팝업 띄우기</span>
                  </label>

                  {formError && <p className="text-sm font-medium text-red-600">{formError}</p>}

                  <div className="mt-1 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setView("list")}
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-xl bg-[#1E3A8A] px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-50"
                    >
                      {submitting ? "생성 중..." : "생성하기"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
