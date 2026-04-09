interface Props {
  password: string;
}

const rules = [
  { test: (p: string) => p.length >= 8, label: '8자 이상' },
  { test: (p: string) => /[A-Za-z]/.test(p), label: '영문 포함' },
  { test: (p: string) => /[0-9]/.test(p), label: '숫자 포함' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p), label: '특수문자 포함' },
];

export default function PasswordChecklist({ password }: Props) {
  if (!password) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {rules.map((r, i) => {
        const ok = r.test(password);
        return (
          <span
            key={i}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition ${
              ok
                ? 'border-success/40 text-success bg-success/10'
                : 'border-border text-muted-foreground bg-surface2'
            }`}
          >
            {ok ? '✓' : '○'} {r.label}
          </span>
        );
      })}
    </div>
  );
}
