"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ApplyPage() {
  const [formData, setFormData] = useState({
    name: "",
    studentId: "",
    phone: "",
    interest: "",
    grade: "",
    department: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert("지원서 접수가 완료되었습니다!");
        setFormData({
          name: "",
          studentId: "",
          phone: "",
          interest: "",
          grade: "",
          department: "",
        });
      } else {
        alert("전송에 실패했습니다. 관리자에게 문의해주세요.");
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert("통신 중 에러가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-start px-6 pt-10 pb-24 sm:pt-20">
      
      {/* 폼을 감싸는 유리 질감 컨테이너 */}
      <div className="w-full max-w-3xl rounded-[2.5rem] border border-white bg-white/60 p-8 shadow-[0_20px_40px_rgba(0,0,0,0.04)] backdrop-blur-2xl sm:p-14">
        
        {/* 상단 타이틀 영역 */}
        <div className="mb-12 flex flex-col items-center text-center">
          <span className="mb-4 rounded-full bg-blue-50 px-5 py-1.5 text-xs font-black tracking-widest text-[#1E3A8A] uppercase">
            Recruitment Open
          </span>
          <h1 
            className="text-4xl font-black tracking-tight text-slate-800 sm:text-5xl" 
            style={{ fontFamily: "var(--font-chakra)" }}
          >
            CHIRO APPLICATION
          </h1>
          <p className="mt-4 text-sm font-medium text-slate-500 sm:text-base">
            새로운 미래를 함께 조립할 2026학년도 신입 부원을 모집합니다.
          </p>
        </div>

        {/* 폼 입력 영역 */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          
          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="이름">
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="홍길동"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10 placeholder:text-slate-400"
              />
            </Field>

            <Field label="학번">
              <input
                type="text"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                placeholder="20261234"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10 placeholder:text-slate-400"
              />
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="전화번호">
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="010-1234-5678"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10 placeholder:text-slate-400"
              />
            </Field>

            <Field label="관심 분야">
              <select
                name="interest"
                value={formData.interest}
                onChange={handleChange}
                required
                className="w-full appearance-none rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10"
              >
                <option value="" disabled>분야를 선택하세요</option>
                <option value="하드웨어">하드웨어</option>
                <option value="소프트웨어">소프트웨어</option>
                <option value="AI">AI</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field label="현재 학년">
              <input
                type="text"
                name="grade"
                value={formData.grade}
                onChange={handleChange}
                placeholder="예: 1학년"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10 placeholder:text-slate-400"
              />
            </Field>

            <Field label="학과">
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleChange}
                placeholder="예: 전자전기공학부"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/90 px-5 py-4 text-sm font-medium text-slate-800 outline-none transition-all focus:border-[#1E3A8A] focus:ring-4 focus:ring-blue-900/10 placeholder:text-slate-400"
              />
            </Field>
          </div>

          {/* 제출 버튼 영역 */}
          <div className="mt-6 border-t border-slate-200/60 pt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1E3A8A] py-5 text-sm font-bold tracking-widest text-white shadow-xl shadow-blue-900/20 transition-all hover:-translate-y-1 hover:bg-blue-800 hover:shadow-2xl hover:shadow-blue-900/30 disabled:pointer-events-none disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>데이터 전송 중...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 transition-transform group-hover:scale-110" />
                  <span>지원서 제출하기</span>
                </>
              )}
            </button>
          </div>
          
        </form>
      </div>
    </div>
  );
}

// 라벨(Label) 디자인 컴포넌트
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2.5">
      <span className="pl-1 text-xs font-bold tracking-widest text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
