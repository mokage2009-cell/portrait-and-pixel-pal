import { Check, UserPlus, X } from "lucide-react";

export type SavedProfile = {
  id: string;
  name: string;
  age: number | null;
  bio: string;
};

type Props = {
  profiles: SavedProfile[];
  activeId: string;
  onSelect: (profile: SavedProfile) => void;
  onCreate: () => void;
  onClose: () => void;
};

export function ProfileSwitcher({ profiles, activeId, onSelect, onCreate, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-5" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-switch-title"
        className="max-h-[80dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 id="profile-switch-title" className="text-lg font-bold">プロフィール切替</h2>
          <button onClick={onClose} aria-label="閉じる" className="p-1">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          {profiles.map((profile) => {
            const active = profile.id === activeId;
            return (
              <button
                key={profile.id}
                onClick={() => onSelect(profile)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${active ? "border-primary bg-chip" : "border-border bg-surface"}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold">{profile.name || "名無し"}</span>
                  <span className="text-xs text-muted-foreground">
                    {profile.age === null ? "年齢未設定" : `${profile.age}歳`}
                    {active ? " ・ 使用中" : ""}
                  </span>
                </span>
                {active && <Check className="h-5 w-5 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
        <button
          onClick={onCreate}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary px-4 py-3 font-bold text-primary"
        >
          <UserPlus className="h-5 w-5" />
          新しいプロフィール
        </button>
      </section>
    </div>
  );
}
