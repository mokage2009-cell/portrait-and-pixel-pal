import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Profile = { name: string; age: number | null; bio: string };

export function ProfileDialog({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [p, setP] = useState<Profile | null | undefined>(undefined);
  useEffect(() => {
    supabase.from("profiles").select("name,age,bio").eq("id", userId).maybeSingle().then(({ data }) => setP(data));
  }, [userId]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-6" onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-bold">プロフィール</h2>
          <button onClick={onClose} aria-label="閉じる"><X className="h-5 w-5 text-muted-foreground" /></button>
        </div>
        {p === undefined ? (
          <p className="mt-4 text-muted-foreground">読み込み中…</p>
        ) : p === null ? (
          <p className="mt-4 text-muted-foreground">プロフィール未設定</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div><div className="text-xs text-muted-foreground">名前</div><div className="text-xl font-bold">{p.name || "名無し"}</div></div>
            <div><div className="text-xs text-muted-foreground">年齢</div><div>{p.age ?? "未設定"}</div></div>
            <div><div className="text-xs text-muted-foreground">プロフィール</div><div className="whitespace-pre-wrap break-words">{p.bio || "未設定"}</div></div>
          </div>
        )}
      </div>
    </div>
  );
}
