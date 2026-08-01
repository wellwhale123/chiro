import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getClubIntroSections } from "@/lib/notion";
import { PageBackground, SiteFooter } from "../../components/PageBackground";

export const revalidate = 60;

export default async function ClubIntroPage() {
  const sections = await getClubIntroSections();

  return (
    <PageBackground>
      <div className="mx-auto w-full max-w-3xl px-6 pb-32 pt-20 lg:pt-32">
        <Link
          href="/about"
          className="mb-10 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-[#1E3A8A]"
        >
          <ChevronLeft className="h-4 w-4" />
          소개로 돌아가기
        </Link>

        <p className="mb-3 text-sm font-bold tracking-[0.3em] text-slate-500">중앙대학교 로봇동아리</p>
        <h1
          className="text-5xl font-black tracking-tighter text-slate-800 md:text-6xl"
          style={{ fontFamily: "var(--font-chakra)" }}
        >
          CHI<span className="text-[#1E3A8A]">RO</span>
        </h1>

        {sections.length === 0 ? (
          <div className="mt-14 rounded-2xl border border-dashed border-slate-300 bg-white/40 p-10 text-center text-sm font-medium text-slate-400">
            아직 등록된 소개 내용이 없습니다.
          </div>
        ) : (
          <div className="mt-14 flex flex-col gap-14">
            {sections.map((section) => (
              <IntroSection key={section.id} name={section.name} content={section.content} />
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </PageBackground>
  );
}

function IntroSection({ name, content }: { name: string; content: string }) {
  return (
    <section>
      {name && (
        <h2 className="text-2xl font-black text-slate-800">
          <span className="text-[#1E3A8A]">[</span>
          {name}
          <span className="text-[#1E3A8A]">]</span>
        </h2>
      )}
      <div className="mt-5">
        <ContentBlocks content={content} />
      </div>
    </section>
  );
}

// "- **굵게:** 텍스트" 형태의 글머리 기호와 "**굵게**" 인라인 표기를 해석해서 렌더링합니다.
function ContentBlocks({ content }: { content: string }) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  type Block = { type: "p" | "ul"; lines: string[] };
  const blocks: Block[] = [];

  for (const line of lines) {
    const isBullet = line.startsWith("- ");
    const text = isBullet ? line.slice(2).trim() : line;
    const last = blocks[blocks.length - 1];

    if (isBullet && last?.type === "ul") {
      last.lines.push(text);
    } else if (isBullet) {
      blocks.push({ type: "ul", lines: [text] });
    } else {
      blocks.push({ type: "p", lines: [text] });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, i) =>
        block.type === "ul" ? (
          <ul key={i} className="flex flex-col gap-2.5 pl-5">
            {block.lines.map((line, j) => (
              <li key={j} className="list-disc text-base leading-relaxed text-slate-600 marker:text-[#1E3A8A]">
                {renderInline(line)}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="text-base leading-relaxed text-slate-600">
            {renderInline(block.lines[0])}
          </p>
        )
      )}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-bold text-slate-800">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
