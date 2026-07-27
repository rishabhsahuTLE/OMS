interface PlaceholderPageProps {
  title: string;
  note?: string;
}

export default function PlaceholderPage({ title, note }: PlaceholderPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-center">
      <h2 className="text-lg font-semibold text-slate-700">{title}</h2>
      <p className="mt-1 max-w-sm text-sm text-slate-400">
        {note ?? "This section will be built out in a later iteration."}
      </p>
    </div>
  );
}
