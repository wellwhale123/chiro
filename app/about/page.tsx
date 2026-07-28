export default function AboutPage() {
  return (
    <div className="bg-black text-white">
      <section className="border-b-2 border-slate-800">
        <div aria-hidden className="h-1 w-full bg-blue-600" />
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h1
            className="leading-none font-bold tracking-tight text-[clamp(4.5rem,12vw,10rem)] text-white"
            style={{ fontFamily: "var(--font-chakra)" }}
          >
            BOARD
          </h1>
          <h1
            className="leading-none font-bold tracking-tight text-[clamp(4.5rem,12vw,10rem)] text-blue-600"
            style={{ fontFamily: "var(--font-chakra)" }}
          >
            MEMBERS
          </h1>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="min-h-28 border border-blue-600 bg-black transition duration-200 hover:bg-blue-600/10"
              />
            ))}
          </div>
        </div>
        <div aria-hidden className="h-1 w-full bg-blue-600" />
      </section>
    </div>
  );
}

