export function SectionHeader({
  num,
  title,
  desc,
  action,
}: {
  num: string;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-12 flex flex-col items-center justify-between gap-6 sm:flex-row sm:items-end">
      <div className="flex flex-col items-center text-center sm:items-start sm:text-left">
        <span className="mb-2 text-sm font-black text-[#1E3A8A]" style={{ fontFamily: "var(--font-chakra)" }}>
          0{num}.
        </span>
        <h2 className="text-4xl font-black tracking-tight text-slate-800 md:text-5xl">
          {title}
        </h2>
        <p className="mt-4 max-w-xl text-slate-500">
          {desc}
        </p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
